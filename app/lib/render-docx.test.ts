import { Packer } from "docx";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, type Options } from "./parser";
import { buildDocument, docName } from "./render-docx";
import { SAMPLE } from "./sample";

const opts: Options = { firstLineTitle: false, rules: DEFAULT_RULES };
// SAMPLE はページ全体コピー（1 行目 = タイトル）を想定した内容
const titleOpts: Options = { ...opts, firstLineTitle: true };

async function documentXml(text: string, o: Options = opts): Promise<string> {
  const buf = await Packer.toBuffer(buildDocument(text, o));
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("word/document.xml not found");
  return file.async("string");
}

describe("buildDocument", () => {
  it("サンプル全体から有効な docx を生成できる", async () => {
    const buf = await Packer.toBuffer(buildDocument(SAMPLE, titleOpts));
    // zip (PK) マジックナンバー
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it("document.xml に各要素が反映される", async () => {
    const xml = await documentXml(SAMPLE, titleOpts);
    expect(xml).toContain("歓迎会の準備メモ"); // 見出しテキスト
    expect(xml).toContain('w:pStyle w:val="Heading1"'); // 見出しスタイル
    expect(xml).toContain("w:hyperlink"); // リンク
    expect(xml).toContain("F1F3F5"); // コードの網掛け
    expect(xml).toContain("Consolas"); // 等幅フォント
    expect(xml).toContain("☐"); // チェックリスト
    expect(xml).toContain("w:pBdr"); // 区切り線 (thematicBreak) と引用の罫線
    expect(xml).toContain("<w:tbl>"); // テーブル
  });

  it("箇条書きのレベルが反映される", async () => {
    const xml = await documentXml("\ta\n\t\tb");
    expect(xml).toContain('w:ilvl w:val="0"');
    expect(xml).toContain('w:ilvl w:val="1"');
  });
});

describe("docName", () => {
  it("手入力を優先し .docx 拡張子を除く", () => {
    expect(docName(SAMPLE, titleOpts, "my-file.docx")).toBe("my-file");
  });

  it("先頭の見出しから生成する", () => {
    expect(docName(SAMPLE, titleOpts, "")).toBe("歓迎会の準備メモ");
  });

  it("見出しがなければデフォルト名", () => {
    expect(docName("ただの文章", opts, "")).toBe("cosense-document");
  });

  it("ファイル名に使えない文字を置換する", () => {
    expect(docName("[*** a/b:c]", opts, "")).toBe("a_b_c");
  });
});
