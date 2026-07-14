/**
 * ブロック / インラインノードを Markdown に変換する。
 *
 * Google Docs の「編集 → マークダウンから貼り付け」を想定した出力。
 * コードブロックはフェンス（```）になり、Docs のネイティブなコードブロック
 * （スマートキャンバス要素）として貼り付けられる。見出し・チェックリスト・
 * テーブルも Docs のネイティブ要素に変換される。
 * 色・下線などスタイル系プリセットは Markdown で表現できないため中身のみ残す。
 */

import type { Block, InlineNode, Options } from "./parser";
import { parseBlocks, parseInline } from "./parser";

/** Markdown の特殊文字をエスケープする */
function escMd(s: string): string {
  return s.replace(/([\\`*_~[\]])/g, "\\$1");
}

export function nodesToMarkdown(nodes: InlineNode[]): string {
  let out = "";
  for (const n of nodes) {
    switch (n.t) {
      case "text":
        out += escMd(n.v);
        break;
      case "code":
        out += `\`${n.v}\``;
        break;
      case "link":
        out += `[${escMd(n.label)}](${n.href})`;
        break;
      case "deco": {
        let inner = nodesToMarkdown(n.ch);
        if (n.b) inner = `**${inner}**`;
        if (n.i) inner = `*${inner}*`;
        if (n.s) inner = `~~${inner}~~`;
        out += inner;
        break;
      }
      case "styled":
        switch (n.style) {
          case "remove":
            break;
          case "mono":
            out += `\`${nodesToMarkdown(n.ch).replace(/\\([\\`*_~[\]])/g, "$1")}\``;
            break;
          default:
            // 色・サイズ等は Markdown で表現できないので中身だけ残す
            out += nodesToMarkdown(n.ch);
        }
        break;
      case "checkbox":
        out += n.checked ? "☑" : "☐";
        break;
      case "blank":
        out += "＿＿＿＿＿＿";
        break;
      case "icons":
        out += `(${n.names.join(", ")})`;
        break;
      case "internal":
        out += `\\[${escMd(n.v)}\\]`;
        break;
    }
  }
  return out;
}

/** 箇条書き項目。先頭がチェックボックスなら Docs のチェックリストになる - [ ] / - [x] 形式 */
function listItemMd(nodes: InlineNode[]): string {
  const head = nodes[0];
  if (head?.t === "checkbox") {
    const rest = nodes.slice(1);
    if (rest[0]?.t === "text") {
      rest[0] = { t: "text", v: rest[0].v.replace(/^ /, "") };
    }
    return `[${head.checked ? "x" : " "}] ${nodesToMarkdown(rest)}`;
  }
  return nodesToMarkdown(nodes);
}

export function blocksToMarkdown(blocks: Block[], opts: Options): string {
  const lines: string[] = [];
  // 見出し・コードフェンス等の前に空行を保証する（Markdown パーサ対策）
  const ensureBlank = () => {
    if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
  };

  for (const b of blocks) {
    switch (b.type) {
      case "blank":
        if (lines[lines.length - 1] !== "") lines.push("");
        break;
      case "heading":
        ensureBlank();
        lines.push(`${"#".repeat(b.level)} ${nodesToMarkdown(b.nodes)}`);
        break;
      case "p":
        lines.push(nodesToMarkdown(b.nodes));
        break;
      case "li":
        lines.push(`${"    ".repeat(b.level - 1)}- ${listItemMd(b.nodes)}`);
        break;
      case "quote":
        lines.push(`> ${nodesToMarkdown(b.nodes)}`);
        break;
      case "hr":
        ensureBlank();
        lines.push("---");
        break;
      case "code":
        ensureBlank();
        if (b.name) lines.push(`*${escMd(b.name)}*`);
        lines.push("```");
        for (const l of b.lines) lines.push(l);
        lines.push("```");
        break;
      case "table": {
        ensureBlank();
        if (b.name) lines.push(`*${escMd(b.name)}*`);
        const cols = Math.max(...b.rows.map((r) => r.length), 1);
        const row = (cells: string[]) =>
          `| ${Array.from({ length: cols }, (_, i) =>
            nodesToMarkdown(parseInline(cells[i] || "", opts)),
          ).join(" | ")} |`;
        const [head, ...rest] = b.rows.length ? b.rows : [[""]];
        lines.push(row(head));
        lines.push(`|${" --- |".repeat(cols)}`);
        for (const r of rest) lines.push(row(r));
        break;
      }
    }
  }
  return `${lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`;
}

export function convertMarkdown(text: string, opts: Options): string {
  return blocksToMarkdown(parseBlocks(text, opts), opts);
}
