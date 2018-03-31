'use strict'

const fs = require('fs')
const path = require('path')
const mustache = require('mustache')
const sendgrid = require('@sendgrid/mail')

module.exports = class Email {
  constructor (config) {
    this.email = config.email
    if (!this.email) throw new Error('Email configuration missing')
    if (this.email.sendgrid_key) sendgrid.setApiKey(this.email.sendgrid_key)

    this.templateText = fs.readFileSync(path.resolve(__dirname, './templates/email.txt'), 'utf-8').toString()
    this.templateHtml = fs.readFileSync(path.resolve(__dirname, './templates/email.html'), 'utf-8').toString()
  }

  /**
   * Send email via Sendgrid API
   * https://github.com/sendgrid/sendgrid-nodejs
   */
  send (user, messages) {
    const templateData = {
      subject: this.email.subject,
      recipient: user,
      conversations: Email.groupByConversation(messages)
    }

    if (!this.email.sendgrid_key) { // NOTE: for testing
      return Promise.resolve(templateData)
    }

    return sendgrid.send({
      to: user.email_address,
      from: this.email.from,
      replyTo: this.email.reply_to,
      subject: this.email.subject,
      text: mustache.render(this.templateText, templateData),
      html: mustache.render(this.templateHtml, templateData)
    })
    .then(() => Promise.resolve(user.email_address))
  }

  /**
   * Filter recipients by status
   */
  static filterReadRecipients (recipients) {
    const userIds = []
    Object.keys(recipients).forEach((userId) => {
      if (recipients[userId] !== 'read') userIds.push(userId)
    })
    return userIds
  }

  /**
   * Group by conversation for email template
   */
  static groupByConversation (items) {
    const hash = items.reduce((hash, item) => {
      const conversationId = item.message_position.substring(0, item.message_position.indexOf('@'))
      if (!hash[conversationId]) hash[conversationId] = []
      try {
        hash[conversationId].push({
          id: Email.idPrefix('messages', item.message_id),
          body: JSON.parse(item.message_body).text,
          sender_name: item.sender_name || 'Unknown Sender',
          sent_at: item.sent_at || null
        })
      }
      catch (e) {
        // empty catch not to error out on JSON.parse operations
      }
      return hash
    }, {})

    const results = []
    Object.keys(hash).forEach((conversationId) => {
      results.push({
        conversation_id: Email.idPrefix('conversations', conversationId),
        messages: hash[conversationId]
      })
    })
    return results
  }

  /**
   * Make sure Layer prefixes are in place
   */
  static idPrefix (type, id) {
    if (id.startsWith(`layer:///${type}`)) return id
    return `layer:///${type}/${id}`
  }
}
