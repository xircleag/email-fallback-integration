/* eslint new-cap: ["error", { "newIsCap": false }] */
/* global it, describe */
const mochaPlugin = require('serverless-mocha-plugin')
const expect = mochaPlugin.chai.expect
const wrapped = mochaPlugin.getWrapper('schedule', '/src/handlers.js', 'schedule')

const event = require('./mock/event.json')
const AWS = require('aws-sdk-mock')

AWS.mock('DynamoDB', 'scan', (params, callback) => {
  callback(null, {
    Items: []
  })
})

describe('aws:schedule', () => {
  it('getAll', () => {
    const buf = new Buffer.from(JSON.stringify(event))
    const eventData = {
      Records: [{
        kinesis: {
          data: buf
        }
      }]
    }
    return wrapped.run(eventData, {})
      .then((response) => {
        expect(response.statusCode).to.be.equal(200)
      })
  })
})
