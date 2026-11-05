import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  ListChecks,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { get, post } from "../api/client";
import { useApp } from "../store/AppContext";
import {
  Badge,
  Card,
  EmptyState,
  Loading,
  SectionTitle,
  StatCard,
} from "../components/ui";

type QualityCol = {
  name: string;
  dtype: string;
  missing: number;
  missing_pct: number;
  unique: number;
  constant: boolean;
  kind: "numeric" | "categorical" | "datetime";
  outliers?: number;
  mean?: number;
  median?: number;
  std?: number;
  min?: number;
  max?: number;
};

type Quality = {
  rows: number;
  columns: number;
  duplicate_rows: number;
  missing_cells: number;
  missing_pct: number;
  constant_columns: string[];
  quality_score: number;
  warnings: string[];
  columns: QualityCol[];
};

type Operation =
  | { operation: "drop_duplicates" }
  | { operation: "drop_columns"; columns: string[] }
  | { operation: "drop_rows_missing"; columns: string[]; how: "any" | "all" }
  | { operation: "impute_numeric"; column: string; strategy: string; value?: number }
  | { operation: "impute_categorical"; column: string; strategy: string; value?: string }
  | { operation: "convert_type"; column: string; to: string }
  | { operation: "scale"; columns: string[]; method: "standardize" | "normalize" }
  | { operation: "replace_outliers"; column: string };

export default function QualityLab() {
  const { selected, refreshDatasets, refreshActivity, selectDataset, toast } = useApp();
  const [quality, setQuality] = useState<Quality | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [ops, setOps] = useState<Operation[]>([]);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!selected) {
      setQuality(null);
      return;
    }
    setLoading(true);
    setOps([]);
    setResult(null);
    get<Quality>(`/api/analysis/${selected.id}/quality`)
      .then(setQuality)
      .catch((err) => toast("error", err?.message ?? "Failed to load quality report."))
      .finally(() => setLoading(false));
  }, [selected, toast]);

  if (!selected) {
    return (
      <EmptyState
        title="No dataset selected"
        description="Load or select a dataset from the Data Explorer."
      />
    );
  }

  if (loading || !quality) return <Loading label="Analyzing data quality…" />;

  const addOp = (op: Operation) => setOps((prev) => [...prev, op]);
  const removeOp = (i: number) => setOps((prev) => prev.filter((_, idx) => idx !== i));

  const run = async () => {
    if (ops.length === 0) {
      toast("info", "Add at least one cleaning operation first.");
      return;
    }
    setRunning(true);
    try {
      const res = await post<any>(`/api/analysis/${selected.id}/clean`, {
        operations: ops,
        name: `${selected.name} (cleaned)`,
      });
      setResult(res);
      await refreshDatasets();
      await refreshActivity();
      toast(
        "success",
        `Cleaned dataset created — ${res.after.rows} rows remain.`,
      );
    } catch (err: any) {
      toast("error", err?.message ?? "Cleaning failed.");
    } finally {
      setRunning(false);
    }
  };

  const numericCols = quality.columns.filter((c) => c.kind === "numeric").map((c) => c.name);
  const catCols = quality.columns.filter((c) => c.kind === "categorical").map((c) => c.name);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-midnight-800">Data Quality Lab</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Inspect, clean and document dataset quality. The original dataset is never modified.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Quality score"
          value={`${quality.quality_score.toFixed(0)}/100`}
          tone={quality.quality_score >= 90 ? "teal" : quality.quality_score >= 70 ? "amber" : "red"}
        />
        <StatCard label="Rows" value={quality.rows.toLocaleString()} />
        <StatCard
          label="Missing cells"
          value={`${quality.missing_pct.toFixed(2)}%`}
          tone={quality.missing_pct > 5 ? "amber" : "teal"}
          hint={`${quality.missing_cells.toLocaleString()} cells`}
        />
        <StatCard
          label="Duplicate rows"
          value={quality.duplicate_rows.toLocaleString()}
          tone={quality.duplicate_rows > 0 ? "amber" : "teal"}
        />
      </div>

      {quality.warnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-sm text-amber-800">
              {quality.warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Column quality */}
        <div className="xl:col-span-2">
          <Card>
            <SectionTitle title="Column diagnostics" subtitle="Per-column quality and distribution" />
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="hs-table w-full">
                <thead>
                  <tr>
                    <th>Column</th>
                    <th>Type</th>
                    <th>Missing</th>
                    <th>Unique</th>
                    <th>Outliers</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {quality.columns.map((c) => (
                    <tr key={c.name}>
                      <td className="font-medium text-midnight-800">{c.name}</td>
                      <td>
                        <Badge
                          tone={
                            c.kind === "numeric" ? "royal" : c.kind === "datetime" ? "amber" : "teal"
                          }
                        >
                          {c.kind}
                        </Badge>
                      </td>
                      <td>
                        {c.missing} ({c.missing_pct.toFixed(1)}%)
                      </td>
                      <td>{c.unique}</td>
                      <td>{c.outliers ?? "—"}</td>
                      <td>
                        {c.constant && <Badge tone="red">Constant</Badge>}
                        {!c.constant && c.missing_pct > 20 && (
                          <Badge tone="amber">High missing</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Cleaning builder */}
        <div>
          <Card>
            <SectionTitle title="Cleaning operations" subtitle="Configure, then apply" />

            <div className="space-y-2 mb-4">
              <button
                className="w-full hs-btn-ghost justify-start"
                onClick={() => addOp({ operation: "drop_duplicates" })}
              >
                <Trash2 className="h-4 w-4" /> Remove duplicate rows
              </button>

              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="hs-label">Drop columns</div>
                <select
                  multiple
                  size={4}
                  className="hs-input h-auto"
                  onChange={(e) => {
                    const cols = Array.from(e.target.selectedOptions).map((o) => o.value);
                    if (cols.length)
                      addOp({ operation: "drop_columns", columns: cols });
                    e.target.selectedIndex = -1;
                  }}
                >
                  {quality.columns.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="hs-label">Impute numeric</div>
                <select
                  className="hs-input"
                  onChange={(e) => {
                    if (e.target.value)
                      addOp({
                        operation: "impute_numeric",
                        column: e.target.value,
                        strategy: "median",
                      });
                    e.target.value = "";
                  }}
                >
                  <option value="">Choose numeric column…</option>
                  {numericCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="hs-label">Impute categorical</div>
                <select
                  className="hs-input"
                  onChange={(e) => {
                    if (e.target.value)
                      addOp({
                        operation: "impute_categorical",
                        column: e.target.value,
                        strategy: "mode",
                      });
                    e.target.value = "";
                  }}
                >
                  <option value="">Choose categorical column…</option>
                  {catCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="hs-label">Scale numeric columns</div>
                <select
                  multiple
                  size={4}
                  className="hs-input h-auto"
                  onChange={(e) => {
                    const cols = Array.from(e.target.selectedOptions).map((o) => o.value);
                    if (cols.length)
                      addOp({ operation: "scale", columns: cols, method: "standardize" });
                    e.target.selectedIndex = -1;
                  }}
                >
                  {numericCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="hs-label">Replace outliers (IQR clip)</div>
                <select
                  className="hs-input"
                  onChange={(e) => {
                    if (e.target.value)
                      addOp({ operation: "replace_outliers", column: e.target.value });
                    e.target.value = "";
                  }}
                >
                  <option value="">Choose numeric column…</option>
                  {numericCols.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5 mb-4 max-h-64 overflow-y-auto">
              {ops.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No operations queued.</div>
              ) : (
                ops.map((op, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 bg-slate-50"
                  >
                    <code className="truncate text-midnight-700">{JSON.stringify(op)}</code>
                    <button
                      className="text-slate-400 hover:text-red-500 shrink-0"
                      onClick={() => removeOp(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <button className="hs-btn-primary flex-1" onClick={run} disabled={running || ops.length === 0}>
                <Wand2 className="h-4 w-4" />
                {running ? "Applying…" : `Apply ${ops.length} operation${ops.length === 1 ? "" : "s"}`}
              </button>
              {ops.length > 0 && (
                <button className="hs-btn-ghost" onClick={() => setOps([])} disabled={running}>
                  Clear
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Result */}
      {result && (
        <Card>
          <SectionTitle
            title="Cleaning result"
            subtitle={`New dataset created: ${result.dataset.name}`}
            right={
              <button
                className="hs-btn-primary"
                onClick={() => {
                  selectDataset(result.dataset.id);
                  setResult(null);
                }}
              >
                <Sparkles className="h-4 w-4" />
                Use cleaned dataset
              </button>
            }
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <CompareStat label="Rows" before={result.before.rows} after={result.after.rows} />
            <CompareStat
              label="Missing %"
              before={`${result.before.missing_pct.toFixed(2)}%`}
              after={`${result.after.missing_pct.toFixed(2)}%`}
            />
            <CompareStat
              label="Duplicates"
              before={result.before.duplicate_rows}
              after={result.after.duplicate_rows}
            />
            <CompareStat
              label="Quality"
              before={result.before.quality_score}
              after={result.after.quality_score}
            />
          </div>

          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200 flex items-center gap-2">
              <ListChecks className="h-3.5 w-3.5" />
              Operation log
            </div>
            <div className="divide-y divide-slate-100">
              {result.log.map((entry: any, i: number) => (
                <div key={i} className="px-3 py-2 text-xs flex items-start gap-2">
                  {entry.status === "applied" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <code className="font-semibold text-midnight-800">{entry.operation}</code>
                    <div className="text-slate-500 mt-0.5">{entry.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function CompareStat({
  label,
  before,
  after,
}: {
  label: string;
  before: any;
  after: any;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="hs-label mb-2">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-slate-400 line-through tabular-nums">{before}</span>
        <span className="text-lg font-semibold text-midnight-800 tabular-nums">{after}</span>
      </div>
    </div>
  );
}