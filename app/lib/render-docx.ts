/**
 * ブロック / インラインノードを docx (Word 文書) に変換する。
 */

import type { ParagraphChild } from "docx";
import {
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { Block, InlineNode, Options } from "./parser";
import { nodesToPlainText, parseBlocks, parseInline } from "./parser";

const JP_FONT = "Yu Gothic";
const MONO_FONT = "Consolas";

type RunProps = {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  color?: string;
  size?: number;
  font?: string;
  underline?: Record<string, never>;
  shading?: {
    type: (typeof ShadingType)[keyof typeof ShadingType];
    fill: string;
  };
};

/** styled ノードの各スタイルを docx の文字プロパティに対応づける */
const STYLED_RUN_PROPS: Record<string, RunProps> = {
  note: { color: "6B7280", size: 18 },
  gray: { color: "6B7280" },
  red: { color: "DC2626" },
  underline: { underline: {} },
  mono: {
    font: "Consolas",
    shading: { type: ShadingType.CLEAR, fill: "F1F3F5" },
  },
  plain: {},
};

function nodesToRuns(
  nodes: InlineNode[],
  inherit: RunProps = {},
): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const n of nodes) {
    switch (n.t) {
      case "text":
        out.push(new TextRun({ text: n.v, ...inherit }));
        break;
      case "code":
        out.push(
          new TextRun({
            text: n.v,
            font: MONO_FONT,
            shading: { type: ShadingType.CLEAR, fill: "F1F3F5" },
            ...inherit,
          }),
        );
        break;
      case "link":
        out.push(
          new ExternalHyperlink({
            link: n.href,
            children: [
              new TextRun({ text: n.label, style: "Hyperlink", ...inherit }),
            ],
          }),
        );
        break;
      case "deco":
        out.push(
          ...nodesToRuns(n.ch, {
            ...inherit,
            bold: inherit.bold || !!n.b,
            italics: inherit.italics || !!n.i,
            strike: inherit.strike || !!n.s,
          }),
        );
        break;
      case "styled":
        if (n.style !== "remove") {
          out.push(
            ...nodesToRuns(n.ch, { ...inherit, ...STYLED_RUN_PROPS[n.style] }),
          );
        }
        break;
      case "checkbox":
        out.push(new TextRun({ text: "☐", ...inherit }));
        break;
      case "blank":
        out.push(
          new TextRun({ text: "　　　　　　", underline: {}, ...inherit }),
        );
        break;
      case "icons":
        out.push(
          new TextRun({
            text: `(${n.names.join(", ")})`,
            color: "6B7280",
            ...inherit,
          }),
        );
        break;
      case "internal":
        // 変換対象にならなかったブラケットは原文のまま残す
        out.push(new TextRun({ text: `[${n.v}]`, ...inherit }));
        break;
    }
  }
  return out;
}

type DocxBlock = Paragraph | Table;

const HEADING = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
] as const;

export function blocksToDocxChildren(
  blocks: Block[],
  opts: Options,
): DocxBlock[] {
  const children: DocxBlock[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "blank":
        children.push(new Paragraph({}));
        break;
      case "heading":
        children.push(
          new Paragraph({
            heading: HEADING[b.level - 1],
            children: nodesToRuns(b.nodes),
          }),
        );
        break;
      case "p":
        children.push(new Paragraph({ children: nodesToRuns(b.nodes) }));
        break;
      case "li":
        children.push(
          new Paragraph({
            children: nodesToRuns(b.nodes),
            bullet: { level: Math.min(b.level - 1, 8) },
          }),
        );
        break;
      case "quote":
        children.push(
          new Paragraph({
            children: nodesToRuns(b.nodes, { color: "57606A" }),
            indent: { left: 360 },
            border: {
              left: {
                style: BorderStyle.SINGLE,
                size: 18,
                color: "D1D5DB",
                space: 8,
              },
            },
          }),
        );
        break;
      case "hr":
        children.push(new Paragraph({ thematicBreak: true }));
        break;
      case "code": {
        if (b.name) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: b.name,
                  color: "6B7280",
                  size: 16,
                  font: MONO_FONT,
                }),
              ],
              spacing: { after: 40 },
            }),
          );
        }
        const codeLines = b.lines.length ? b.lines : [""];
        codeLines.forEach((line, idx) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: line || " ", font: MONO_FONT, size: 18 }),
              ],
              shading: { type: ShadingType.CLEAR, fill: "F1F3F5" },
              spacing: {
                before: idx === 0 ? 80 : 0,
                after: idx === codeLines.length - 1 ? 80 : 0,
                line: 240,
              },
            }),
          );
        });
        break;
      }
      case "table": {
        if (b.name) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: b.name, color: "6B7280", size: 16 }),
              ],
              spacing: { after: 40 },
            }),
          );
        }
        const cols = Math.max(...b.rows.map((r) => r.length), 1);
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: b.rows.map(
              (row, ri) =>
                new TableRow({
                  children: Array.from(
                    { length: cols },
                    (_, ci) =>
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: nodesToRuns(
                              parseInline(row[ci] || "", opts),
                              ri === 0 ? { bold: true } : {},
                            ),
                          }),
                        ],
                        shading:
                          ri === 0
                            ? { type: ShadingType.CLEAR, fill: "F6F8FA" }
                            : undefined,
                      }),
                  ),
                }),
            ),
          }),
        );
        children.push(new Paragraph({}));
        break;
      }
    }
  }
  return children.length ? children : [new Paragraph({})];
}

export function buildDocument(text: string, opts: Options): Document {
  const blocks = parseBlocks(text, opts);
  return new Document({
    styles: {
      default: {
        document: { run: { font: JP_FONT, size: 21 } },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, color: "111827", font: JP_FONT },
          paragraph: { spacing: { before: 360, after: 160 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 27, bold: true, color: "111827", font: JP_FONT },
          paragraph: { spacing: { before: 300, after: 120 } },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 23, bold: true, color: "111827", font: JP_FONT },
          paragraph: { spacing: { before: 240, after: 100 } },
        },
      ],
    },
    sections: [{ children: blocksToDocxChildren(blocks, opts) }],
  });
}

export async function generateDocxBlob(
  text: string,
  opts: Options,
): Promise<Blob> {
  return Packer.toBlob(buildDocument(text, opts));
}

/** .docx のファイル名（拡張子なし）を決める。手入力 > 先頭見出し > デフォルト */
export function docName(text: string, opts: Options, manual: string): string {
  const trimmed = manual.trim().replace(/\.docx$/i, "");
  if (trimmed) return trimmed;
  for (const b of parseBlocks(text, opts)) {
    if (b.type === "heading") {
      const t = nodesToPlainText(b.nodes).trim();
      if (t) return t.replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
    }
  }
  return "cosense-document";
}
