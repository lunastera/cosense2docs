import type { CustomRule, EffectId } from "~/lib/parser";
import { DEFAULT_RULES, validateRulePattern } from "~/lib/parser";

/** プリセットの表示ラベル（select の並び順もこの順） */
const EFFECT_LABELS: [EffectId, string][] = [
  ["note", "補足表示（グレー・小さめ）"],
  ["checkbox", "チェックボックス（☐）"],
  ["checked", "チェック済み（☑）"],
  ["blank", "記入欄（下線の空欄）"],
  ["bold", "太字"],
  ["italic", "斜体"],
  ["strike", "取り消し線"],
  ["underline", "下線"],
  ["gray", "グレー文字"],
  ["red", "赤文字"],
  ["mono", "等幅（コード風）"],
  ["plain", "中身をそのまま表示"],
  ["remove", "出力しない"],
];

type Props = {
  rules: CustomRule[];
  onChange: (rules: CustomRule[]) => void;
};

export function RulesPanel({ rules, onChange }: Props) {
  const update = (id: string, patch: Partial<CustomRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const add = () => {
    onChange([
      ...rules,
      {
        id: crypto.randomUUID(),
        enabled: true,
        pattern: "",
        kind: "preset",
        effect: "note",
      },
    ]);
  };

  return (
    <div className="border-b border-gray-300 bg-gray-50 px-5 py-3">
      <p className="mb-2 text-[11px] text-gray-500">
        ブラケット <code className="font-mono">[ ]</code>{" "}
        の中身がパターン（正規表現）に完全一致したとき、選んだ変換を適用します。上のルールが優先。
        パターンに <code className="font-mono">( )</code>{" "}
        があればその部分が表示テキストになります。
      </p>
      <div className="flex flex-col gap-1.5">
        {rules.map((rule) => {
          const error = validateRulePattern(rule.pattern);
          return (
            <div key={rule.id} className="flex flex-wrap items-center gap-2">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) => update(rule.id, { enabled: e.target.checked })}
                title="有効 / 無効"
              />
              <span className="flex items-center gap-0.5 font-mono text-xs text-gray-400">
                [
                <input
                  type="text"
                  value={rule.pattern}
                  onChange={(e) => update(rule.id, { pattern: e.target.value })}
                  placeholder="パターン"
                  spellCheck={false}
                  className={`w-40 rounded border bg-white px-1.5 py-1 font-mono text-xs text-gray-800 ${
                    error ? "border-red-400" : "border-gray-300"
                  }`}
                  title={error ?? undefined}
                />
                ]
              </span>
              <span className="text-xs text-gray-400">→</span>
              <select
                value={rule.effect}
                onChange={(e) =>
                  update(rule.id, { effect: e.target.value as EffectId })
                }
                className="rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
              >
                {EFFECT_LABELS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(rules.filter((r) => r.id !== rule.id))}
                className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                title="このルールを削除"
              >
                ✕
              </button>
              {error && (
                <span className="text-[11px] text-red-500">
                  正規表現エラー: {error}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={add}
          className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs hover:bg-gray-100"
        >
          ＋ ルールを追加
        </button>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_RULES)}
          className="rounded border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-100"
        >
          初期ルールに戻す
        </button>
      </div>
    </div>
  );
}
