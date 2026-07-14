# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

cosense2docs: Cosense（旧Scrapbox）記法を貼り付けると整形済みプレビューと .docx に変換する静的 SPA。変換はすべてブラウザ内で完結し、入力テキストは外部送信されない。

## Technology Stack

React Router v8, React 19, TypeScript, Tailwind CSS v4, Vite, Biome, Vitest, docx

## Architecture

- **SPA mode**: `ssr: false` in `react-router.config.ts`; single page (`app/routes/home.tsx`), no page transitions
- **GitHub Pages**: Base path auto-detected from repository name via `GITHUB_REPOSITORY` environment variable
- **3-stage conversion**: `parser.ts`（記法 → ブロック/インラインノードのツリー）→ `render-html.ts` / `render-docx.ts`（ツリー → 出力）。パーサーはレンダラーに依存しない
- **Local state only**: 入力テキスト・オプション・拡張ルールは localStorage に保存（`cosense2docs:src` / `cosense2docs:opts` / `cosense2docs:rules`）

## Key Files

- `app/routes/home.tsx`: Single page (textarea + preview + toolbar)
- `app/lib/parser.ts`: Cosense 記法パーサー。ブロック（見出し・箇条書き・code:・table: 等）とインラインノード（装飾・リンク・コード等）の型定義もここ
- `app/lib/render-html.ts`: HTML 出力。コピーして Word / Google Docs に貼れるよう装飾はインラインスタイル。コードブロックは Docs 貼り付けで崩れない「1 セルの表 + 1 行 1 段落」構造（`<pre>` は Docs が改行・空白を潰す）
- `app/lib/render-markdown.ts`: Markdown 出力。Google Docs の「編集 → マークダウンから貼り付け」用で、コードブロックが Docs ネイティブのコードブロックになる
- `app/lib/render-docx.ts`: docx 出力（`docx` パッケージ）。ファイル名決定ロジック（`docName`）もここ
- `app/lib/sample.ts`: 初回表示のサンプルテキスト。実在の人名・プロダクト名は載せない
- `app/components/Toolbar.tsx`: タイトルトグル・拡張ルール開閉・ファイル名・コピー/ダウンロードボタン
- `app/components/RulesPanel.tsx`: 拡張ルールの編集 UI（追加・削除・有効切替・正規表現エラー表示）

## Conversion Semantics

- 行全体が `[* 文言]`（インデントなし）のときだけ見出し。`***`=h1, `**`=h2, `*`=h3。文中の `[* ...]` は太字
- 先頭の空白 1 文字 = 箇条書き 1 レベル（Cosense 仕様）
- 非公式な変換はすべてユーザー編集可能な「拡張ルール」（`CustomRule`: ブラケット中身の正規表現 → プリセット効果）。`[_]` / `[.icon]` / `[~ ...]` は `DEFAULT_RULES` として提供。ルールは公式記法より先に評価される
- プリセット（`EffectId`）は HTML / docx の両方で再現できるものに限る。`CustomRule.kind` は将来の高度なモード（自由な変換定義）追加を見据えた判別用フィールドで、現状 "preset" のみ
- 「1行目をタイトル（H1）にする」はトグル（デフォルト有効）。Cosense のページ全体コピーでは 1 行目がページタイトルになるため
- 変換対象にならなかったブラケット（内部リンク等）は `[ページ名]` の形のまま残す

## Development Commands

```bash
npm run dev        # Start dev server
npm run build      # Build for production
npm run typecheck  # Type checking
npm test           # Run unit tests (vitest)
npm run check      # Lint + format with auto-fix
```

## GitHub Actions

- **`deploy-pages.yml`**: Deploys `build/client/` to GitHub Pages on push to main
- **`test.yaml`**: Type check, unit tests, lint (warnings only), and build on push/PR
