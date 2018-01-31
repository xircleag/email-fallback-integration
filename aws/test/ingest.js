/* eslint new-cap: ["error", { "newIsCap": false }] */
/* global it, describe */
const mochaPlugin = require('serverless-mocha-plugin')
const expect = mochaPlugin.chai.expect
const wrapped = mochaPlugin.getWrapper('ingest', '/src/handlers.js', 'ingest')

const event = require('./mock/event.json')
const AWS = require('aws-sdk-mock')

AWS.mock('DynamoDB.DocumentClient', 'put', (params, callback) => {
  callback(null, { status: 200 })
})

AWS.mock('DynamoDB.DocumentClient', 'get', (params, callback) => {
  callback(null, { status: 200 })
})

AWS.mock('DynamoDB.DocumentClient', 'batchWrite', (params, callback) => {
  callback(null, { status: 200 })
})

AWS.mock('DynamoDB.DocumentClient', 'batchGet', (params, callback) => {
  callback(null, [])
})

describe('aws:ingest', () => {
  it('Ingest with valid body should invoke DynamoDB batchWrite', () => {
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

  it('Ingest with invalid body should fail DynamoDB batchWrite', () => {
    const eventBody = Object.assign({}, event, {
      message: {
        parts: null
      }
    })
    const buf = new Buffer.from(JSON.stringify(eventBody))
    const eventData = {
      Records: [{
        kinesis: {
          data: buf
        }
      }]
    }
    return wrapped.run(eventData, {})
      .catch((err) => {
        const isError = err instanceof Error
        expect(isError).to.be.equal(true)
      })
  })
})
