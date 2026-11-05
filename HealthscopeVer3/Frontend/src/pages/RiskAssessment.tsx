import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Activity,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { post } from "../api/client";
import { useApp } from "../store/AppContext";
import { Badge, Card, EmptyState, Loading, SectionTitle } from "../components/ui";

const CATEGORY_TONES: Record<string, string> = {
  Low: "#14B8A6",
  Moderate: "#F59E0B",
  High: "#EF4444",
};

export default function RiskAssessment() {
  const { selected, toast } = useApp();
  const [method, setMethod] = useState<"rule_based" | "model_based">("rule_based");
  const [variable, setVariable] = useState("");
  const [low, setLow] = useState<string>("");
  const [high, setHigh] = useState<string>("");
  const [groupBy, setGroupBy] = useState("");
  const [model, setModel] = useState("random_forest");
  const [features, setFeatures] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    setVariable(selected.numeric_columns[0] ?? "");
    setFeatures(selected.numeric_columns.slice(1, 6));
    setGroupBy(selected.categorical_columns[0] ?? "");
    setResult(null);
    setError(null);
  }, [selected]);

  if (!selected) {
    return (
      <EmptyState
        title="No dataset selected"
        description="Load or select a dataset to run a risk assessment."
      />
    );
  }

  const run = async () => {
    if (!variable) {
      toast("info", "Select a numeric variable to assess.");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const body: any = {
        dataset_id: selected.id,
        variable,
        method,
        group_by: groupBy || null,
        filters: [],
      };
      if (low !== "") body.low_threshold = Number(low);
      if (high !== "") body.high_threshold = Number(high);
      if (method === "model_based") {
        body.model = model;
        body.features = features;
      }
      const res = await post<any>("/api/risk/analyze", body);
      setResult(res);
      toast("success", "Risk assessment completed.");
    } catch (err: any) {
      setError(err?.message ?? "Assessment failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-midnight-800">
          Public Health Risk Assessment
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Population-level categorisation with configurable, documented thresholds.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 leading-relaxed">
            <strong>Population-level analysis only.</strong> Categories reflect the thresholds you
            choose and are not clinically validated. HealthScope does not diagnose disease,
            prescribe treatment, or predict individual medical risk.
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Configuration" subtitle="Choose method, variable and thresholds" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="hs-label mb-1.5 block">Method</label>
            <select
              className="hs-input"
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
            >
              <option value="rule_based">Rule-based (thresholds)</option>
              <option value="model_based">Model-based (learned categories)</option>
            </select>
          </div>

          <div>
            <label className="hs-label mb-1.5 block">Numeric variable</label>
            <select
              className="hs-input"
              value={variable}
              onChange={(e) => setVariable(e.target.value)}
            >
              <option value="">Choose numeric variable…</option>
              {selected.numeric_columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="hs-label mb-1.5 block">Group by (optional)</label>
            <select
              className="hs-input"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              <option value="">— none —</option>
              {selected.categorical_columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="hs-label mb-1.5 block">Low threshold (optional)</label>
            <input
              type="number"
              className="hs-input"
              placeholder="Auto = 33rd percentile"
              value={low}
              onChange={(e) => setLow(e.target.value)}
            />
          </div>

          <div>
            <label className="hs-label mb-1.5 block">High threshold (optional)</label>
            <input
              type="number"
              className="hs-input"
              placeholder="Auto = 67th percentile"
              value={high}
              onChange={(e) => setHigh(e.target.value)}
            />
          </div>

          {method === "model_based" && (
            <div>
              <label className="hs-label mb-1.5 block">Model</label>
              <select
                className="hs-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="logistic_regression">Logistic Regression</option>
                <option value="decision_tree">Decision Tree</option>
                <option value="random_forest">Random Forest</option>
                <option value="knn">K-Nearest Neighbors</option>
              </select>
            </div>
          )}
        </div>

        {method === "model_based" && (
          <div className="mb-4">
            <label className="hs-label mb-1.5 block">Feature columns</label>
            <div className="flex flex-wrap gap-1.5">
              {selected.numeric_columns
                .filter((c) => c !== variable)
                .map((c) => {
                  const on = features.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() =>
                        setFeatures((prev) =>
                          on ? prev.filter((x) => x !== c) : [...prev, c],
                        )
                      }
                      className={`rounded-full px-2.5 py-1 text-xs font-medium border transition ${
                        on
                          ? "border-royal bg-royal text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
            </div>
          </div>
        )}

        <button className="hs-btn-primary" onClick={run} disabled={running}>
          <ShieldAlert className="h-4 w-4" />
          {running ? "Running…" : "Run risk assessment"}
        </button>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </Card>

      {result && (
        <>
          <Card>
            <SectionTitle title="Rule and thresholds" subtitle={result.rule} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="hs-label mb-1">Sample size</div>
                <div className="text-xl font-semibold tabular-nums">
                  {result.n.toLocaleString()}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="hs-label mb-1">Low threshold</div>
                <div className="text-xl font-semibold tabular-nums">
                  {result.thresholds?.low?.toFixed(3) ?? "—"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="hs-label mb-1">High threshold</div>
                <div className="text-xl font-semibold tabular-nums">
                  {result.thresholds?.high?.toFixed(3) ?? "—"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div>
                <div className="hs-label mb-3">Category distribution</div>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={result.distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {result.distribution.map((d: any, i: number) => (
                        <Cell key={i} fill={CATEGORY_TONES[d.category] ?? "#4169E1"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div className="hs-label mb-3">Category statistics</div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="hs-table w-full">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>n</th>
                        <th>Mean</th>
                        <th>Min</th>
                        <th>Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.stats.map((s: any) => (
                        <tr key={s.category}>
                          <td>
                            <Badge
                              tone={
                                s.category === "Low"
                                  ? "teal"
                                  : s.category === "Moderate"
                                    ? "amber"
                                    : "red"
                              }
                            >
                              {s.category}
                            </Badge>
                          </td>
                          <td className="tabular-nums">{s.n}</td>
                          <td className="tabular-nums">{s.mean?.toFixed(3) ?? "—"}</td>
                          <td className="tabular-nums">{s.min?.toFixed(3) ?? "—"}</td>
                          <td className="tabular-nums">{s.max?.toFixed(3) ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Card>

          {result.model_validation && !result.model_validation.error && (
            <Card>
              <SectionTitle
                title="Model validation"
                subtitle={`${result.model_validation.model} · ${result.model_validation.task}`}
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                {Object.entries(result.model_validation.metrics).map(([k, v]: any) => (
                  <div key={k} className="rounded-lg border border-slate-200 p-3">
                    <div className="hs-label mb-1">{k.toUpperCase()}</div>
                    <div className="text-xl font-semibold tabular-nums">
                      {typeof v === "number" ? v.toFixed(3) : v}
                    </div>
                  </div>
                ))}
              </div>

              {result.model_validation.confusion_matrix && (
                <div className="mb-5">
                  <div className="hs-label mb-2">Confusion matrix</div>
                  <div className="overflow-x-auto">
                    <table className="text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="p-2"></th>
                          {result.model_validation.confusion_matrix.labels.map((l: string) => (
                            <th key={l} className="p-2 text-slate-500 font-semibold">
                              pred {l}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.model_validation.confusion_matrix.matrix.map(
                          (row: number[], i: number) => (
                            <tr key={i}>
                              <td className="p-2 text-slate-500 font-semibold text-right pr-3">
                                true {result.model_validation.confusion_matrix.labels[i]}
                              </td>
                              {row.map((v, j) => (
                                <td key={j} className="p-0">
                                  <div
                                    className="w-16 h-12 flex items-center justify-center font-semibold tabular-nums"
                                    style={{
                                      backgroundColor:
                                        i === j
                                          ? "rgba(20, 184, 166, 0.15)"
                                          : "rgba(239, 68, 68, 0.08)",
                                      color: i === j ? "#0F8F81" : "#B91C1C",
                                    }}
                                  >
                                    {v}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {result.model_validation.feature_importance?.length > 0 && (
                <div className="mb-5">
                  <div className="hs-label mb-2">Feature importance</div>
                  <div className="space-y-1.5">
                    {result.model_validation.feature_importance.slice(0, 8).map((f: any) => {
                      const max = result.model_validation.feature_importance[0].importance || 1;
                      return (
                        <div key={f.feature} className="flex items-center gap-3 text-xs">
                          <div className="w-48 truncate text-slate-700">{f.feature}</div>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-royal"
                              style={{ width: `${(f.importance / max) * 100}%` }}
                            />
                          </div>
                          <div className="w-16 text-right tabular-nums text-slate-500">
                            {f.importance.toFixed(3)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {result.model_validation.warnings?.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
                  {result.model_validation.warnings.map((w: string, i: number) => (
                    <div key={i} className="flex gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {result.by_group && (
            <Card>
              <SectionTitle
                title={`Distribution by ${result.by_group.group_by}`}
                subtitle="Counts of records per category by group"
              />
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={result.by_group.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="group" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                  />
                  <Bar dataKey="Low" stackId="a" fill={CATEGORY_TONES.Low} />
                  <Bar dataKey="Moderate" stackId="a" fill={CATEGORY_TONES.Moderate} />
                  <Bar dataKey="High" stackId="a" fill={CATEGORY_TONES.High} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card>
            <SectionTitle title="Limitations and uncertainty" />
            <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
              {result.notes.map((n: string, i: number) => (
                <li key={i}>{n}</li>
              ))}
              <li>
                Thresholds were configured by the user or defaulted to sample tertiles, which are
                data-dependent and not clinically validated.
              </li>
              <li>
                Predicted vs observed categories may differ; the confusion matrix above quantifies
                that difference only within this dataset slice.
              </li>
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}