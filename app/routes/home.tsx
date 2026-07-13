import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toolbar } from "~/components/Toolbar";
import type { Options } from "~/lib/parser";
import { docName, generateDocxBlob } from "~/lib/render-docx";
import { convert } from "~/lib/render-html";
import { SAMPLE } from "~/lib/sample";

const STORAGE_SRC = "cosense2docs:src";
const STORAGE_OPTS = "cosense2docs:opts";

const DEFAULT_OPTIONS: Options = { checklist: true, blank: true };

function loadInitialText(): string {
  try {
    const saved = localStorage.getItem(STORAGE_SRC);
    if (saved != null && saved !== "") return saved;
  } catch {}
  return SAMPLE;
}

function loadInitialOptions(): Options {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_OPTS) ?? "null");
    if (saved) return { checklist: !!saved.checklist, blank: !!saved.blank };
  } catch {}
  return DEFAULT_OPTIONS;
}

export default function Home() {
  const [text, setText] = useState(loadInitialText);
  const [options, setOptions] = useState(loadInitialOptions);
  const [filename, setFilename] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const html = useMemo(() => convert(text, options), [text, options]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SRC, text);
      localStorage.setItem(STORAGE_OPTS, JSON.stringify(options));
    } catch {}
  }, [text, options]);

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
        options={options}
        onOptionsChange={setOptions}
        filename={filename}
        onFilenameChange={setFilename}
        onCopyRich={copyRich}
        onCopyHtml={copyHtml}
        onDownloadDocx={downloadDocx}
      />

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
