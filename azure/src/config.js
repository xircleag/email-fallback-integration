'use strict'

const LayerIDK = require('@layerhq/idk')
const ms = require('ms')
const humanToCron = require('human-to-cron')

const configJSON = require(process.env.LAYER_CONFIG || './layer_config.json')

exports.fallbackMilliseconds = () => ms(configJSON.fallback_delay)
exports.scheduleRate = () => {
  const formatted = ms(exports.fallbackMilliseconds() / 2, { long: true })
  return humanToCron(`once each ${formatted}`)
}

exports.tableName = () => `LayerEmailFallback${LayerIDK.toUUID(configJSON.app_id)}`.replace(/-/g, '')
exports.tableDBAccountName = () => configJSON.storage_account_name
exports.tableDBAccessKey = () => configJSON.storage_access_key

exports.queueStorageName = () => `layeremailfallback${LayerIDK.toUUID(configJSON.app_id)}`
exports.queueStorageConnection = () => {
  return `DefaultEndpointsProtocol=https;AccountName=${configJSON.storage_account_name};AccountKey=${configJSON.storage_access_key};EndpointSuffix=core.windows.net`
}
