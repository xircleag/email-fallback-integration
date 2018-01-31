'use strict'

const LayerIDK = require('@layerhq/idk')
const ms = require('ms')

const configJSON = require(process.env.LAYER_CONFIG || './layer_config.json')

exports.fallbackMilliseconds = () => ms(configJSON.fallback_delay)

exports.tableName = () => `LayerEmailFallback-${LayerIDK.toUUID(configJSON.app_id)}`

exports.scheduleRate = () => {
  const formatted = ms(exports.fallbackMilliseconds() / 2, { long: true })
  return `rate(${formatted})`
}

exports.kinesisArn = () => configJSON.kinesis_arn
exports.kinesisShards = () => configJSON.kinesis_shards
exports.kinesisStreamName = () => {
  if (!configJSON.kinesis_arn) return null
  return configJSON.kinesis_arn.substring(configJSON.kinesis_arn.indexOf('/') + 1)
}
