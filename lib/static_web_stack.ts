import { Construct } from 'constructs';
import { DomainlessStaticWebsite } from './construct/domainless_static_website';
import * as cdk from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import { ADMIN_EMAIL, BUDGET, WEBSITE_ID } from './config/constants';

export class StaticWebStack extends cdk.Stack {
  private readonly staticWebsite: DomainlessStaticWebsite

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.staticWebsite = new DomainlessStaticWebsite(this, WEBSITE_ID, {
      s3DeployDirectory: './assets'
    })

    // Output for CloudFront Distribution Domain Name
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.staticWebsite.distribution.distributionDomainName,
    });

    // BUDGET
    new budgets.CfnBudget(this, 'MyBudget', {
      budget: {
        budgetName: 'My Account Budget',
        budgetLimit: {
          amount: BUDGET,
          unit: 'USD'
        },
        timeUnit: 'MONTHLY',
        budgetType: 'COST'
      },
      notificationsWithSubscribers: [
        {
          notification: {
            comparisonOperator: 'GREATER_THAN',
            notificationType: 'ACTUAL',
            threshold: 80 // 80% of the budget
          },
          subscribers: [
            {
              address: ADMIN_EMAIL,
              subscriptionType: 'EMAIL'
            }
          ]
        }
      ]
    });
  }
}
