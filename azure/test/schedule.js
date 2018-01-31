/* eslint new-cap: ["error", { "newIsCap": false }] */
/* global it, describe */
const mochaPlugin = require('serverless-mocha-plugin')
const expect = mochaPlugin.chai.expect
const event = require('./mock/event.json')
const proxyquire = require('proxyquire')

describe('azure:schedule', () => {
  it('getAll with no parts should return a 200', (done) => {
    const eventBody = Object.assign({}, event, {
      message: {
        parts: []
      }
    })
    const context = {
      res: {},
      done: (err, response) => {
        expect(err).to.be.undefined
        const res = context.res
        expect(res.status).to.be.equal(200)
        done()
      }
    }
    const fakeResponse = {}

    // create a simple mockFilter class
    let MockTableDB = {
      getAll: (data, context) => {
        return Promise.resolve(fakeResponse)
      }
    }

    const filterProxy = proxyquire('../src/handlers', {
      './tabledb': MockTableDB
    })

    filterProxy.ingest(context, eventBody)
  })
})
