/**
 * Cosense（旧Scrapbox）記法のパーサー。
 * テキストをブロック（見出し・箇条書き・コードブロック等）と
 * インラインノード（太字・リンク・インラインコード等）のツリーに変換する。
 * レンダリング（HTML / docx）には依存しない。
 */

export type Options = {
  /** 非公式記法 [_] をチェックリスト項目に変換する */
  checklist: boolean;
  /** 非公式記法 [.icon] を記入欄に変換する */
  blank: boolean;
};

export type InlineNode =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "link"; href: string; label: string }
  | { t: "deco"; b?: boolean; i?: boolean; s?: boolean; ch: InlineNode[] }
  | { t: "note"; ch: InlineNode[] }
  | { t: "checkbox" }
  | { t: "blank" }
  | { t: "icon"; name: string }
  | { t: "internal"; v: string };

export type HeadingLevel = 1 | 2 | 3;

export type Block =
  | { type: "blank" }
  | { type: "heading"; level: HeadingLevel; nodes: InlineNode[] }
  | { type: "p"; nodes: InlineNode[] }
  | { type: "li"; level: number; nodes: InlineNode[] }
  | { type: "quote"; nodes: InlineNode[] }
  | { type: "hr" }
  | { type: "code"; name: string; lines: string[] }
  | { type: "table"; name: string; rows: string[][] };

/** Cosense は先頭の空白 1 文字 = 1 インデントレベル */
function leadingIndent(line: string): number {
  const m = line.match(/^[\t ]*/);
  return m ? m[0].length : 0;
}

export function parseBlocks(text: string, opts: Options): Block[] {
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  // base より深いインデントの行を収集する（間の空行は、後続がまだブロック内なら含める）
  const collectIndented = (base: number): string[] => {
    const out: string[] = [];
    let pendingBlank = 0;
    while (i < lines.length) {
      const l = lines[i];
      if (l.trim() === "") {
        pendingBlank++;
        i++;
        continue;
      }
      if (leadingIndent(l) > base) {
        for (let k = 0; k < pendingBlank; k++) out.push("");
        pendingBlank = 0;
        out.push(l.slice(base + 1));
        i++;
      } else break;
    }
    i -= pendingBlank; // ブロック外の空行は戻す
    return out;
  };

  while (i < lines.length) {
    const raw = lines[i];
    const indent = leadingIndent(raw);
    const content = raw.slice(indent);

    if (content.trim() === "") {
      blocks.push({ type: "blank" });
      i++;
      continue;
    }

    let m = content.match(/^code:(.*)$/);
    if (m) {
      i++;
      blocks.push({
        type: "code",
        name: m[1].trim(),
        lines: collectIndented(indent),
      });
      continue;
    }

    m = content.match(/^table:(.*)$/);
    if (m) {
      i++;
      const rows = collectIndented(indent)
        .filter((l) => l.trim() !== "")
        .map((l) => l.split("\t"));
      blocks.push({ type: "table", name: m[1].trim(), rows });
      continue;
    }

    if (content.startsWith(">")) {
      blocks.push({
        type: "quote",
        nodes: parseInline(content.slice(1).replace(/^ /, ""), opts),
      });
      i++;
      continue;
    }

    if (content.trim() === "[hr.icon]") {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    m = content.match(/^\[(\*+)\s+(.+)\]$/);
    if (m && indent === 0 && !m[2].includes("]")) {
      const s = m[1].length;
      const level: HeadingLevel = s >= 3 ? 1 : s === 2 ? 2 : 3;
      blocks.push({ type: "heading", level, nodes: parseInline(m[2], opts) });
      i++;
      continue;
    }

    if (indent > 0) {
      blocks.push({
        type: "li",
        level: indent,
        nodes: parseInline(content, opts),
      });
      i++;
      continue;
    }

    blocks.push({ type: "p", nodes: parseInline(content, opts) });
    i++;
  }
  return blocks;
}

const URL_RE = /^https?:\/\/\S+$/;

/** 裸の URL をリンク化しつつテキストノードを積む */
function pushText(nodes: InlineNode[], text: string): void {
  const re = /https?:\/\/[^\s　]+/g;
  let last = 0;
  let m = re.exec(text);
  while (m) {
    if (m.index > last) nodes.push({ t: "text", v: text.slice(last, m.index) });
    nodes.push({ t: "link", href: m[0], label: m[0] });
    last = m.index + m[0].length;
    m = re.exec(text);
  }
  if (last < text.length) nodes.push({ t: "text", v: text.slice(last) });
}

function bracketNode(inner: string, opts: Options): InlineNode | null {
  if (inner === "hr.icon") return { t: "text", v: "―――" };
  if (inner === "_") return opts.checklist ? { t: "checkbox" } : null;
  if (inner === ".icon") return opts.blank ? { t: "blank" } : null;

  // 装飾記法 [* ...] [/ ...] [- ...] [~ ...] と組み合わせ
  const m = inner.match(/^([*/\-~]+)[\t ]+([\s\S]+)$/);
  if (m) {
    const deco = m[1];
    const body = m[2];
    if (deco.includes("~")) return { t: "note", ch: parseInline(body, opts) };
    return {
      t: "deco",
      b: deco.includes("*"),
      i: deco.includes("/"),
      s: deco.includes("-"),
      ch: parseInline(body, opts),
    };
  }

  if (URL_RE.test(inner)) return { t: "link", href: inner, label: inner };

  const sp = inner.indexOf(" ");
  if (sp > 0) {
    const first = inner.slice(0, sp);
    const rest = inner.slice(sp + 1).trim();
    if (URL_RE.test(first))
      return { t: "link", href: first, label: rest || first };
    const lsp = inner.lastIndexOf(" ");
    const last = inner.slice(lsp + 1);
    if (URL_RE.test(last))
      return { t: "link", href: last, label: inner.slice(0, lsp).trim() };
  }

  if (/\.icon(\*\d+)?$/.test(inner)) {
    return { t: "icon", name: inner.replace(/\.icon(\*\d+)?$/, "") };
  }

  // 内部リンク [ページ名] / [/project/page] はテキストとして残す
  return { t: "internal", v: inner };
}

export function parseInline(s: string, opts: Options): InlineNode[] {
  const nodes: InlineNode[] = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      pushText(nodes, buf);
      buf = "";
    }
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "`") {
      const j = s.indexOf("`", i + 1);
      if (j > i) {
        flush();
        nodes.push({ t: "code", v: s.slice(i + 1, j) });
        i = j + 1;
        continue;
      }
    }
    if (c === "[" && s[i + 1] === "[") {
      const j = s.indexOf("]]", i + 2);
      if (j > 0) {
        flush();
        nodes.push({
          t: "deco",
          b: true,
          ch: [{ t: "text", v: s.slice(i + 2, j) }],
        });
        i = j + 2;
        continue;
      }
    }
    if (c === "[") {
      const j = s.indexOf("]", i + 1);
      if (j > 0) {
        const node = bracketNode(s.slice(i + 1, j), opts);
        if (node) {
          flush();
          nodes.push(node);
          i = j + 1;
          continue;
        }
      }
    }
    buf += c;
    i++;
  }
  flush();
  return nodes;
}

/** インラインノード列からプレーンテキストを取り出す（ファイル名生成などに使用） */
export function nodesToPlainText(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      switch (n.t) {
        case "text":
        case "internal":
          return n.v;
        case "code":
          return n.v;
        case "link":
          return n.label;
        case "deco":
        case "note":
          return nodesToPlainText(n.ch);
        case "icon":
          return n.name;
        default:
          return "";
      }
    })
    .join("");
}
