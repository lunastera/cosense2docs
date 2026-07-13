import type { Options } from "~/lib/parser";

type Props = {
  options: Options;
  onOptionsChange: (options: Options) => void;
  filename: string;
  onFilenameChange: (filename: string) => void;
  onCopyRich: () => void;
  onCopyHtml: () => void;
  onDownloadDocx: () => void;
};

export function Toolbar({
  options,
  onOptionsChange,
  filename,
  onFilenameChange,
  onCopyRich,
  onCopyHtml,
  onDownloadDocx,
}: Props) {
  const buttonClass =
    "rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-800 hover:bg-gray-50";
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-b border-gray-300 px-5 pb-3">
      <div className="flex flex-wrap gap-3.5">
        <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={options.checklist}
            onChange={(e) =>
              onOptionsChange({ ...options, checklist: e.target.checked })
            }
          />
          [_] をチェックリストに変換
        </label>
        <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={options.blank}
            onChange={(e) =>
              onOptionsChange({ ...options, blank: e.target.checked })
            }
          />
          [.icon] を記入欄に変換
        </label>
      </div>
      <div className="flex-1" />
      <input
        type="text"
        value={filename}
        onChange={(e) => onFilenameChange(e.target.value)}
        placeholder="ファイル名（省略可）"
        className="w-44 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs"
      />
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
