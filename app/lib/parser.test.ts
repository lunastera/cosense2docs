import { describe, expect, it } from "vitest";
import {
  type CustomRule,
  DEFAULT_RULES,
  nodesToPlainText,
  type Options,
  parseBlocks,
  parseInline,
} from "./parser";

const opts: Options = { firstLineTitle: false, rules: DEFAULT_RULES };

/** デフォルトルールのうち id のものを無効化した Options */
function withoutRule(id: string): Options {
  return {
    ...opts,
    rules: DEFAULT_RULES.map((r) =>
      r.id === id ? { ...r, enabled: false } : r,
    ),
  };
}

/** 追加ルールつきの Options */
function withRule(
  rule: Partial<CustomRule> & Pick<CustomRule, "pattern" | "effect">,
): Options {
  return {
    ...opts,
    rules: [
      { id: "test", enabled: true, kind: "preset", ...rule },
      ...DEFAULT_RULES,
    ],
  };
}

describe("parseBlocks", () => {
  it("firstLineTitle 有効時は最初の行をタイトル（H1）にする", () => {
    const blocks = parseBlocks("ページタイトル\n本文です", {
      ...opts,
      firstLineTitle: true,
    });
    expect(blocks[0]).toMatchObject({ type: "heading", level: 1 });
    expect(blocks[1]).toMatchObject({ type: "p" });
  });

  it("firstLineTitle 有効でも最初の行が空ならタイトルにしない", () => {
    const blocks = parseBlocks("\n本文です", { ...opts, firstLineTitle: true });
    expect(blocks[0]).toMatchObject({ type: "blank" });
    expect(blocks[1]).toMatchObject({ type: "p" });
  });

  it("firstLineTitle 無効時は最初の行を通常どおり扱う", () => {
    expect(parseBlocks("ページタイトル", opts)[0]).toMatchObject({ type: "p" });
  });

  it("行全体の [*** ] [** ] [* ] を見出しにする", () => {
    expect(parseBlocks("[*** タイトル]", opts)[0]).toMatchObject({
      type: "heading",
      level: 1,
    });
    expect(parseBlocks("[** 見出し]", opts)[0]).toMatchObject({
      type: "heading",
      level: 2,
    });
    expect(parseBlocks("[* 小見出し]", opts)[0]).toMatchObject({
      type: "heading",
      level: 3,
    });
  });

  it("リンクを入れ子にした装飾も行全体なら見出しになる", () => {
    const blocks = parseBlocks("[** 会場は[こちら https://example.com]]", opts);
    expect(blocks[0]).toMatchObject({
      type: "heading",
      level: 2,
      nodes: [
        { t: "text", v: "会場は" },
        { t: "link", href: "https://example.com", label: "こちら" },
      ],
    });
  });

  it("文中の [* ] は見出しにしない", () => {
    const blocks = parseBlocks("これは [* 強調] です", opts);
    expect(blocks[0].type).toBe("p");
  });

  it("インデント行を箇条書きにする（階層つき）", () => {
    const blocks = parseBlocks("\titem1\n\t\titem2\n\titem3", opts);
    expect(blocks).toMatchObject([
      { type: "li", level: 1 },
      { type: "li", level: 2 },
      { type: "li", level: 1 },
    ]);
  });

  it("全角スペースもインデントとして扱う", () => {
    expect(parseBlocks("　項目\n　　子項目", opts)).toMatchObject([
      { type: "li", level: 1 },
      { type: "li", level: 2 },
    ]);
  });

  it("全角スペースでインデントされた code: ブロックを認識する", () => {
    // 全角スペース indent の code: 行 + さらに深い中身
    const blocks = parseBlocks(
      "　 code:mail（宛先）\n　  一斉メール文面\n　  二行目",
      opts,
    );
    expect(blocks[0]).toMatchObject({
      type: "code",
      name: "mail（宛先）",
      lines: ["一斉メール文面", "二行目"],
    });
    // indent 0 の code: 行 + 全角スペース indent の中身
    const blocks2 = parseBlocks("code:リスト\n　[_] やること", opts);
    expect(blocks2[0]).toMatchObject({ type: "code", lines: ["[_] やること"] });
  });

  it("code: ブロックを収集する", () => {
    const blocks = parseBlocks("code:test.sh\n echo hi\n echo bye", opts);
    expect(blocks[0]).toMatchObject({
      type: "code",
      name: "test.sh",
      lines: ["echo hi", "echo bye"],
    });
  });

  it("code: ブロック内の空行を保持し、ブロック外の空行は含めない", () => {
    const blocks = parseBlocks("code:a.txt\n line1\n\n line2\nafter", opts);
    expect(blocks[0]).toMatchObject({
      type: "code",
      lines: ["line1", "", "line2"],
    });
    expect(blocks[1]).toMatchObject({ type: "p" });
  });

  it("table: をタブ区切りでパースする", () => {
    const blocks = parseBlocks("table:t\n a\tb\n c\td", opts);
    expect(blocks[0]).toMatchObject({
      type: "table",
      name: "t",
      rows: [
        ["a", "b"],
        ["c", "d"],
      ],
    });
  });

  it("[hr.icon] を区切り線にする", () => {
    expect(parseBlocks("[hr.icon]", opts)[0]).toMatchObject({ type: "hr" });
  });

  it("$ / % で始まる行はコマンドライン（行全体がインラインコード）", () => {
    expect(parseBlocks("$ ls -la", opts)[0]).toMatchObject({
      type: "p",
      nodes: [{ t: "code", v: "$ ls -la" }],
    });
    expect(parseBlocks("\t$ /remind me later", opts)[0]).toMatchObject({
      type: "li",
      level: 1,
      nodes: [{ t: "code", v: "$ /remind me later" }],
    });
    expect(parseBlocks("% make build", opts)[0]).toMatchObject({
      type: "p",
      nodes: [{ t: "code", v: "% make build" }],
    });
    // スペースがなければ通常のテキスト
    expect(parseBlocks("$100 です", opts)[0]).toMatchObject({
      type: "p",
      nodes: [{ t: "text", v: "$100 です" }],
    });
  });

  it("> を引用にする", () => {
    expect(parseBlocks("> 引用文", opts)[0]).toMatchObject({ type: "quote" });
  });
});

describe("parseInline", () => {
  it("[[太字]] を太字にする", () => {
    expect(parseInline("[[太字]]", opts)).toMatchObject([
      { t: "deco", b: true },
    ]);
  });

  it("装飾記法と組み合わせ", () => {
    expect(parseInline("[/ 斜体]", opts)).toMatchObject([
      { t: "deco", i: true },
    ]);
    expect(parseInline("[- 取り消し]", opts)).toMatchObject([
      { t: "deco", s: true },
    ]);
    expect(parseInline("[*/ 両方]", opts)).toMatchObject([
      { t: "deco", b: true, i: true },
    ]);
  });

  it("装飾・注記の中にリンクを入れ子にできる", () => {
    expect(
      parseInline("[* 太字[リンク https://example.com]です]", opts),
    ).toMatchObject([
      {
        t: "deco",
        b: true,
        ch: [
          { t: "text", v: "太字" },
          { t: "link", href: "https://example.com", label: "リンク" },
          { t: "text", v: "です" },
        ],
      },
    ]);
    expect(
      parseInline("[~ 補足 [リンク https://example.com]]", opts),
    ).toMatchObject([
      {
        t: "styled",
        style: "note",
        ch: [{ t: "text" }, { t: "link", href: "https://example.com" }],
      },
    ]);
  });

  it("閉じられていない装飾ブラケットはテキストのまま", () => {
    expect(parseInline("[* 閉じてない", opts)).toMatchObject([
      { t: "text", v: "[* 閉じてない" },
    ]);
  });

  it("[~ 注記] を補足にする（デフォルトルール）", () => {
    expect(parseInline("[~ 注記です]", opts)).toMatchObject([
      { t: "styled", style: "note" },
    ]);
    expect(parseInline("[~ 注記です]", withoutRule("note"))).toMatchObject([
      { t: "internal", v: "~ 注記です" },
    ]);
  });

  it("リンク記法（URL 先頭 / 末尾 / URL のみ / 裸 URL）", () => {
    expect(parseInline("[https://example.com 表示名]", opts)).toMatchObject([
      { t: "link", href: "https://example.com", label: "表示名" },
    ]);
    expect(parseInline("[表示名 https://example.com]", opts)).toMatchObject([
      { t: "link", href: "https://example.com", label: "表示名" },
    ]);
    expect(parseInline("[https://example.com]", opts)).toMatchObject([
      { t: "link", href: "https://example.com" },
    ]);
    expect(
      parseInline("参照 https://example.com/x を見よ", opts),
    ).toMatchObject([
      { t: "text" },
      { t: "link", href: "https://example.com/x" },
      { t: "text" },
    ]);
  });

  it("`インラインコード`", () => {
    expect(parseInline("run `ls -la` now", opts)).toMatchObject([
      { t: "text", v: "run " },
      { t: "code", v: "ls -la" },
      { t: "text", v: " now" },
    ]);
  });

  it("[_] はルールの有効/無効に応じてチェックボックスになる", () => {
    expect(parseInline("[_] タスク", opts)).toMatchObject([
      { t: "checkbox" },
      { t: "text" },
    ]);
    expect(parseInline("[_] タスク", withoutRule("checklist"))).toMatchObject([
      { t: "internal", v: "_" },
      { t: "text", v: " タスク" },
    ]);
  });

  it("[.icon] はルールの有効/無効に応じて記入欄になる", () => {
    expect(parseInline("担当: [.icon]", opts)).toMatchObject([
      { t: "text" },
      { t: "blank" },
    ]);
    expect(parseInline("担当: [.icon]", withoutRule("blank"))).toMatchObject([
      { t: "text", v: "担当: " },
      { t: "internal", v: ".icon" },
    ]);
  });

  it("[name.icon] はアイコン、[ページ名] は内部リンク扱い", () => {
    expect(parseInline("[taro.icon]", opts)).toMatchObject([
      { t: "icons", names: ["taro"] },
    ]);
    expect(parseInline("[ページ名]", opts)).toMatchObject([
      { t: "internal", v: "ページ名" },
    ]);
    expect(parseInline("[/proj/page]", opts)).toMatchObject([
      { t: "internal", v: "/proj/page" },
    ]);
  });

  it("連続するアイコンを 1 つにまとめる", () => {
    expect(parseInline("[taro.icon][jiro.icon]", opts)).toMatchObject([
      { t: "icons", names: ["taro", "jiro"] },
    ]);
  });

  it("空白（半角・全角・タブ）を挟んだ連続アイコンもまとめる", () => {
    expect(
      parseInline("[taro.icon] [jiro.icon]　[saburo.icon]", opts),
    ).toMatchObject([{ t: "icons", names: ["taro", "jiro", "saburo"] }]);
  });

  it("アイコン間の空白は先にアイコンが続く場合だけ吸収する", () => {
    expect(parseInline("[taro.icon] です", opts)).toMatchObject([
      { t: "icons", names: ["taro"] },
      { t: "text", v: " です" },
    ]);
    expect(
      parseInline("やった人: [taro.icon] [jiro.icon] 以上", opts),
    ).toMatchObject([
      { t: "text", v: "やった人: " },
      { t: "icons", names: ["taro", "jiro"] },
      { t: "text", v: " 以上" },
    ]);
  });

  it("同じ名前の繰り返し（*n 表記や連続）は重複除去する", () => {
    expect(parseInline("[taro.icon*3]", opts)).toMatchObject([
      { t: "icons", names: ["taro"] },
    ]);
    expect(
      parseInline("[taro.icon][taro.icon][jiro.icon]", opts),
    ).toMatchObject([{ t: "icons", names: ["taro", "jiro"] }]);
  });
});

describe("拡張ルール", () => {
  it("ユーザー定義ルールが適用される（捕捉グループが表示テキスト）", () => {
    const o = withRule({ pattern: "! (.+)", effect: "red" });
    expect(parseInline("[! 注意]", o)).toMatchObject([
      { t: "styled", style: "red", ch: [{ t: "text", v: "注意" }] },
    ]);
  });

  it("捕捉グループがなければ中身全体が表示テキストになる", () => {
    const o = withRule({ pattern: "TODO", effect: "bold" });
    expect(parseInline("[TODO]", o)).toMatchObject([
      { t: "deco", b: true, ch: [{ t: "text", v: "TODO" }] },
    ]);
  });

  it("パターンは中身全体に完全一致（部分一致では発動しない）", () => {
    const o = withRule({ pattern: "TODO", effect: "bold" });
    expect(parseInline("[TODO あとで]", o)).toMatchObject([
      { t: "internal", v: "TODO あとで" },
    ]);
  });

  it("上のルールが優先される", () => {
    const o: Options = {
      ...opts,
      rules: [
        { id: "a", enabled: true, kind: "preset", pattern: "x", effect: "red" },
        {
          id: "b",
          enabled: true,
          kind: "preset",
          pattern: "x",
          effect: "gray",
        },
      ],
    };
    expect(parseInline("[x]", o)).toMatchObject([
      { t: "styled", style: "red" },
    ]);
  });

  it("公式記法より先に評価され、上書きできる", () => {
    const o = withRule({ pattern: "\\* (.+)", effect: "red" });
    expect(parseInline("これは [* 強調] です", o)).toMatchObject([
      { t: "text" },
      { t: "styled", style: "red" },
      { t: "text" },
    ]);
  });

  it("plain は中身をそのまま、remove は出力しない", () => {
    const plain = withRule({ pattern: "raw:(.+)", effect: "plain" });
    expect(parseInline("[raw:text]", plain)).toMatchObject([
      { t: "styled", style: "plain", ch: [{ t: "text", v: "text" }] },
    ]);
    const remove = withRule({ pattern: "secret", effect: "remove" });
    expect(parseInline("前[secret]後", remove)).toMatchObject([
      { t: "text", v: "前" },
      { t: "styled", style: "remove", ch: [] },
      { t: "text", v: "後" },
    ]);
  });

  it("不正な正規表現のルールは無視される", () => {
    const o = withRule({ pattern: "(", effect: "red" });
    expect(() => parseInline("[x]", o)).not.toThrow();
    expect(parseInline("[x]", o)).toMatchObject([{ t: "internal", v: "x" }]);
  });

  it("無効化されたルールは適用されない", () => {
    const o = withRule({ pattern: "x", effect: "red", enabled: false });
    expect(parseInline("[x]", o)).toMatchObject([{ t: "internal", v: "x" }]);
  });
});

describe("validateRulePattern", () => {
  it("妥当なパターンは null、不正なパターンはエラーメッセージを返す", async () => {
    const { validateRulePattern } = await import("./parser");
    expect(validateRulePattern("~ (.+)")).toBeNull();
    expect(validateRulePattern("(")).toBeTruthy();
  });
});

describe("nodesToPlainText", () => {
  it("装飾やリンクを含むノードからテキストを取り出す", () => {
    const nodes = parseInline("[[太字]] と [表示名 https://example.com]", opts);
    expect(nodesToPlainText(nodes)).toBe("太字 と 表示名");
  });
});
