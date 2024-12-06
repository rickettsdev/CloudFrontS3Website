import { Construct } from 'constructs';
import { Arn, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CLOUDFRONT_SERVICE_PRINCIPAL } from '../config/constants';

export interface DomainlessStaticWebsiteProps {
    s3DeployDirectory: string
    webACL?: wafv2.CfnWebACL
}

export class DomainlessStaticWebsite extends Construct {
    public readonly distribution: cloudfront.Distribution
    public readonly appBucket: s3.Bucket 
    private readonly props: DomainlessStaticWebsiteProps

    constructor(scope: Construct, id: string, props: DomainlessStaticWebsiteProps) {
        super(scope, id)
        this.props = props
        const {distribution, appBucket} = this.createStaticSite(id)
        this.distribution = distribution
        this.appBucket = appBucket
    }

    private createStaticSite(
        id: string
      ): {distribution: cloudfront.Distribution, appBucket: s3.Bucket} {
    
        const appBucket = new s3.Bucket(this, `${id}`, {
          removalPolicy: RemovalPolicy.DESTROY,
          autoDeleteObjects: true, // should remove later
          enforceSSL: true,
        });

        appBucket.addToResourcePolicy(
          new iam.PolicyStatement({
            actions: ["s3:GetObject"],
            principals: [CLOUDFRONT_SERVICE_PRINCIPAL],
            effect: iam.Effect.ALLOW,
            resources: [appBucket.bucketArn + "/*"],
            conditions: {
              // need to narrow this down. There may have been problems with this related to OAC 
            },
          })
        );

        const cloudFrontLogBucket = this.logBucketWithName('CloudFrontLogs',
          [CLOUDFRONT_SERVICE_PRINCIPAL],
          `arn:aws:cloudfront::${Stack.of(this).account}:distribution/*`
        );
    
        const distribution = new cloudfront.Distribution(this, `${id}Distribution`, {
          defaultBehavior: {
            origin: origins.S3BucketOrigin.withOriginAccessControl(appBucket, {
              connectionTimeout: Duration.seconds(10),
              connectionAttempts: 3,
            }),
            allowedMethods: { methods: ['GET', 'HEAD', 'OPTIONS'] },
            cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
            compress: true,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
    
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          },
          defaultRootObject: 'index.html',
          enabled: true,
          webAclId: this.props.webACL?.attrArn,
          errorResponses: [
            { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/error.html' },
            { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/error.html' },
          ],
          httpVersion: cloudfront.HttpVersion.HTTP2,
          priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
          minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2018,
          enableLogging: true,
          logBucket: cloudFrontLogBucket,
          logIncludesCookies: true
        });

        // Deployment of website content to S3
        new s3deploy.BucketDeployment(this, 'DeployWebsite', {
            sources: [s3deploy.Source.asset(this.props.s3DeployDirectory)],
            destinationBucket: appBucket,
            distribution,
            distributionPaths: ['/*'],
        });
    
        return { distribution, appBucket };
      }

      private logBucketWithName(name: string, principals: [ServicePrincipal], sourceArn: string) {
        const logBucket = new s3.Bucket(this, name, {
          removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
          blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
          autoDeleteObjects: true, // should remove later
          objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_PREFERRED
        });

        logBucket.addLifecycleRule({
          id: 'LogExpiration',
          expiration: Duration.days(1) // Delete logs after 1 day
        });

        logBucket.addToResourcePolicy(new PolicyStatement({
          actions: ['s3:PutObject'],
          resources: [logBucket.arnForObjects('*')], 
          principals: principals,
          conditions: {
            StringEquals: {
              'AWS:SourceArn': sourceArn
            }
          }
        }));
        return logBucket;
      }
}