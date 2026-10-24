# 技術スタック

凡例：**【確定】** = 指示で確定済み／**【暫定】** = 提案段階。`docs/user-story-map.md` §9.2 の T-xx でユーザーの確認待ち。暫定項目を変更・確定したら、このファイルと USM の両方を更新する。

## 構成の前提【確定】

| 項目 | 方針 |
|---|---|
| フロントエンド | Nuxt ベースの Web アプリケーション |
| バックエンド | フェーズ1はなし（API・サーバーサイド処理を作らない）。フェーズ2で AWS 上に構築する。IaC は AWS CDK（TypeScript）で、同じリポジトリの `infra/` に置く（規約は `.claude/rules/infra.md`）。サービス構成は T-08 で未定 |
| データベース | フェーズ1はなし。フェーズ2で AWS 上に用意する |
| 集計 | 実際の複数ユーザー間の集計は行わない。モックデータで表現する |
| 対象デバイス | モバイル主軸、PC にも対応するレスポンシブ UI |

- Nuxt の `server/` ディレクトリ（Nitro の API ルート）は使わない。
- 外部 API・外部データソースへの通信を行わない（Web フォントの読み込みを除く。T-06）。

## ランタイムとツール【暫定】

2026-10-17 時点で npm から確認したバージョンを基準にする。モックの実装（2026-10-24）では、下表の暫定案のまま導入した。

| 項目 | 暫定案 | 確認 ID | 補足 |
|---|---|---|---|
| Nuxt | 4 系（確認時の最新 4.6.2） | T-01 | Nuxt 4 のディレクトリ構成（`app/`）を使う |
| Vue | Nuxt が依存するバージョン（確認時 3.5 系） | T-01 | 個別に固定しない |
| Node.js | 24 系（開発環境 v24.18.0） | T-01 | `.nvmrc` または `package.json` の `engines` で明示する |
| 言語 | TypeScript 5.9 系（strict） | T-02 | 最新の 7 系は vue-tsc（`nuxt typecheck`）との組み合わせが未確認のため、5.9 系に固定している |
| パッケージマネージャー | npm | T-03 | 開発環境に pnpm が入っていないため。lockfile は1種類だけコミットする |
| 単体テスト | Vitest ＋ `@vue/test-utils` ＋ `@vitejs/plugin-vue` ＋ happy-dom | T-04 | Nuxt を起動せずに動かす。テスト対象のコードは Nuxt の自動インポートに頼らず、明示的に import する。`@nuxt/test-utils` は不要だったため導入していない |
| E2E テスト | Playwright | T-04 | 静的生成した `.output/public` を Node 標準の小さなサーバー（`tests/e2e/static-server.mjs`）で配信し、スマホ（390×844）と PC（1280×800）の2ビューポートで実行。時計は `page.clock` で止めて進める |
| Lint／整形 | `@nuxt/eslint`（ESLint flat config） | — | 整形ルールも ESLint に寄せ、Prettier は導入しない |
| レンダリング | 静的生成（`nuxt generate`）、SSR なしの静的ホスティング | T-05 | バックエンドがないため |
| デプロイ先 | GitHub Pages【確定】 | T-05 | https://hicoichi.github.io/impulsive-momentum-indicator/ 。サブパス配信のため `NUXT_APP_BASE_URL` を指定して書き出す |
| Web フォント | Dela Gothic One／IBM Plex Mono／IBM Plex Sans JP を Google Fonts から読み込む | T-06 | モックと同じ。セルフホストへの変更は T-06 で判断 |

## リリース（フェーズ1）

- `.github/workflows/release.yml`：main への push で起動する。lint・型チェック・単体テスト・静的生成・E2E テストの後、`.output/public` を zip にまとめて GitHub Release として公開する。
- タグは `package.json` の `version` から作る（`v1.2.3`）。同じタグのリリースがすでにあれば、リリースは作らない。**リリースするときは `version` を上げてから main に push する。**
- 公開用ビルドでは検証用の環境変数（`NUXT_PUBLIC_VOTE_WINDOW`、`NUXT_PUBLIC_SHOW_PIPS`）を設定しない。設定されていた場合、ワークフローは失敗する。
- 検査はすべて必須で、どれかが失敗するとリリースも Pages の更新もしない。
- 公開する画面（Release の zip と Pages）は、GitHub の変数 `API_BASE_URL` があれば API 接続版、なければモック版。E2E はモック版（`tests/e2e/main.spec.ts`）と、API への通信をスタブした API 接続版（`tests/e2e/api.spec.ts`。`E2E_API_BASE_URL` を指定したときだけ動く）の両方を通す。
- バックエンドは `.github/workflows/infra.yml` が検査とデプロイを行う（`.claude/rules/infra.md` の「デプロイ」）。
- GitHub Pages：main への push のたびに更新する（Release と違い、`version` を上げなくても更新される）。Release の zip はルートで動く版、Pages はサブパス（`/impulsive-momentum-indicator/`）版で、それぞれ書き出して E2E を通してから公開する。
- E2E をサブパスで確かめるときは `E2E_BASE_PATH=/impulsive-momentum-indicator/` を指定する（書き出し時の `NUXT_APP_BASE_URL` と合わせる）。

## 採用しないもの

明確な必要が生じるまで導入しない。導入する場合は事前にユーザーに確認する。

- 状態管理ライブラリ（Pinia 等）：画面が1つで状態が小さいため、composable と `useState` で足りる
- UI コンポーネントライブラリ・CSS フレームワーク（Tailwind、Vuetify 等）：モックの独自デザインを再現するため
- アニメーションライブラリ：CSS アニメーションで実装する（モックと同じ）
- 日付ライブラリ：12時間の判定はミリ秒の数値比較で足りる
- グラフ・可視化ライブラリ：グラフは禁止事項のため不要
- 認証・分析・広告・トラッキング関連の SDK

## 依存関係の追加ルール

- 新しい依存を追加する前に、上の「採用しないもの」に当たらないか、標準 API や既存の依存で代替できないかを確認する。
- 追加したら理由をこのファイルに追記する。
- `infra/` の依存：AWS SDK v3（DynamoDB、SSM。Lambda に同梱する）、`@types/aws-lambda`、esbuild（Lambda のバンドル。Docker を使わないため）。
- npm 11 は依存パッケージのインストールスクリプトを既定で保留する。現在、esbuild と unrs-resolver のスクリプトが保留のままだが、ビルド・テストは動いている。許可する場合は `npm approve-scripts` を使い、事前にユーザーに確認する。
