'use strict'

const LayerIDK = require('@layerhq/idk')
const Email = require('common/email')

const configJSON = require(process.env.LAYER_CONFIG || './layer_config.json')
const layerIDK = new LayerIDK(configJSON)

/**
 * Webhook payload function handler
 * https://serverless.com/framework/docs/providers/azure/events/http/
 */
exports.webhook = (context, req) => {
  const log = layerIDK.logger(context)

  try {
    const webhook = layerIDK.webhook(req.headers, req.body)

    // Filter non-conversation events
    if (webhook.event.type === 'Message.created' || webhook.event.type === 'Message.deleted') {
      if (!webhook.message.conversation) {
        log.info('Webhook: Not a conversation')
        context.res = { status: 200 }
        context.done()
        return
      }
    }

    log.info('Webhook:', webhook.event)
    context.res = { status: 200 }
    context.done(null, webhook)
  } catch (err) {
    log.error('Webhook:', err)
    context.res = { status: 200 }
    context.done(err)
  }
}

/**
 * Service Bus ingest function handler
 * https://serverless.com/framework/docs/providers/azure/events/servicebus/
 */
exports.ingest = (context, item) => {
  const log = layerIDK.logger(context)
  const tabledb = require('./tabledb')

  log.info('Ingest')
  const payload = item || {}
  tabledb.webhook(payload, context)
    .then(() => {
      log.info('Ingest: OK')
      context.res = { status: 200 }
      context.done()
    })
    .catch((err) => {
      log.error('Ingest:', err)
      context.res = { status: 500 }
      context.done()
    })
}

/**
 * Timer trigger function
 * https://serverless.com/framework/docs/providers/azure/events/timer/
 */
exports.schedule = (context, timerObj) => {
  const tabledb = require('./tabledb')
  const log = layerIDK.logger(context)
  const email = new Email(configJSON)

  const operation = (userId, messages, context) => {
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
        log.info('Schedule operation: OK', email)
        return tabledb.removeBatch(userId, messages, context)
      })
      .catch((err) => {
        log.error(`Schedule operation:`, err)
        return err
      })
  }

  log.info('Schedule')
  tabledb.getAll(context)
    .then((res) => {
      const operations = []
      Object.keys(res).forEach((userId) => {
        operations.push(() => operation(userId, res[userId], context))
      })

      log.info(`Schedule: ${operations.length} operations`)
      return LayerIDK.promiseSerial(operations)
    })
    .then(() => {
      log.info('Schedule: OK')
      context.done()
    })
    .catch((err) => {
      log.error('Schedule:', err.response ? err.response.body : err)
      context.done()
    })
}

/**
 * Verfy webhook function handler
 * https://docs.layer.com/reference/webhooks/rest.out#verify
 */
exports.verify = (context, req) => {
  const log = layerIDK.logger(context)
  const query = req.query

  log.info('Verify:', query)
  context.res = {
    status: query ? 200 : 400,
    headers: { 'Content-Type': 'text/plain' },
    body: query ? query.verification_challenge : 'Missing `verification_challenge` URL query parameter',
    isRaw: true
  }
  context.done()
}
