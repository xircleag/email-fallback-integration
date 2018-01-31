'use strict'

const LayerIDK = require('@layerhq/idk')
const azure = require('azure-storage')

const config = require('./config')

const client = azure.createTableService(config.tableDBAccountName(), config.tableDBAccessKey())
const generator = azure.TableUtilities.entityGenerator

const TableName = config.tableName()
const getMessagePosition = (conversationId, position) => `${LayerIDK.toUUID(conversationId)}@${position}`

/**
 * Parse webhook by event type
 */
exports.webhook = (webhook) => {
  switch (webhook.event.type) {
    case 'Message.created':
      return messageCreated(webhook.message)
    case 'Message.deleted':
      return messageDeleted(webhook.message)
    case 'Receipt.created':
      return messageRead(webhook)
    case 'Conversation.deleted':
      return conversationDeleted(webhook)
    case 'Participation.deleted':
      return participantDeleted(webhook)
  }
}

function insertEntity (entity) {
  return new Promise((resolve, reject) => {
    client.insertEntity(TableName, entity, (err, res) => {
      if (err) return reject(err)
      return resolve(res)
    })
  })
}

function messageCreated (message) {
  const messageBody = LayerIDK.getMessageText(message)
  if (!messageBody) return Promise.resolve()

  const operations = []
  Object.keys(message.recipient_status).forEach((recipientId) => {
    const userId = LayerIDK.toUUID(recipientId)
    const messagePosition = getMessagePosition(message.conversation.id, message.position)

    const status = message.recipient_status[recipientId]
    if (status !== 'read') {
      operations.push(() => insertEntity({
        PartitionKey: generator.String(userId),
        RowKey: generator.String(messagePosition),
        message_id: generator.String(message.id),
        sent_at: generator.DateTime(new Date(message.sent_at)),
        message_body: generator.String(messageBody)
      }))
    }
  })

  if (operations.length === 0) return Promise.resolve()
  return LayerIDK.promiseSerial(operations)
}

function messageRead (webhook) {
  if (webhook.receipt.type !== 'Read') return Promise.resolve()

  const userId = webhook.actor.id
  const conversationId = webhook.conversation.id
  const from = webhook.receipt.positions.from
  const to = webhook.receipt.positions.to

  if (from !== to) return markAllRead(userId, conversationId)

  const entity = {
    PartitionKey: {'_': LayerIDK.toUUID(userId)},
    RowKey: {'_': getMessagePosition(conversationId, from)}
  }
  return new Promise((resolve, reject) => {
    client.deleteEntity(TableName, entity, (err, res) => err ? reject(err) : resolve(res))
  })
}

function queryEntities (userId, conversationId) {
  const query = new azure.TableQuery()
    .where('PartitionKey eq ?', userId)

  return new Promise((resolve, reject) => {
    return client.queryEntities(TableName, query, null, (err, res) => {
      if (err) return reject(err)
      const messages = []
      res.entries.forEach((item) => {
        const messagePosition = item.RowKey._
        if (messagePosition.startsWith(conversationId)) {
          messages.push({ message_position: messagePosition })
        }
      })
      if (!messages.length) return resolve([])
      return resolve(messages)
    })
  })
}

function markAllRead (userId, conversationId) {
  const userIdUUID = LayerIDK.toUUID(userId)
  const conversationIdUUID = LayerIDK.toUUID(conversationId)
  return queryEntities(userIdUUID, conversationIdUUID)
    .then((messages) => exports.removeBatch(userIdUUID, messages))
}

function messageDeleted (message) {
  const entities = []

  Object.keys(message.recipient_status).forEach((recipientId) => {
    const status = message.recipient_status[recipientId]
    if (status !== 'read') {
      const userId = LayerIDK.toUUID(recipientId)
      const messagePosition = getMessagePosition(message.conversation.id, message.position)
      entities.push({
        PartitionKey: {'_': userId},
        RowKey: {'_': messagePosition}
      })
    }
  })

  if (!entities.length) return Promise.resolve()

  const batch = new azure.TableBatch()
  entities.forEach(entity => batch.deleteEntity(entity, { echoContent: true }))
  return new Promise((resolve, reject) => {
    client.executeBatch(TableName, batch, (err, res) => err ? reject(err) : resolve(res))
  })
}

function conversationDeleted (webhook) {
  const conversationId = webhook.conversation.id

  const operations = webhook.conversation.participants.map((participant) => () => {
    return markAllRead(participant.id, conversationId)
  })
  return LayerIDK.promiseSerial(operations)
}

function participantDeleted (webhook) {
  const conversationId = webhook.conversation.id

  const operations = webhook.changes.map((change) => () => {
    return markAllRead(change.id, conversationId)
  })
  return LayerIDK.promiseSerial(operations)
}

exports.getAll = () => {
  const delta = new Date(Date.now() - config.fallbackMilliseconds())

  const query = new azure.TableQuery()
    .where(azure.TableQuery.dateFilter('sent_at', azure.TableUtilities.QueryComparisons.LESS_THAN, delta))

  return new Promise((resolve, reject) => {
    client.queryEntities(TableName, query, null, (err, res) => {
      if (err) return reject(err)
      return resolve(groupByUserId(res.entries))
    })
  })
}

exports.removeBatch = (userId, messages) => {
  if (!messages.length) return Promise.resolve({})

  const batch = new azure.TableBatch()
  messages.forEach(message => {
    const entity = {
      PartitionKey: {'_': userId},
      RowKey: {'_': message.message_position}
    }
    batch.deleteEntity(entity, { echoContent: true })
  })

  return new Promise((resolve, reject) => {
    client.executeBatch(TableName, batch, (err, res) => {
      if (err) return reject(err)
      else return resolve(res)
    })
  })
}

exports.createTable = () => {
  return new Promise((resolve, reject) => {
    client.createTableIfNotExists(TableName, (err, res) => err ? reject(err) : resolve(res))
  })
}

/**
 * Create a hash from array of dyndmodb items, group by user_id
 */
function groupByUserId (items) {
  return items.reduce((hash, item) => {
    const userId = item.PartitionKey._
    const message = {
      message_position: item.RowKey._,
      message_id: item.message_id._,
      message_body: item.message_body._
    }

    if (!hash[userId]) hash[userId] = []
    hash[userId].push(message)

    return hash
  }, {})
}
