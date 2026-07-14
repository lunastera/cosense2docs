/**
 * ブロック / インラインノードを HTML 文字列に変換する。
 * コピーして Word / Google Docs に貼っても体裁が残るよう、
 * 装飾はインラインスタイルで出力する（プレビューの構造的な見た目は app.css 側）。
 */

import type { Block, InlineNode, Options } from "./parser";
import { parseBlocks, parseInline } from "./parser";

// Google Docs は font-family リストの先頭しか見ないため、
// Docs が持っているフォント（Courier New）を先頭にする
const MONO = "font-family:'Courier New',ui-monospace,Menlo,Consolas,monospace;";

const S = {
  code: `${MONO}font-size:.88em;background:#f1f3f5;border-radius:4px;padding:1px 5px;`,
  // コードブロックは 1 セルの表 + 1 行 1 段落で出力する。
  // <pre> は Google Docs への貼り付けで改行・空白が潰れて崩壊するが、
  // 表のセルは構造ごと保持される（Docs のコードブロック相当の見た目になる）
  preTable: "border-collapse:collapse;width:100%;margin:.5em 0;",
  preCell: `background:#f1f3f5;border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;`,
  preLine: `${MONO}font-size:.86em;line-height:1.6;margin:0;white-space:pre-wrap;`,
  preName: `font-size:.75em;color:#6b7280;margin:.6em 0 0;${MONO}`,
  quote:
    "border-left:3px solid #d1d5db;color:#57606a;margin:.4em 0;padding:.1em .9em;",
  note: "color:#6b7280;font-size:.88em;",
  gray: "color:#6b7280;",
  red: "color:#dc2626;",
  underline: "text-decoration:underline;text-underline-offset:3px;",
  mono: `${MONO}font-size:.88em;background:#f1f3f5;border-radius:4px;padding:1px 5px;`,
  blank: "text-decoration:underline;text-underline-offset:3px;white-space:pre;",
  hr: "border:none;border-top:1px solid #d1d5db;margin:1.1em 0;",
  table: "border-collapse:collapse;margin:.5em 0;",
  cell: "border:1px solid #d1d5db;padding:4px 10px;",
  icon: "color:#6b7280;font-size:.85em;",
} as const;

/**
 * コードブロック 1 行分の HTML（1 行 = 1 段落）。
 * Google Docs 等は貼り付け時に連続スペースを潰すため、
 * 字下げと連続スペースは nbsp で保持する。
 * 単語間の単独スペースは通常のスペースのまま残す（コピーした文面を汚さないため）。
 */
function preLine(line: string): string {
  const html = esc(line.replace(/\t/g, "    "))
    .replace(/^ +/, (m) => "\u00a0".repeat(m.length))
    .replace(/ {2,}/g, (m) => "\u00a0".repeat(m.length));
  // 空行は nbsp を入れて段落の高さを保つ
  return `<p style="${S.preLine}">${html || "\u00a0"}</p>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function nodesToHtml(nodes: InlineNode[]): string {
  let out = "";
  for (const n of nodes) {
    switch (n.t) {
      case "text":
        out += esc(n.v);
        break;
      case "code":
        out += `<code style="${S.code}">${esc(n.v)}</code>`;
        break;
      case "link":
        out += `<a href="${esc(n.href)}" target="_blank" rel="noopener">${esc(n.label)}</a>`;
        break;
      case "deco": {
        let inner = nodesToHtml(n.ch);
        if (n.b) inner = `<b>${inner}</b>`;
        if (n.i) inner = `<i>${inner}</i>`;
        if (n.s) inner = `<s>${inner}</s>`;
        out += inner;
        break;
      }
      case "styled": {
        const inner = nodesToHtml(n.ch);
        switch (n.style) {
          case "remove":
            break;
          case "plain":
            out += inner;
            break;
          default:
            out += `<span style="${S[n.style]}">${inner}</span>`;
        }
        break;
      }
      case "checkbox":
        out += "☐";
        break;
      case "blank":
        out += `<span style="${S.blank}">　　　　　　</span>`;
        break;
      case "icons":
        out += `<span style="${S.icon}">(${esc(n.names.join(", "))})</span>`;
        break;
      case "internal":
        // 変換対象にならなかったブラケットは原文のまま残す
        out += `<span class="internal">[${esc(n.v)}]</span>`;
        break;
    }
  }
  return out;
}

type ListItem = { level: number; nodes: InlineNode[] };

function listToHtml(
  items: ListItem[],
  idx: number,
  level: number,
): { html: string; idx: number } {
  let html = "<ul>";
  while (idx < items.length && items[idx].level >= level) {
    if (items[idx].level === level) {
      html += `<li>${nodesToHtml(items[idx].nodes)}`;
      idx++;
      if (idx < items.length && items[idx].level > level) {
        const r = listToHtml(items, idx, level + 1);
        html += r.html;
        idx = r.idx;
      }
      html += "</li>";
    } else {
      // インデントが飛んでいる場合
      const r = listToHtml(items, idx, level + 1);
      html += `<li style="list-style:none">${r.html}</li>`;
      idx = r.idx;
    }
  }
  return { html: `${html}</ul>`, idx };
}

export function blocksToHtml(blocks: Block[], opts: Options): string {
  let html = "";
  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi];
    switch (b.type) {
      case "blank":
        break;
      case "heading":
        html += `<h${b.level}>${nodesToHtml(b.nodes)}</h${b.level}>`;
        break;
      case "p":
        html += `<p>${nodesToHtml(b.nodes)}</p>`;
        break;
      case "li": {
        const items: ListItem[] = [];
        while (bi < blocks.length) {
          const cur = blocks[bi];
          if (cur.type !== "li") break;
          items.push({ level: Math.min(cur.level, 8), nodes: cur.nodes });
          bi++;
        }
        bi--;
        html += listToHtml(items, 0, 1).html;
        break;
      }
      case "quote":
        html += `<blockquote style="${S.quote}"><p style="margin:.2em 0">${nodesToHtml(b.nodes)}</p></blockquote>`;
        break;
      case "hr":
        html += `<hr style="${S.hr}">`;
        break;
      case "code": {
        if (b.name) html += `<p style="${S.preName}">${esc(b.name)}</p>`;
        const codeLines = (b.lines.length ? b.lines : [""])
          .map(preLine)
          .join("");
        html += `<table style="${S.preTable}"><tbody><tr><td style="${S.preCell}">${codeLines}</td></tr></tbody></table>`;
        break;
      }
      case "table": {
        if (b.name) html += `<p style="${S.preName}">${esc(b.name)}</p>`;
        html += `<table style="${S.table}">`;
        b.rows.forEach((row, ri) => {
          html += "<tr>";
          for (const cell of row) {
            const tag = ri === 0 ? "th" : "td";
            html += `<${tag} style="${S.cell}${ri === 0 ? "background:#f6f8fa;" : ""}">${nodesToHtml(parseInline(cell, opts))}</${tag}>`;
          }
          html += "</tr>";
        });
        html += "</table>";
        break;
      }
    }
  }
  return html;
}

export function convert(text: string, opts: Options): string {
  return blocksToHtml(parseBlocks(text, opts), opts);
}
