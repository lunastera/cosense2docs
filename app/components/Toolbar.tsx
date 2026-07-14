type Props = {
  firstLineTitle: boolean;
  onFirstLineTitleChange: (value: boolean) => void;
  rulesOpen: boolean;
  onToggleRules: () => void;
  filename: string;
  onFilenameChange: (filename: string) => void;
  onCopyRich: () => void;
  onCopyMarkdown: () => void;
  onCopyHtml: () => void;
  onDownloadDocx: () => void;
};

export function Toolbar({
  firstLineTitle,
  onFirstLineTitleChange,
  rulesOpen,
  onToggleRules,
  filename,
  onFilenameChange,
  onCopyRich,
  onCopyMarkdown,
  onCopyHtml,
  onDownloadDocx,
}: Props) {
  const buttonClass =
    "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 hover:bg-gray-50";
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-b border-gray-300 px-5 pb-3">
      <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-xs">
        <input
          type="checkbox"
          checked={firstLineTitle}
          onChange={(e) => onFirstLineTitleChange(e.target.checked)}
        />
        1行目をタイトルにする
      </label>
      <button
        type="button"
        className={`${buttonClass} ${rulesOpen ? "bg-gray-100" : ""}`}
        onClick={onToggleRules}
      >
        拡張ルール {rulesOpen ? "▲" : "▼"}
      </button>
      <div className="flex-1" />
      <input
        type="text"
        value={filename}
        onChange={(e) => onFilenameChange(e.target.value)}
        placeholder="ファイル名（省略可）"
        className="w-44 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs"
      />
      <button
        type="button"
        className={buttonClass}
        onClick={onCopyMarkdown}
        title="Google Docs では「編集 → マークダウンから貼り付け」で貼ると、コードブロックが Docs のコードブロックになります"
      >
        Markdown をコピー（Docs 向け）
      </button>
      <button type="button" className={buttonClass} onClick={onCopyRich}>
        プレビューをコピー
      </button>
      <button type="button" className={buttonClass} onClick={onCopyHtml}>
        HTML をコピー
      </button>
      <button
        type="button"
        className="rounded-md border border-blue-600 bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
        onClick={onDownloadDocx}
      >
        .docx をダウンロード
      </button>
    </div>
  );
}
