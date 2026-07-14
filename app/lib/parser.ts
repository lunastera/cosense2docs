/**
 * Cosense（旧Scrapbox）記法のパーサー。
 * テキストをブロック（見出し・箇条書き・コードブロック等）と
 * インラインノード（太字・リンク・インラインコード等）のツリーに変換する。
 * レンダリング（HTML / docx）には依存しない。
 *
 * Cosense の公式記法（装飾・リンク・コード等）の解釈は固定で、
 * 非公式な変換はすべてユーザー定義の「拡張ルール」（CustomRule）として扱う。
 */

/** 拡張ルールの変換方法（プリセット）。HTML / docx の両方で再現できるものに限る */
export type EffectId =
  | "note"
  | "checkbox"
  | "blank"
  | "bold"
  | "italic"
  | "strike"
  | "underline"
  | "gray"
  | "red"
  | "mono"
  | "plain"
  | "remove";

/**
 * ユーザー定義の拡張変換ルール。
 * ブラケット [ ] の中身がパターンに完全一致したら、プリセットの変換方法を適用する。
 * パターンに捕捉グループがあれば $1 が表示テキストになり、なければ中身全体を使う。
 */
export type CustomRule = {
  id: string;
  enabled: boolean;
  /** ブラケット [ ] の中身全体にマッチする正規表現（^ $ は自動で付く） */
  pattern: string;
  /**
   * 変換方法の種別。現状はプリセット選択（"preset"）のみ。
   * 将来、変換定義を自由に書く高度なモードを追加する際は
   * ここに別の kind を足して判別する。
   */
  kind: "preset";
  effect: EffectId;
};

/** 初期状態で用意する拡張ルール（ユーザーが編集・削除できる） */
export const DEFAULT_RULES: CustomRule[] = [
  {
    id: "checklist",
    enabled: true,
    pattern: "_",
    kind: "preset",
    effect: "checkbox",
  },
  {
    id: "blank",
    enabled: true,
    pattern: "\\.icon",
    kind: "preset",
    effect: "blank",
  },
  {
    id: "note",
    enabled: true,
    pattern: "~ (.+)",
    kind: "preset",
    effect: "note",
  },
];

export type Options = {
  /**
   * 最初の行をタイトル（H1）にする。
   * Cosense でページ全体を選択コピーすると 1 行目がページタイトルになるため。
   */
  firstLineTitle: boolean;
  /** 拡張変換ルール（上から順に評価し、最初にマッチしたものを適用する） */
  rules: CustomRule[];
};

/** 中身つきのスタイル系プリセットに対応するノードのスタイル */
export type StyledStyle =
  | "note"
  | "underline"
  | "gray"
  | "red"
  | "mono"
  | "plain"
  | "remove";

export type InlineNode =
  | { t: "text"; v: string }
  | { t: "code"; v: string }
  | { t: "link"; href: string; label: string }
  | { t: "deco"; b?: boolean; i?: boolean; s?: boolean; ch: InlineNode[] }
  | { t: "styled"; style: StyledStyle; ch: InlineNode[] }
  | { t: "checkbox" }
  | { t: "blank" }
  | { t: "icons"; names: string[] }
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

/** ルールのパターンが正規表現として妥当かを検証し、エラーメッセージか null を返す */
export function validateRulePattern(pattern: string): string | null {
  try {
    new RegExp(pattern);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

type CompiledRule = { re: RegExp; effect: EffectId };

/** パース中に引き回す文脈。ルールはここでコンパイル済みにしておく */
type Ctx = { compiled: CompiledRule[] };

/** 不正な正規表現・無効化されたルールは除外してコンパイルする */
function makeCtx(opts: Options): Ctx {
  const compiled: CompiledRule[] = [];
  for (const r of opts.rules) {
    if (!r.enabled) continue;
    try {
      compiled.push({ re: new RegExp(`^(?:${r.pattern})$`), effect: r.effect });
    } catch {
      // 不正なパターンはスキップ（UI 側で validateRulePattern により警告する）
    }
  }
  return { compiled };
}

/** Cosense は先頭の空白 1 文字 = 1 インデントレベル */
function leadingIndent(line: string): number {
  const m = line.match(/^[\t ]*/);
  return m ? m[0].length : 0;
}

export function parseBlocks(text: string, opts: Options): Block[] {
  const ctx = makeCtx(opts);
  const lines = String(text).replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  if (opts.firstLineTitle && lines.length > 0 && lines[0].trim() !== "") {
    blocks.push({
      type: "heading",
      level: 1,
      nodes: inline(lines[0].trim(), ctx),
    });
    i = 1;
  }

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
        nodes: inline(content.slice(1).replace(/^ /, ""), ctx),
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
      blocks.push({ type: "heading", level, nodes: inline(m[2], ctx) });
      i++;
      continue;
    }

    // コマンドライン記法: $ （または %）で始まる行は行全体をインラインコード扱い
    const nodes: InlineNode[] = /^[$%] /.test(content)
      ? [{ t: "code", v: content }]
      : inline(content, ctx);

    if (indent > 0) {
      blocks.push({ type: "li", level: indent, nodes });
      i++;
      continue;
    }

    blocks.push({ type: "p", nodes });
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

/** 拡張ルールのプリセットをインラインノードに落とす */
function effectNode(effect: EffectId, content: string, ctx: Ctx): InlineNode {
  switch (effect) {
    case "checkbox":
      return { t: "checkbox" };
    case "blank":
      return { t: "blank" };
    case "bold":
      return { t: "deco", b: true, ch: inline(content, ctx) };
    case "italic":
      return { t: "deco", i: true, ch: inline(content, ctx) };
    case "strike":
      return { t: "deco", s: true, ch: inline(content, ctx) };
    case "remove":
      return { t: "styled", style: "remove", ch: [] };
    default:
      return { t: "styled", style: effect, ch: inline(content, ctx) };
  }
}

function bracketNode(inner: string, ctx: Ctx): InlineNode | null {
  // 拡張ルールを公式記法より先に評価する（[_] や [~ ...] を上書きできるようにするため）
  for (const rule of ctx.compiled) {
    const m = rule.re.exec(inner);
    if (m) return effectNode(rule.effect, m[1] ?? inner, ctx);
  }

  if (inner === "hr.icon") return { t: "text", v: "―――" };

  // 装飾記法 [* ...] [/ ...] [- ...] と組み合わせ
  const m = inner.match(/^([*/-]+)[\t ]+([\s\S]+)$/);
  if (m) {
    const deco = m[1];
    const body = m[2];
    return {
      t: "deco",
      b: deco.includes("*"),
      i: deco.includes("/"),
      s: deco.includes("-"),
      ch: inline(body, ctx),
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

  const icon = inner.match(/^(.+?)\.icon(\*\d+)?$/);
  if (icon) {
    return { t: "icons", names: [icon[1]] };
  }

  // 内部リンク [ページ名] / [/project/page] はテキストとして残す
  return { t: "internal", v: inner };
}

/**
 * 連続するアイコン（間の空白のみのテキストを含む）を 1 つの icons ノードにまとめる。
 * 「同意 [a.icon] [b.icon]」のような並びを (a, b) と表示するため。
 * 同じ名前の繰り返し（[a.icon*3] や [a.icon][a.icon]）は 1 つに重複除去する。
 */
function groupIcons(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  let i = 0;
  while (i < nodes.length) {
    const n = nodes[i];
    if (n.t !== "icons") {
      out.push(n);
      i++;
      continue;
    }
    const names = [...n.names];
    let j = i + 1;
    while (j < nodes.length) {
      const next = nodes[j];
      if (next.t === "icons") {
        names.push(...next.names);
        j++;
        continue;
      }
      // 空白のみのテキストは、その先にまたアイコンが続く場合だけ吸収する
      if (
        next.t === "text" &&
        /^[\s　]+$/.test(next.v) &&
        nodes[j + 1]?.t === "icons"
      ) {
        j++;
        continue;
      }
      break;
    }
    out.push({ t: "icons", names: [...new Set(names)] });
    i = j;
  }
  return out;
}

function inline(s: string, ctx: Ctx): InlineNode[] {
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
        const node = bracketNode(s.slice(i + 1, j), ctx);
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
  return groupIcons(nodes);
}

export function parseInline(s: string, opts: Options): InlineNode[] {
  return inline(s, makeCtx(opts));
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
        case "styled":
          return nodesToPlainText(n.ch);
        case "icons":
          return n.names.join(", ");
        default:
          return "";
      }
    })
    .join("");
}
