# impulsive-momentum-indicator

> 世界の空気を、衝動で測る。

政治・経済・天候・国際情勢など、社会や世界に対して人々が抱く衝動（一揆したい／革命したい／国外脱出したい／祭りたい）を集め、その数で世の中の空気を測る Web アプリです。

公開ページ：https://hicoichi.github.io/impulsive-momentum-indicator/

**現在はフェーズ1（モック）です。** 表示される数値はすべて模擬データで、実際の集計ではありません。バックエンドはフェーズ2で AWS 上に構築します。

## 必要なもの

- Node.js 24 系（`.nvmrc`）
- npm

## 使い方

```bash
npm install          # 依存関係のインストール
npm run dev          # 開発サーバー（http://localhost:3000）
```

## 検査

```bash
npm run lint         # ESLint
npm run typecheck    # 型チェック
npm test             # 単体テスト（Vitest）
npm run generate     # 静的生成（.output/public）
npm run test:e2e     # E2E テスト（Playwright）。先に npm run generate が必要
```

E2E テストを初めて実行するときは、ブラウザと必要なシステムライブラリをインストールします。

```bash
npx playwright install --with-deps chromium
```

## 検証用の設定

ビルド時の環境変数でだけ切り替えられます。**公開用ビルドでは設定しません。**

| 環境変数 | 値 | 既定値 | 内容 |
|---|---|---|---|
| `NUXT_PUBLIC_VOTE_WINDOW` | `12h`／`60s` | `12h` | 集計ウィンドウ。`60s` にすると上限と回復を短時間で確認できる |
| `NUXT_PUBLIC_SHOW_PIPS` | `true`／`false` | `true` | 残り投票枠（ピップ）の表示 |

```bash
NUXT_PUBLIC_VOTE_WINDOW=60s npm run dev
```

## リリース

main に push すると GitHub Actions（`.github/workflows/release.yml`）が検査と静的生成を行い、次の2つに公開します。

- **GitHub Pages**：push のたびに更新します。
- **GitHub Release**：`package.json` の `version` をタグにして作成します。同じバージョンのリリースがすでにある場合は作りません。**リリースするときは `version` を上げてから push してください。**

## ドキュメント

- [ユーザーストーリーマップ](docs/user-story-map.md)：仕様、受け入れ条件、未確定事項
- [CLAUDE.md](CLAUDE.md)：開発ルール
- [.claude/rules/](.claude/rules/)：技術スタックとコーディング規約
