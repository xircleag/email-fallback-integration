'use strict'

const LayerIDK = require('@layerhq/idk')
const Email = require('common/email')

const configJSON = require(process.env.LAYER_CONFIG || './layer_config.json')
const layerIDK = new LayerIDK(configJSON)

/**
 * Webhook payload function handler
 */
exports.webhook = (event, context, callback) => {
  const log = layerIDK.logger(context)
  const kinesis = require('./kinesis')

  try {
    const webhook = layerIDK.webhook(event.headers, event.body)

    // Filter non-conversation events
    if (webhook.event.type === 'Message.created' || webhook.event.type === 'Message.deleted') {
      if (!webhook.message.conversation) {
        log.info('Webhook: Not a conversation')
        callback(null, { statusCode: 204 })
        return
      }
    }

    log.info('Webhook:', webhook.event)
    kinesis.insert(webhook)
      .then(() => {
        log.info('Webhook: OK')
        callback(null, { statusCode: 200 })
      })
      .catch((err) => {
        log.error('Webhook: kinesis.insert', err)
        callback(err)
      })
  } catch (err) {
    log.error('Webhook:', err)
    callback(err)
  }
}

/**
 * Kinesis ingest function handler
 */
exports.ingest = (event, context, callback) => {
  const log = layerIDK.logger(context)
  const dynamo = require('./dynamo')

  const operations = []
  event.Records.forEach((record) => {
    try {
      const data = JSON.parse(Buffer.from(record.kinesis.data, 'base64').toString())
      operations.push(() => dynamo.webhook(data))
    } catch (err) {
      log.error('Ingest: Record', err)
    }
  })

  log.info(`Ingest: ${event.Records.length} records`)
  LayerIDK.promiseSerial(operations)
    .then(() => {
      log.info('Ingest: OK')
      callback(null, { statusCode: 200 })
    })
    .catch((err) => {
      log.error('Ingest:', err)
      callback(err)
    })
}

/**
 * Scheduler trigger function
 * https://serverless.com/framework/docs/providers/aws/events/schedule/
 */
exports.schedule = (event, context, callback) => {
  const log = layerIDK.logger(context)
  const dynamo = require('./dynamo')
  const email = new Email(configJSON)

  const operation = (userId, messages) => {
    return layerIDK.api.identities.get(userId)
      .then(({ data }) => {
        if (!data || !data.identity_type === 'user' || !data.email_address) {
          log.info('Schedule operation: Identity invalid or no email')
          return Promise.resolve()
        }

        log.info(`Schedule operation: ${data.email_address}`)
        return email.send(data, messages)
      })
      .then((email) => {
        log.info(`Schedule operation: OK`, email)
        return dynamo.removeBatch(userId, messages)
      })
  }

  log.info('Schedule')
  dynamo.getAll()
    .then((res) => {
      const operations = []
      Object.keys(res).forEach((userId) => {
        operations.push(() => operation(userId, res[userId]))
      })

      log.info('Schedule:', operations.length, 'operations')
      return LayerIDK.promiseSerial(operations)
    })
    .then(() => {
      log.info('Schedule: OK')
      callback(null, { statusCode: 200 })
    })
    .catch((err) => {
      log.error('Schedule:', err.response ? err.response.data : err)
      callback(err)
    })
}

/**
 * Verfy webhook function handler
 * https://docs.layer.com/reference/webhooks/rest.out#verify
 */
exports.verify = (event, context, callback) => {
  const log = layerIDK.logger(context)
  const query = event.queryStringParameters

  log.info('Verify:', query)
  callback(null, {
    statusCode: query ? 200 : 400,
    body: query ? query.verification_challenge : 'Missing `verification_challenge` URL query parameter'
  })
}
