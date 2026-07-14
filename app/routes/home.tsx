import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RulesPanel } from "~/components/RulesPanel";
import { Toolbar } from "~/components/Toolbar";
import type { CustomRule, Options } from "~/lib/parser";
import { DEFAULT_RULES } from "~/lib/parser";
import { docName, generateDocxBlob } from "~/lib/render-docx";
import { convert } from "~/lib/render-html";
import { convertMarkdown } from "~/lib/render-markdown";
import { SAMPLE } from "~/lib/sample";

const STORAGE_SRC = "cosense2docs:src";
const STORAGE_OPTS = "cosense2docs:opts";
const STORAGE_RULES = "cosense2docs:rules";

function loadInitialText(): string {
  try {
    const saved = localStorage.getItem(STORAGE_SRC);
    if (saved != null && saved !== "") return saved;
  } catch {}
  return SAMPLE;
}

function loadInitialFirstLineTitle(): boolean {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_OPTS) ?? "null");
    // キーがない（古い保存データ）場合は有効として扱う
    if (saved) return saved.firstLineTitle !== false;
  } catch {}
  return true;
}

function isCustomRule(r: unknown): r is CustomRule {
  if (typeof r !== "object" || r === null) return false;
  const o = r as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.enabled === "boolean" &&
    typeof o.pattern === "string" &&
    o.kind === "preset" &&
    typeof o.effect === "string"
  );
}

function loadInitialRules(): CustomRule[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_RULES) ?? "null");
    if (saved && Array.isArray(saved.rules)) {
      const rules: CustomRule[] = saved.rules.filter(isCustomRule);
      // v1 → v2: [x] チェック済みのデフォルトルールを追加
      if (
        (saved.version ?? 1) < 2 &&
        !rules.some((r) => r.id === "checklist-checked")
      ) {
        const checked = DEFAULT_RULES.find((r) => r.id === "checklist-checked");
        if (checked) {
          const at = rules.findIndex((r) => r.id === "checklist");
          rules.splice(at >= 0 ? at + 1 : rules.length, 0, checked);
        }
      }
      return rules;
    }
    // ルール保存がない場合: 旧トグル設定（checklist / blank）を
    // デフォルトルールの有効状態に引き継ぐ
    const legacy = JSON.parse(localStorage.getItem(STORAGE_OPTS) ?? "null");
    if (legacy) {
      return DEFAULT_RULES.map((r) => {
        if (r.id === "checklist" && legacy.checklist === false)
          return { ...r, enabled: false };
        if (r.id === "blank" && legacy.blank === false)
          return { ...r, enabled: false };
        return r;
      });
    }
  } catch {}
  return DEFAULT_RULES;
}

export default function Home() {
  const [text, setText] = useState(loadInitialText);
  const [firstLineTitle, setFirstLineTitle] = useState(
    loadInitialFirstLineTitle,
  );
  const [rules, setRules] = useState(loadInitialRules);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [filename, setFilename] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const options = useMemo<Options>(
    () => ({ firstLineTitle, rules }),
    [firstLineTitle, rules],
  );
  const html = useMemo(() => convert(text, options), [text, options]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SRC, text);
      localStorage.setItem(STORAGE_OPTS, JSON.stringify({ firstLineTitle }));
      localStorage.setItem(
        STORAGE_RULES,
        JSON.stringify({ version: 2, rules }),
      );
    } catch {}
  }, [text, firstLineTitle, rules]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const copyRich = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([el.innerHTML], { type: "text/html" }),
          "text/plain": new Blob([el.innerText], { type: "text/plain" }),
        }),
      ]);
      showToast(
        "プレビューをコピーしました（そのまま Docs / Word に貼れます）",
      );
    } catch {
      showToast("コピーに失敗しました");
    }
  }, [showToast]);

  const copyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(convertMarkdown(text, options));
      showToast(
        "Markdown をコピーしました。Docs では「編集 → マークダウンから貼り付け」で貼ってください",
      );
    } catch {
      showToast("コピーに失敗しました");
    }
  }, [text, options, showToast]);

  const copyHtml = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(html);
      showToast("HTML ソースをコピーしました");
    } catch {
      showToast("コピーに失敗しました");
    }
  }, [html, showToast]);

  const downloadDocx = useCallback(async () => {
    try {
      const blob = await generateDocxBlob(text, options);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${docName(text, options, filename)}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      showToast(".docx をダウンロードしました");
    } catch {
      showToast(".docx の生成に失敗しました");
    }
  }, [text, options, filename, showToast]);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-baseline gap-3 px-5 pt-3.5 pb-2.5">
        <h1 className="text-lg font-bold">Cosense → Docs</h1>
        <span className="text-xs text-gray-500">
          Cosense（旧Scrapbox）記法を貼り付けると、整形プレビューと .docx
          に変換します。データはブラウザ内で処理され、外部送信されません。
        </span>
      </header>

      <Toolbar
        firstLineTitle={firstLineTitle}
        onFirstLineTitleChange={setFirstLineTitle}
        rulesOpen={rulesOpen}
        onToggleRules={() => setRulesOpen((v) => !v)}
        filename={filename}
        onFilenameChange={setFilename}
        onCopyRich={copyRich}
        onCopyMarkdown={copyMarkdown}
        onCopyHtml={copyHtml}
        onDownloadDocx={downloadDocx}
      />

      {rulesOpen && <RulesPanel rules={rules} onChange={setRules} />}

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-3.5 p-4 md:grid-cols-2">
        <section className="flex min-h-72 min-w-0 flex-col">
          <p className="mb-1.5 ml-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Cosense 記法
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder="ここに Cosense のテキストを貼り付け"
            className="flex-1 resize-none rounded-lg border border-gray-300 bg-white p-3.5 font-mono text-[13px] leading-relaxed outline-none focus:border-blue-600"
            style={{ tabSize: 4 }}
          />
        </section>
        <section className="flex min-h-72 min-w-0 flex-col">
          <p className="mb-1.5 ml-0.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            プレビュー
          </p>
          <div
            ref={previewRef}
            className="preview flex-1 overflow-auto rounded-lg border border-gray-300 bg-white px-7 py-6"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: render-html.ts がユーザー入力をエスケープ済み
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </section>
      </main>

      {toast && (
        <output className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-gray-800 px-4.5 py-2 text-[13px] text-white">
          {toast}
        </output>
      )}
    </div>
  );
}
