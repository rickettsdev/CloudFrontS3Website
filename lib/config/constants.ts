import { ServicePrincipal } from "aws-cdk-lib/aws-iam"

// Fields that need to be customized.
export const AWS_ACCOUNT = '111222333444'
export const REGION = 'us-east-1'
export const BUDGET = 3.50
export const ADMIN_EMAIL = 'admin@mymail.com'
export const WEBSITE_ID = 'your-bucket'

// Objects used often enough to warrant constants.
export const CLOUDFRONT_SERVICE_PRINCIPAL = new ServicePrincipal("cloudfront.amazonaws.com")