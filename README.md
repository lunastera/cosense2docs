# cosense2docs

Cosense（旧Scrapbox）記法を貼り付けると、整形済みプレビューと .docx に変換する静的 SPA。

- 変換はすべてブラウザ内で完結し、入力テキストは外部送信されない
- GitHub Pages にそのままデプロイできる（main への push で自動デプロイ）

## 使い方

左ペインに Cosense のテキストを貼り付ける。

- **プレビューをコピー** — リッチテキストとしてコピー。Google Docs / Word にそのまま貼り付けられる
- **HTML をコピー** — 整形済み HTML ソースをコピー
- **.docx をダウンロード** — Word 文書として保存。ファイル名は未入力なら先頭の見出しから自動生成

入力とオプションは localStorage に保存され、次回開いたときに復元される。

## 対応記法

| Cosense 記法 | 変換結果 |
| --- | --- |
| `[*** 見出し]` / `[** 見出し]` / `[* 見出し]` | 見出し（大 / 中 / 小）。行全体が見出しのときのみ。文中の `[* ...]` は太字 |
| `[[太字]]` | 太字 |
| `[/ 斜体]` `[- 取り消し]` `[*/ 組み合わせ]` | 斜体 / 取り消し線 / 組み合わせ |
| `[~ 注記]` | 補足表示（グレーの小さめテキスト） |
| `[表示名 URL]` / `[URL 表示名]` / 裸の URL | ハイパーリンク |
| `` `インラインコード` `` | 等幅 + 背景色 |
| `code:ファイル名` + インデント行 | コードブロック |
| `table:名前` + タブ区切り行 | テーブル（先頭行はヘッダー） |
| タブ / スペースのインデント | 箇条書き（階層対応） |
| `> テキスト` | 引用 |
| `[hr.icon]` | 区切り線 |
| `[name.icon]`（ユーザーアイコン） | `(name)` 表記。空白を挟んだ連続は `(a, b)` にまとめ、`*n` や同名の繰り返しは重複除去 |
| `[ページ名]`（内部リンク） | テキストとして残す |

## オプション（非公式記法の変換）

Cosense の正式機能ではない記法の変換は、ツールバーのトグルで有効 / 無効を切り替えられる。

| 記法 | 有効時の変換結果 |
| --- | --- |
| `[_]` | チェックリスト項目（☐） |
| `[.icon]` | 記入欄（下線付きの空欄） |

## 開発

React Router v8 (SPA mode) + React 19 + TypeScript + Tailwind CSS v4 + Vite + Biome + Vitest。

```bash
npm install
npm run dev        # 開発サーバー
npm run typecheck  # 型チェック
npm test           # ユニットテスト
npm run check      # lint + format（自動修正）
npm run build      # プロダクションビルド（build/client/ に出力）
```

変換ロジックは `app/lib/` にある。`parser.ts`（記法 → ノードツリー）→ `render-html.ts` / `render-docx.ts`（ツリー → 出力）の 3 段構成。

## デプロイ

main ブランチへの push で `.github/workflows/deploy-pages.yml` が `build/client/` を GitHub Pages にデプロイする。リポジトリの Settings → Pages で Source を「GitHub Actions」にしておくこと。
