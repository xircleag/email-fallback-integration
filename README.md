# Email Fallback Integration
[![Build Status](https://circleci.com/gh/layerhq/email-fallback-integration.png?circle-token=49471f2e2e4a0e991c5316ed09695d3373ec6377)](https://circleci.com/gh/layerhq/email-fallback-integration)

Email Fallback Integration, built using the Layer [Integration Development Kit](https://docs.layer.com/reference/integrations/framework). This integration is designed to provide a turn-key solution for the deployment of an email fallback mechanism that will deliver an email after a specific amount of time has passed and the message remains unread in a conversation.

## Prerequisites

[Serverless](https://serverless.com) toolkit and [layer-integrations](https://github.com/layerhq/layer-integrations) command line tool.

    sudo npm install -g serverless layer-integrations

[Sendgrid](https://sendgrid.com) account is required to send emails.

### Fallback delay

Weather an email is sent is determined by the time passed between when a message was sent and when a message was read.

Delay is expressed as a string describing a time span [zeit/ms](https://github.com/zeit/ms). Minimum value is `2 minutes`. You should not expect the email fallback to trigger precisely when fallback delay expires.

## Cloud Providers

This integration can be deployed one of the following cloud providers:

- [Amazon AWS](./aws)
- [Microsoft Azure](./azure)

## Email template

Read more about how to modify the email template [here](./common).
