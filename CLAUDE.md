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
- **Local state only**: 入力テキストとオプションは localStorage に保存（`cosense2docs:src` / `cosense2docs:opts`）

## Key Files

- `app/routes/home.tsx`: Single page (textarea + preview + toolbar)
- `app/lib/parser.ts`: Cosense 記法パーサー。ブロック（見出し・箇条書き・code:・table: 等）とインラインノード（装飾・リンク・コード等）の型定義もここ
- `app/lib/render-html.ts`: HTML 出力。コピーして Word / Google Docs に貼れるよう装飾はインラインスタイル
- `app/lib/render-docx.ts`: docx 出力（`docx` パッケージ）。ファイル名決定ロジック（`docName`）もここ
- `app/lib/sample.ts`: 初回表示のサンプルテキスト。実在の人名・プロダクト名は載せない
- `app/components/Toolbar.tsx`: トグル（非公式記法の変換オプション）・ファイル名・コピー/ダウンロードボタン

## Conversion Semantics

- 行全体が `[* 文言]`（インデントなし）のときだけ見出し。`***`=h1, `**`=h2, `*`=h3。文中の `[* ...]` は太字
- 先頭の空白 1 文字 = 箇条書き 1 レベル（Cosense 仕様）
- `[_]`（チェックリスト）と `[.icon]`（記入欄）は Cosense 非公式のためトグルで有効/無効を切り替える。新たな非公式変換を足すときも同様に `Options` に追加してトグルにする

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
