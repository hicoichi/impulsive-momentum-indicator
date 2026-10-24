---
paths:
  - "infra/**"
  - "app/domain/**"
  - "app/data/**"
---

# インフラ・バックエンド規約（AWS CDK）

フェーズ2のバックエンドは AWS CDK（TypeScript）で `infra/` に作る。コーディングの基本は `.claude/rules/coding-standard.md`、技術スタックは `.claude/rules/tech-stack.md` に従い、ここではインフラ固有の決まりを定める。

## 最重要：AWS への操作

- **`cdk deploy`／`cdk destroy`／`cdk bootstrap`、および AWS のリソースを変更する CLI 操作は、実行のたびにユーザーの承認を得る。** 一度の承認を次の実行に流用しない。
- `cdk synth`、`cdk diff`、テストは承認なしで実行してよい（`cdk diff` は AWS の読み取りのみ）。
- デプロイ前には `cdk diff` の結果をユーザーに示し、特にリソースの置き換え・削除がないかを確認する。
- アクセスキー・シークレット・アカウント ID をコード、`cdk.json`、コミットに含めない。

## リポジトリ内の構成

フロントエンド（ルートの Nuxt）と同じリポジトリに、`infra/` を独立した npm パッケージとして置く。

| 場所 | 責務 |
|---|---|
| `infra/bin/infra.ts` | CDK アプリの入口。ステージの決定、タグ付け、スタックの生成だけを行う |
| `infra/lib/` | スタックと独自コンストラクト。1ファイル1クラス、ファイル名は kebab-case（例：`backend-stack.ts`） |
| `infra/lambda/` | Lambda のハンドラー。関数ごとにディレクトリを分ける（例：`infra/lambda/submit-vote/handler.ts`） |
| `infra/test/` | CDK とハンドラーのテスト |
| `app/domain/` | フロントとバックエンドで共有するドメインロジック（上限10票、12時間のウィンドウなど） |

- 依存関係は `infra/package.json` で管理し、ルートの `package.json` と混ぜない。npm コマンドは `infra/` で実行する。
- **仕様値とドメインロジックは `app/domain/` を唯一の正とし、Lambda からはそれを import する。** バックエンド側に同じ判定を書き直さない。
- そのため `app/domain/` には Vue・Nuxt・ブラウザ API に依存するコードを置かない（Node.js の Lambda でも動くこと）。
- Lambda から `app/` の他のディレクトリ（components、composables など）を import しない。
- フロントからバックエンドへの接続口は `app/data/countSource.ts` の `ImpulseCountSource` とし、フェーズ2ではこのインターフェースの AWS 実装を `app/data/` に追加する。

## 技術

| 項目 | 内容 |
|---|---|
| CDK | v2（`aws-cdk-lib`、`constructs`）。CLI（`aws-cdk`）は `infra/` の devDependencies に固定し、`npx cdk` で使う |
| 言語 | TypeScript（strict）。`cdk init` のテンプレートどおり 7 系を使う（ルートは vue-tsc の都合で 5.9 系） |
| 実行 | `tsx`（`cdk.json` の `app`） |
| テスト | Jest（`cdk init` 標準）。CDK のテスト補助機能（`aws-cdk-lib/testhelpers`）が Jest 専用のため、ルートの Vitest とは分ける |
| Lint／整形 | ルートの ESLint（`npx eslint .`）が `infra/` も対象にする。書式はフロントと同じ（セミコロンなし、シングルクォート） |

- import は `aws-cdk-lib/core`、`aws-cdk-lib/aws-dynamodb` のようにサービス単位で行う。
- 新しい依存（cdk-nag、Powertools for AWS Lambda など）を追加するときは、tech-stack.md の「依存関係の追加ルール」に従い、事前に確認する。

## ステージとアカウント

- ステージは `dev`／`prod`。cdk コマンドの `-c stage=<値>` で指定し、省略時は `dev`。不正な値はエラーにする（`infra/lib/stage.ts`）。
- アカウントとリージョンはコードに書かず、実行時の AWS 設定（`CDK_DEFAULT_ACCOUNT`／`CDK_DEFAULT_REGION`）から受け取る。
- ステージによる違い（削除ポリシー、ログの保持期間など）は、スタックの props で受け取ったステージから決める。コンストラクトの中で `tryGetContext` を読まない（context を読むのは `bin/` だけ）。

## 命名とタグ

- スタック ID：`ImpulsiveMomentum<役割>-<stage>`（例：`ImpulsiveMomentumBackend-dev`）。
- コンストラクト ID：PascalCase で役割を表す名前（例：`VotesTable`、`SubmitVoteFunction`）。デプロイ後に ID を変えるとリソースが置き換わるため、安易に変えない。
- 物理名（`tableName`、`functionName`、`bucketName` など）は指定せず、CDK に生成させる。他から参照する値は `CfnOutput` か SSM パラメーターで渡す。
- すべてのリソースに `Project` と `Stage` のタグを付ける（`bin/infra.ts` でアプリ全体に付けている）。

## コンストラクトの書き方

- L2 コンストラクトを優先する。L1（`Cfn*`）は L2 で設定できない場合に限り、理由をコメントに書く。
- スタックが大きくなったら、意味のまとまりごとに独自コンストラクト（`Construct` のサブクラス）に分ける。
- 権限は `table.grantReadWriteData(fn)` のような grant メソッドで最小権限を付与する。`*` を含むポリシーを手書きしない。
- 値の受け渡しはコンストラクトの props と公開プロパティで行い、グローバルな状態を使わない。

## データとセキュリティ

- データを持つリソース（DynamoDB など）の削除ポリシー：`prod` は `RETAIN`、`dev` は `DESTROY` を許可する。
- `prod` の DynamoDB はポイントインタイムリカバリを有効にする。
- 暗号化は AWS 管理の既定を有効のままにする。S3 を使う場合はパブリックアクセスをブロックし、HTTPS 以外を拒否する。
- 外部に公開する API には、スロットリング（流量制限）を設定する。投票上限の判定はサーバー側で必ず行い、クライアントの判定を信用しない（USM §7）。
- ログの保持期間を明示する（無期限にしない）。

## Lambda

- `aws-cdk-lib/aws-lambda-nodejs` の `NodejsFunction` で作り、esbuild でバンドルする。esbuild は `infra/` の devDependencies に入れ、Docker でのバンドルに頼らない。
- ランタイムは Node.js 24、アーキテクチャは arm64。
- ハンドラーはイベントの解釈と応答の組み立てに専念し、判定ロジックは `app/domain/` の純粋関数を呼ぶ。
- 時刻・乱数・AWS SDK のクライアントは引数で受け取れるようにし、テストで差し替える（coding-standard.md の「ロジックの書き方」と同じ考え方）。
- 環境変数で受け取る設定（テーブル名など）は、ハンドラーの起動時に1か所で読み取り、未設定なら起動時にエラーにする。

## テスト

- スタックごとに `aws-cdk-lib/assertions` の `Template` で、重要なプロパティ（削除ポリシー、権限、暗号化、スロットリングなど）を個別に検証する。テンプレート全体のスナップショットだけに頼らない。
- `prod` と `dev` で設定が変わる箇所は、両方のステージでテストする。
- ハンドラーは AWS に接続せずに単体テストする。
- 変更後は `infra/` で `npm run build`、`npm test`、`npm run synth` を実行し、通ってから完了とする。

## コミットするもの・しないもの

- コミットする：`cdk.json`、`cdk.context.json`（作られた場合。値の参照結果を固定するため）、`package-lock.json`。
- コミットしない：`cdk.out/`、`node_modules/`、ビルドされた `.js`／`.d.ts`（`infra/.gitignore` で除外済み）。

## 構成（USM §7.1）

GitHub Pages（画面） → CloudFront → API Gateway（HTTP API） → Lambda（1関数） → DynamoDB（1テーブル）。性能より安さを優先する。

| ファイル | 内容 |
|---|---|
| `infra/lib/backend-stack.ts` | スタック本体 |
| `infra/lib/api-settings.ts` | 許可するオリジン、ルートごとの流量上限、キャッシュ秒数、鍵のパラメーター名 |
| `infra/lib/cost-budget.ts` | 予算アラート（`-c budgetEmail=<アドレス>` を指定したときだけ作る） |
| `infra/lambda/api/app.ts` | ルーティングと入力の検証（AWS に依存しない） |
| `infra/lambda/api/vote-service.ts` | 集計・残り枠・投票（`app/domain/` の判定を使う） |
| `infra/lambda/api/dynamo-vote-store.ts` | DynamoDB の読み書き |
| `infra/lambda/api/session-token.ts` | 署名付き匿名トークン |

守ること：

- **キャッシュするのは `GET /counts` だけ。** セッションを扱う応答には `Cache-Control: no-store` を付け、CloudFront の既定の振る舞いはキャッシュしない（他人の残り枠を返さないため）。テストで検証している。
- `GET /counts` は認証なしで呼べるようにする（トークンをキャッシュの条件に含めない）。
- セッショントークンは `X-Session-Token` ヘッダーで受け取る。`Authorization` ヘッダーは CloudFront の転送の制約があるため使わない。
- 上限の判定とセッションの記録・集計の加算は、DynamoDB のトランザクションで同時に行う。競合したら読み直す。
- セッションの記録は上限判定に要る分（直近12時間の投票時刻と票 ID）だけを持ち、TTL で消す。IP アドレスやトークンをログに残さない。API Gateway のアクセスログは有効にしない。
- 流量上限・DynamoDB の処理量の上限は、費用の上限も兼ねる。値を変えるときは最悪の月額への影響を説明してから変える。
- Lambda は AWS SDK も同梱してバンドルする（ランタイムに含まれる版の違いに左右されないため）。

## デプロイ

### 通常のデプロイ：GitHub Actions（`.github/workflows/infra.yml`）

- main への push のうち、`infra/**`・`app/domain/**`・`infra.yml` が変わったときに動く。
- 型チェック・テスト・合成の後、OIDC で AWS のロールを引き受け、`cdk diff` を残してから `cdk deploy` する。
- デプロイ先は今は `dev` だけ（prod への昇格は未定）。
- GitHub に設定するもの：変数 `AWS_DEPLOY_ROLE_ARN`（デプロイ用ロール）、変数 `API_BASE_URL`（画面のビルドに渡す API の URL）、シークレット `BUDGET_EMAIL`（予算アラートの通知先。公開リポジトリのため変数ではなくシークレットにする）。
- **main への push はそのまま AWS の変更になる。** infra に影響する変更を push する前に、ローカルで `cdk diff` の結果をユーザーに示して承認を得る。

### 初回だけ手元で行うこと

1. 署名用の鍵を SSM パラメータストアに SecureString で作る（CloudFormation では SecureString を作れないため手作業。初回だけ）。
   ```bash
   aws ssm put-parameter --type SecureString \
     --name /impulsive-momentum-indicator/<stage>/session-signing-key \
     --value "$(openssl rand -base64 48)"
   ```
   鍵を入れ替えると、すべてのトークンが無効になり、全員のセッションが新しくなる（上限もリセットされる）。
2. 初めてのアカウント・リージョンでは `npx cdk bootstrap` を実行する。
3. GitHub Actions 用の OIDC プロバイダーとデプロイ用ロールを作る：`npx cdk deploy ImpulsiveMomentumGithubDeploy`（アカウントに1つ）。出力 `DeployRoleArn` を GitHub の変数 `AWS_DEPLOY_ROLE_ARN` に設定する。
4. 初回のバックエンドを作る（手元からでも Actions からでもよい）：`npx cdk deploy ImpulsiveMomentumBackend-<stage> -c stage=<stage> -c budgetEmail=<アドレス>`。出力 `ApiBaseUrl` を GitHub の変数 `API_BASE_URL` に設定する。

1〜4 は AWS を変更する操作なので、どれも実行前に `cdk diff` などの内容を示してユーザーの承認を得る。

### デプロイ用ロールの権限

デプロイ用ロールは、CDK の初期設定で作られたロール（`cdk-hnb659fds-*`）を引き受けることだけを許可している。ただし、その先で CloudFormation が使う実行ロールは既定で管理者権限を持つため、**main ブランチで動くワークフローは実質的にこのアカウントの任意のリソースを変更できる。** main への push 権限を持つ人を限ること。

### 実装上の注意

- IAM の説明文（ロールの `description` など）は ASCII などに限られ、日本語を使うとデプロイ時の検証でエラーになる。英語で書く。

## 未確定事項（USM T-08）

- prod ステージを作るか、作るなら AWS アカウントを分けるか（今は dev だけで、公開中の画面も dev につながる）
