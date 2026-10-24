// 月額の予算アラート。超えても自動では止まらず、メールで知らせるだけ。
// AWS Budgets の予算はアカウント全体の費用が対象（このプロジェクト分だけではない）

import * as budgets from 'aws-cdk-lib/aws-budgets'
import { Construct } from 'constructs'

export interface CostBudgetProps {
  /** 月の予算（USD） */
  limitUsd: number
  /** 通知先のメールアドレス */
  email: string
}

export class CostBudget extends Construct {
  constructor(scope: Construct, id: string, props: CostBudgetProps) {
    super(scope, id)

    const subscribers = [{ subscriptionType: 'EMAIL', address: props.email }]

    // AWS Budgets には L2 コンストラクトがないため L1 を使う
    new budgets.CfnBudget(this, 'Budget', {
      budget: {
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.limitUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        {
          // 実績が予算の 80% を超えたとき
          notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 80, thresholdType: 'PERCENTAGE' },
          subscribers,
        },
        {
          // 月末の予測が予算を超えそうなとき
          notification: { notificationType: 'FORECASTED', comparisonOperator: 'GREATER_THAN', threshold: 100, thresholdType: 'PERCENTAGE' },
          subscribers,
        },
      ],
    })
  }
}
