/* global it, describe */

const mustache = require('mustache')
const Email = require('../email')

const configJSON = {
  email: {
    subject: 'Email fallback',
    from: 'test@layer.com',
    reply_to: 'reply@layer.com'
  }
}

const conversationId = 'layer:///conversations/f32f97a9-4d41-4c30-a93f-7bdc6b3954df'
const userId = 'layer:///identities/6516b622-c276-4b88-aeb7-7b9f874362a6'

const userIdentity = {
  id: userId,
  display_name: 'Frodo the Dodo',
  avatar_url: 'http://sillylordoftheringspictures.com/frodo-riding-a-dodo.png',
  first_name: 'Frodo',
  last_name: 'Baggins',
  email_address: 'frodo@sillylordoftheringspictures.com',
  identity_type: 'user',
}

const messages = [
  {
    user_id: userId,
    message_position: `${conversationId}@1`,
    message_id: 'layer:///messages/66cfb7c5-b742-458e-8c74-32bbd1c75f46',
    message_body: JSON.stringify({ text: 'Hello world' }),
    sent_at: 1522360370752,
    sender_id: 'layer:///identities/35b4f10e-faf1-4cbf-8271-a8a544f133da',
    sender_name: 'Foo Bar'
  }
]

describe('Email.send', () => {
  const email = new Email(configJSON)

  it('should provide a valid data to a template', () => {
    return email.send(userIdentity, messages)
      .then((res) => {
        res.subject.should.eql('Email fallback')
        res.recipient.should.eql({
          id: 'layer:///identities/6516b622-c276-4b88-aeb7-7b9f874362a6',
          display_name: 'Frodo the Dodo',
          avatar_url: 'http://sillylordoftheringspictures.com/frodo-riding-a-dodo.png',
          first_name: 'Frodo',
          last_name: 'Baggins',
          email_address: 'frodo@sillylordoftheringspictures.com',
          identity_type: 'user'
        })
        res.conversations.forEach((conversation) => {
          conversation.conversation_id.should.eql(conversationId)

          conversation.messages[0].should.eql({
            id: 'layer:///messages/66cfb7c5-b742-458e-8c74-32bbd1c75f46',
            body: 'Hello world',
            sender_name: 'Foo Bar',
            sent_at: 1522360370752
          })
        })
      })
  })
})
