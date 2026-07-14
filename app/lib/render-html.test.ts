import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type Options } from "./parser";
import { convert } from "./render-html";

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

describe("convert (HTML)", () => {
  it("見出し", () => {
    expect(convert("[*** タイトル]", opts)).toContain("<h1>タイトル</h1>");
    expect(convert("[** 見出し]", opts)).toContain("<h2>見出し</h2>");
    expect(convert("[* 小見出し]", opts)).toContain("<h3>小見出し</h3>");
  });

  it("firstLineTitle 有効時は 1 行目が h1 になる", () => {
    const html = convert("ページタイトル\n本文", {
      ...opts,
      firstLineTitle: true,
    });
    expect(html).toContain("<h1>ページタイトル</h1>");
    expect(html).toContain("<p>本文</p>");
  });

  it("文中の [* ] は太字", () => {
    expect(convert("これは [* 強調] です", opts)).toContain(
      "<p>これは <b>強調</b> です</p>",
    );
  });

  it("装飾", () => {
    expect(convert("[[太字]]", opts)).toContain("<b>太字</b>");
    expect(convert("[/ 斜体]", opts)).toContain("<i>斜体</i>");
    expect(convert("[- 取り消し]", opts)).toContain("<s>取り消し</s>");
    const combo = convert("[*/ 両方]", opts);
    expect(combo).toContain("<b>");
    expect(combo).toContain("<i>");
  });

  it("リンク", () => {
    expect(convert("[https://example.com 表示名]", opts)).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener">表示名</a>',
    );
    expect(convert("[表示名 https://example.com]", opts)).toContain(
      ">表示名</a>",
    );
    expect(convert("参照 https://example.com/x を見よ", opts)).toContain(
      '<a href="https://example.com/x"',
    );
  });

  it("コード", () => {
    expect(convert("run `ls -la` now", opts)).toContain("<code");
    // コードブロックは 1 セルの表 + 1 行 1 段落（Docs 貼り付けで構造が保持される）
    const block = convert("code:test.sh\n echo hi\n echo bye", opts);
    expect(block).toContain("<table");
    expect(block).toMatch(
      /<td[^>]*>(<p[^>]*>echo hi<\/p>)(<p[^>]*>echo bye<\/p>)<\/td>/,
    );
    expect(block).toContain("test.sh");
    expect(block).not.toContain("<pre");
  });

  it("コードブロックの字下げ・連続スペースを nbsp で保持する", () => {
    const block = convert("code:a.txt\n 項目\n     字下げ行\n 単語  間", opts);
    expect(block).toContain(`>${"\u00a0".repeat(4)}字下げ行</p>`);
    expect(block).toContain(`>単語${"\u00a0".repeat(2)}間</p>`);
    // 単語間の単独スペースは通常のスペースのまま
    const single = convert("code:b.txt\n a b", opts);
    expect(single).toContain(">a b</p>");
  });

  it("$ で始まる行は行全体がインラインコードになる", () => {
    const html = convert("\t$ /remind #ch あとで in 30 minutes", opts);
    expect(html).toMatch(
      /<li><code[^>]*>\$ \/remind #ch あとで in 30 minutes<\/code><\/li>/,
    );
  });

  it("入れ子の箇条書きが正しい HTML 構造になる", () => {
    expect(convert("\ta\n\t\tb\n\t\t\tc\n\ta2", opts)).toBe(
      "<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li><li>a2</li></ul>",
    );
  });

  it("区切り線・引用・注記", () => {
    expect(convert("[hr.icon]", opts)).toContain("<hr");
    expect(convert("> 引用文", opts)).toContain("<blockquote");
    expect(convert("[~ 注記です]", opts)).toContain("注記です</span>");
  });

  it("トグル: チェックリスト", () => {
    expect(convert("\t[_] タスク", opts)).toContain("☐ タスク");
    expect(convert("\t[_] タスク", withoutRule("checklist"))).toContain("[_]");
  });

  it("トグル: 記入欄", () => {
    expect(convert("担当: [.icon]", opts)).toContain(
      "text-decoration:underline",
    );
    expect(convert("担当: [.icon]", withoutRule("blank"))).toContain("[.icon]");
  });

  it("アイコンは (name) 表記、連続は (a, b) にまとめる", () => {
    expect(convert("[taro.icon]", opts)).toContain("(taro)");
    expect(convert("同意 [taro.icon] [jiro.icon]", opts)).toContain(
      "(taro, jiro)",
    );
  });

  it("テーブル（先頭行はヘッダー）", () => {
    const html = convert("table:t\n a\tb\n c\td", opts);
    expect(html).toContain("<table");
    expect(html).toContain(">a</th>");
    expect(html).toContain(">d</td>");
  });

  it("ユーザー定義ルール（赤文字）が HTML に反映される", () => {
    const o: Options = {
      ...opts,
      rules: [
        {
          id: "warn",
          enabled: true,
          kind: "preset",
          pattern: "! (.+)",
          effect: "red",
        },
        ...DEFAULT_RULES,
      ],
    };
    expect(convert("[! 注意]", o)).toContain(
      '<span style="color:#dc2626;">注意</span>',
    );
  });

  it("HTML をエスケープする", () => {
    expect(convert("<script>alert(1)</script>", opts)).toContain(
      "&lt;script&gt;",
    );
    expect(convert("[<img src=x> https://example.com]", opts)).not.toContain(
      "<img",
    );
  });
});
