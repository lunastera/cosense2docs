import { describe, expect, it } from "vitest";
import {
  nodesToPlainText,
  type Options,
  parseBlocks,
  parseInline,
} from "./parser";

const opts: Options = { checklist: true, blank: true, firstLineTitle: false };

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

  it("[~ 注記] を補足にする", () => {
    expect(parseInline("[~ 注記です]", opts)).toMatchObject([{ t: "note" }]);
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

  it("[_] はトグルに応じてチェックボックスになる", () => {
    expect(parseInline("[_] タスク", opts)).toMatchObject([
      { t: "checkbox" },
      { t: "text" },
    ]);
    expect(
      parseInline("[_] タスク", { ...opts, checklist: false }),
    ).toMatchObject([{ t: "text", v: "[_] タスク" }]);
  });

  it("[.icon] はトグルに応じて記入欄になる", () => {
    expect(parseInline("担当: [.icon]", opts)).toMatchObject([
      { t: "text" },
      { t: "blank" },
    ]);
    expect(
      parseInline("担当: [.icon]", { ...opts, blank: false }),
    ).toMatchObject([{ t: "text", v: "担当: [.icon]" }]);
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

describe("nodesToPlainText", () => {
  it("装飾やリンクを含むノードからテキストを取り出す", () => {
    const nodes = parseInline("[[太字]] と [表示名 https://example.com]", opts);
    expect(nodesToPlainText(nodes)).toBe("太字 と 表示名");
  });
});
