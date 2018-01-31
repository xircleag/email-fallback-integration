/* global it, describe */
const mochaPlugin = require('serverless-mocha-plugin')
const expect = mochaPlugin.chai.expect
const wrapped = mochaPlugin.getWrapper('webhook', '/src/handlers.js', 'webhook')

const body = require('./mock/event.json')
const headers = require('./mock/headers.json')

describe('azure:webhook', () => {
  it('A valid body should be inserted into queue storage', () => {
    const eventData = {
      headers,
      body: JSON.stringify(body)
    }
    const context = {
      res: {},
      done: (err, data) => {
        return {err, data}
      }
    }
    wrapped.run(context, eventData)
    expect(context.res.status).to.be.equal(200)
  })

  it('An invalid body should not be inserted into queue storage', (done) => {
    const eventData = {
      headers: null,
      body: null
    }
    const context = {
      res: {},
      done: (err, data) => {
        const isError = err instanceof Error
        expect(isError).to.be.equal(true)
        done()
      }
    }
    wrapped.run(context, eventData)
  })

  it('Invalid user-agent must fail', (done) => {
    const eventData = {
      headers: Object.assign({}, headers, { 'User-Agent': null }),
      body: JSON.stringify(body)
    }
    const context = {
      res: {},
      done: (err, data) => {
        const isError = err instanceof Error
        expect(isError).to.be.equal(true)
        done()
      }
    }
    wrapped.run(context, eventData)
  })

  it('Invalid event type should fail', (done) => {
    const INVALID_EVENT_TYPES = [
      'Message.updated',
      'Conversation.created',
      'Conversation.updated',
      'Participation.created',
      'Channel.created',
      'Channel.updated',
      'Channel.deleted',
      'Membership.created',
      'Membership.deleted'
    ]
    let NUMBER_OF_FAILED_EVENTS = 0
    INVALID_EVENT_TYPES.forEach(eventType => {
      const eventData = {
        headers: Object.assign({}, headers, { 'layer-webhook-event-type': eventType }),
        body: JSON.stringify(body)
      }
      const context = {
        res: {},
        done: (err, data) => {
          const isError = err instanceof Error
          if (isError) {
            NUMBER_OF_FAILED_EVENTS++
          }
          expect(isError).to.be.equal(true)
        }
      }
      wrapped.run(context, eventData)
    })

    expect(NUMBER_OF_FAILED_EVENTS).to.be.equal(INVALID_EVENT_TYPES.length)
    done()
  })
})
