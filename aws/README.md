# Email Fallback Integration

Email Fallback Integration, built using the Layer [Integration Development Kit](https://preview-docs.layer.com/reference/integrations/framework).

## Amazon AWS

Make sure you configure [AWS Credentials](https://serverless.com/framework/docs/providers/aws/guide/credentials/) before deploying the integration.

## Deploy

Run the following command to deploy your integration:

    layer-integrations deploy

Read more on how to access Serverless [function logs](https://serverless.com/framework/docs/providers/aws/cli-reference/logs/) so you can monitor your integration.

## Requirements

[Kinesis](https://aws.amazon.com/kinesis/) is required to ensure scalability of the service.

1. Create a new Kinesis Stream from your [AWS console](https://console.aws.amazon.com/kinesis/home)
2. Click on `Create Kinesis Stream`
3. Optionally you can add shards to your stream
4. Copy and save the Kinesis Stream ARN
