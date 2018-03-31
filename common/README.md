# Common

This is a local npm package which contains common functionality for this integration. It will be installed as a dependency inside the cloud provider project and can be required like any other npm module.

```javascript
const common = require('common')
```

## Email

Emails are being sent using [Sendgrid](https://sendgrid.com) API. Make sure you configure your Sendgrid API key first.

You will want to modify the email template before deploying your integration. Templates can be found in the [`email/templates`](./templates) folder. There is a plain-text and an HTML email template available.

### Templates

Templates are powered by [Mustache](https://github.com/janl/mustache.js) engine and will have data injected into them in the following format:

```json
{
  "subject": "Unread messages",
  "recipient": {
    "id": "layer:///identities/12345",
    "email_address": "john@doe.com",
    "display_name": "John Doe",
    "avatar_url": "http://via.placeholder.com/150x150"
  },
  "conversations": [
    {
      "conversation_id": "layer:///conversations/ffffffff-ffff-ffff-ffff-ffffffffffff",
      "messages": [
        {
          "id": "layer:///messages/ffffffff-ffff-ffff-ffff-ffffffffffff",
          "body": "foo bar",
          "sender_name": "Jane Doe",
          "sent_at": 1522360370752
        }
      ]
    }
  ]
}
```

HTML template is based on [Responsive HTML Email Framework](http://emailframe.work) read more about how to build responsive emails there.
