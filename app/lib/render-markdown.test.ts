import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type Options } from "./parser";
import { convertMarkdown } from "./render-markdown";

const opts: Options = { firstLineTitle: false, rules: DEFAULT_RULES };

describe("convertMarkdown", () => {
  it("見出しとタイトル", () => {
    expect(convertMarkdown("[*** タイトル]", opts)).toContain("# タイトル");
    expect(convertMarkdown("[** 見出し]", opts)).toContain("## 見出し");
    expect(
      convertMarkdown("ページ名\n本文", { ...opts, firstLineTitle: true }),
    ).toContain("# ページ名");
  });

  it("コードブロックはフェンスになる（Docs のコードブロック用）", () => {
    const md = convertMarkdown(
      "code:template\n @channel 障害です\n 会場はこちら",
      opts,
    );
    expect(md).toContain(
      "*template*\n```\n@channel 障害です\n会場はこちら\n```",
    );
  });

  it("コードブロック内はエスケープや nbsp 変換をしない", () => {
    const md = convertMarkdown(
      "code:a.sh\n echo [*test*]\n     indented",
      opts,
    );
    expect(md).toContain("echo [*test*]");
    expect(md).toContain("    indented");
    expect(md).not.toContain(" ");
  });

  it("チェックリストは - [ ] になる", () => {
    expect(convertMarkdown("\t[_] タスク", opts)).toContain("- [ ] タスク");
  });

  it("箇条書きの階層はインデントで表す", () => {
    const md = convertMarkdown("\t親\n\t\t子", opts);
    expect(md).toContain("- 親\n    - 子");
  });

  it("装飾・リンク・インラインコード", () => {
    expect(convertMarkdown("[[太字]] と [- 取り消し]", opts)).toContain(
      "**太字** と ~~取り消し~~",
    );
    expect(convertMarkdown("[表示名 https://example.com]", opts)).toContain(
      "[表示名](https://example.com)",
    );
    expect(convertMarkdown("run `ls` now", opts)).toContain("run `ls` now");
  });

  it("テーブルは GFM 形式になる", () => {
    const md = convertMarkdown("table:t\n a\tb\n c\td", opts);
    expect(md).toContain("| a | b |");
    expect(md).toContain("| --- | --- |");
    expect(md).toContain("| c | d |");
  });

  it("引用・区切り線", () => {
    expect(convertMarkdown("> 引用", opts)).toContain("> 引用");
    expect(convertMarkdown("a\n[hr.icon]\nb", opts)).toContain("---");
  });

  it("内部リンクや Markdown 特殊文字はエスケープされる", () => {
    expect(convertMarkdown("[ページ名]", opts)).toContain("\\[ページ名\\]");
    expect(convertMarkdown("a*b_c", opts)).toContain("a\\*b\\_c");
  });

  it("記入欄・アイコン・補足のフォールバック", () => {
    expect(convertMarkdown("担当: [.icon]", opts)).toContain(
      "担当: ＿＿＿＿＿＿",
    );
    expect(convertMarkdown("[taro.icon][jiro.icon]", opts)).toContain(
      "(taro, jiro)",
    );
    expect(convertMarkdown("[~ 補足です]", opts)).toContain("補足です");
  });
});
