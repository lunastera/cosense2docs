/**
 * ブロック / インラインノードを HTML 文字列に変換する。
 * コピーして Word / Google Docs に貼っても体裁が残るよう、
 * 装飾はインラインスタイルで出力する（プレビューの構造的な見た目は app.css 側）。
 */

import type { Block, InlineNode, Options } from "./parser";
import { parseBlocks, parseInline } from "./parser";

const S = {
  code: "font-family:ui-monospace,SF Mono,Menlo,Consolas,monospace;font-size:.88em;background:#f1f3f5;border-radius:4px;padding:1px 5px;",
  pre: "font-family:ui-monospace,SF Mono,Menlo,Consolas,monospace;font-size:.86em;background:#f1f3f5;border-radius:6px;padding:12px 14px;overflow-x:auto;line-height:1.6;margin:.5em 0;white-space:pre;",
  preName:
    "font-size:.75em;color:#6b7280;margin:.6em 0 0;font-family:ui-monospace,Menlo,Consolas,monospace;",
  quote:
    "border-left:3px solid #d1d5db;color:#57606a;margin:.4em 0;padding:.1em .9em;",
  note: "color:#6b7280;font-size:.88em;",
  blank: "text-decoration:underline;text-underline-offset:3px;white-space:pre;",
  hr: "border:none;border-top:1px solid #d1d5db;margin:1.1em 0;",
  table: "border-collapse:collapse;margin:.5em 0;",
  cell: "border:1px solid #d1d5db;padding:4px 10px;",
  icon: "color:#6b7280;font-size:.85em;",
} as const;

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
      case "note":
        out += `<span style="${S.note}">${nodesToHtml(n.ch)}</span>`;
        break;
      case "checkbox":
        out += "☐";
        break;
      case "blank":
        out += `<span style="${S.blank}">　　　　　　</span>`;
        break;
      case "icon":
        out += `<span style="${S.icon}">[${esc(n.name)}]</span>`;
        break;
      case "internal":
        out += `<span class="internal">${esc(n.v)}</span>`;
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
      case "code":
        if (b.name) html += `<p style="${S.preName}">${esc(b.name)}</p>`;
        html += `<pre style="${S.pre}">${esc(b.lines.join("\n"))}</pre>`;
        break;
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
