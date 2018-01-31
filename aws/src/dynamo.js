'use strict'

const LayerIDK = require('@layerhq/idk')
const AWS = require('aws-sdk')

const config = require('./config')

AWS.config.setPromisesDependency(Promise)

// https://docs.aws.amazon.com/amazondynamodb/latest/gettingstartedguide/GettingStarted.NodeJs.html
const dynamodb = new AWS.DynamoDB()
const docClient = new AWS.DynamoDB.DocumentClient()

const TableName = config.tableName()

/**
 * Parse webhook by event type
 */
exports.webhook = (webhook) => {
  switch (webhook.event.type) {
    case 'Message.created':
      return messageCreated(webhook)
    case 'Receipt.created':
      return messageRead(webhook)
    case 'Message.deleted':
      return messageDeleted(webhook)
    case 'Conversation.deleted':
      return conversationDeleted(webhook)
    case 'Participation.deleted':
      return participantDeleted(webhook)
  }
}

/**
 * Batch insert entries into the db
 * NOTE: batchWrite limit is 25. We allow 25 participants per conversation so this shold be fine
 */
function messageCreated (webhook) {
  const message = webhook.message
  const messageBody = LayerIDK.getMessageText(message)
  if (!messageBody) return Promise.resolve()

  const recipients = []
  Object.keys(message.recipient_status).forEach((userId) => {
    const status = message.recipient_status[userId]
    if (status !== 'read') recipients.push(userId)
  })
  if (!recipients.length) return Promise.resolve()

  const data = {
    message_position: `${message.conversation.id}@${message.position}`,
    message_id: message.id,
    sent_at: new Date(message.sent_at).getTime(),
    message_body: messageBody
  }

  return docClient.batchWrite({
    RequestItems: {
      [TableName]: recipients.map((userId) => {
        return {
          PutRequest: {
            Item: {
              user_id: userId,
              message_position: data.message_position,
              message_id: data.message_id,
              sent_at: data.sent_at,
              message_body: data.message_body
            }
          }
        }
      })
    }
  }).promise()
}

/**
 * Remove a single entry
 */
function messageRead (webhook) {
  if (webhook.receipt.type !== 'Read') return Promise.resolve()
  const userId = webhook.actor.id
  const conversationId = webhook.conversation.id
  const from = webhook.receipt.positions.from
  const to = webhook.receipt.positions.to

  if (from !== to) return markAllRead(userId, conversationId)

  return docClient.delete({
    TableName,
    Key: {
      user_id: userId,
      message_position: `${conversationId}@${from}`
    }
  }).promise()
}

function markAllRead (userId, conversationId) {
  return docClient.query({
    TableName,
    KeyConditionExpression: 'user_id = :user',
    ExpressionAttributeValues: { ':user': userId }
  }).promise()
  .then((res) => {
    const messages = []
    res.Items.forEach((item) => {
      if (item.message_position.startsWith(conversationId)) {
        messages.push({ message_position: item.message_position })
      }
    })
    if (!messages.length) return Promise.resolve()
    return exports.removeBatch(userId, messages)
  })
}

/**
 * Batch remove entries by messageId and userIds[]
 * NOTE: batchWrite limit is 25. We allow 25 participants per conversation so this shold be fine
 */
function messageDeleted (webhook) {
  const message = webhook.message
  const messagePosition = `${message.conversation.id}@${message.position}`

  const recipients = []
  Object.keys(message.recipient_status).forEach((userId) => {
    const status = message.recipient_status[userId]
    if (status !== 'read') recipients.push(userId)
  })
  if (!recipients.length) return Promise.resolve()

  return docClient.batchWrite({
    RequestItems: {
      [TableName]: recipients.map((userId) => {
        return {
          DeleteRequest: {
            Key: {
              user_id: userId,
              message_position: messagePosition
            }
          }
        }
      })
    }
  }).promise()
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

/**
 * Batch remove entries by userId and messages[].message_position
 * NOTE: batchWrite limit is 25. We need to split this into chunks of 25
 */
exports.removeBatch = (userId, messages) => {
  const chunks = LayerIDK.chunkArray(messages, 25)
  const operations = chunks.map((chunk) => () => {
    return docClient.batchWrite({
      RequestItems: {
        [TableName]: chunk.map(({ message_position }) => {
          return {
            DeleteRequest: {
              Key: {
                user_id: userId,
                message_position
              }
            }
          }
        })
      }
    }).promise()
  })
  return LayerIDK.promiseSerial(operations)
}

/**
 * Get all entries in the table
 *
 * NOTE: Table scan is not very efficient but since we have to get all the data anyway, it makes to use it here
 * https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/QueryAndScanGuidelines.html
 */
exports.getAll = () => {
  const delta = (Date.now() - config.fallbackMilliseconds()).toString()
  const params = {
    TableName,
    ProjectionExpression: 'user_id, message_position, message_id, message_body',
    FilterExpression: 'sent_at < :fallbackTime',
    ExpressionAttributeValues: { ':fallbackTime': { 'N': delta } }
  }

  // Recursevely perform scan operation
  let results = []
  const onScan = (res) => {
    results = results.concat(res.Items)
    if (typeof res.LastEvaluatedKey !== 'undefined') {
      params.ExclusiveStartKey = res.LastEvaluatedKey
      return dynamodb.scan(params).promise()
        .then(onScan)
    }
  }

  return dynamodb.scan(params).promise()
    .then(onScan)
    .then(() => groupByUserId(results))
}

/**
 * Create a hash from array of dyndmodb items, group by user_id
 */
function groupByUserId (items) {
  return items.reduce((hash, item) => {
    const userId = item.user_id.S
    const message = {
      message_position: item.message_position.S,
      message_id: item.message_id.S,
      message_body: item.message_body.S
    }

    if (!hash[userId]) hash[userId] = []
    hash[userId].push(message)

    return hash
  }, {})
}
