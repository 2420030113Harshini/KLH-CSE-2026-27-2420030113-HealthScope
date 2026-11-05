import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Layers,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { del, get, post } from "../api/client";
import { useApp } from "../store/AppContext";
import { Badge, Card, EmptyState, Loading, SectionTitle } from "../components/ui";

type Options = {
  columns: {
    column_names: string[];
    numeric_columns: string[];
    categorical_columns: string[];
    datetime_columns: string[];
  };
  targets: { column: string; task: string; unique: number; missing: number }[];
  models: {
    classification: { id: string; label: string }[];
    regression: { id: string; label: string }[];
  };
};

type TrainResult = {
  task: "classification" | "regression";
  model: string;
  target: string;
  features: string[];
  n_train: number;
  n_test: number;
  metrics: Record<string, number>;
  confusion_matrix?: { labels: string[]; matrix: number[][] };
  feature_importance: { feature: string; importance: number }[];
  scatter?: { actual: number; predicted: number }[];
  warnings: string[];
  experiment_id: number | null;
};

export default function ModelLab() {
  const { selected, toast, refreshActivity } = useApp();
  const [options, setOptions] = useState<Options | null>(null);
  const [target, setTarget] = useState("");
  const [task, setTask] = useState<"classification" | "regression">("classification");
  const [model, setModel] = useState("random_forest");
  const [features, setFeatures] = useState<string[]>([]);
  const [testSize, setTestSize] = useState(0.25);
  const [seed, setSeed] = useState(42);
  const [running, setRunning] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<TrainResult | null>(null);
  const [compareResults, setCompareResults] = useState<any>(null);
  const [experiments, setExperiments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    get<Options>(`/api/models/options/${selected.id}`)
      .then(setOptions)
      .catch((err) => toast("error", err?.message ?? "Failed to load options."));
    get<{ items: any[] }>(`/api/experiments?dataset_id=${selected.id}`)
      .then((res) => setExperiments(res.items))
      .catch(() => {});
    setResult(null);
    setCompareResults(null);
    setTarget("");
    setFeatures([]);
  }, [selected, toast]);

  useEffect(() => {
    if (!target || !options) return;
    const meta = options.targets.find((t) => t.column === target);
    if (meta) {
      setTask(meta.task === "regression" ? "regression" : "classification");
    }
    setFeatures((prev) => (prev.includes(target) ? prev.filter((f) => f !== target) : prev));
  }, [target, options]);

  useEffect(() => {
    if (options && !features.length) {
      setFeatures(
        options.columns.numeric_columns.filter((c) => c !== target).slice(0, 6),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, target]);

  if (!selected) {
    return (
      <EmptyState
        title="No dataset selected"
        description="Load or select a dataset to train a model."
      />
    );
  }

  if (!options) return <Loading label="Loading model configuration…" />;

  const modelsForTask = task === "classification" ? options.models.classification : options.models.regression;

  const run = async () => {
    if (!target) {
      toast("info", "Select a target variable first.");
      return;
    }
    if (features.length === 0) {
      toast("info", "Select at least one feature.");
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await post<TrainResult>("/api/models/train", {
        dataset_id: selected.id,
        target,
        features,
        task,
        model,
        test_size: testSize,
        random_state: seed,
        stratify: true,
        save: true,
      });
      setResult(res);
      await refreshActivity();
      const exp = await get<{ items: any[] }>(`/api/experiments?dataset_id=${selected.id}`);
      setExperiments(exp.items);
      toast("success", `Model trained · ${res.n_train + res.n_test} rows used.`);
    } catch (err: any) {
      setError(err?.message ?? "Training failed.");
    } finally {
      setRunning(false);
    }
  };

  const runCompare = async () => {
    if (!target || features.length === 0) {
      toast("info", "Select a target and features first.");
      return;
    }
    setComparing(true);
    setCompareResults(null);
    try {
      const res = await post<any>("/api/models/compare", {
        dataset_id: selected.id,
        target,
        features,
        task,
        test_size: testSize,
        random_state: seed,
        save: false,
      });
      setCompareResults(res);
    } catch (err: any) {
      toast("error", err?.message ?? "Comparison failed.");
    } finally {
      setComparing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-midnight-800">Model Laboratory</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Train, evaluate and compare machine-learning models on your selected dataset.
        </p>
      </div>

      <Card>
        <SectionTitle title="Experiment configuration" subtitle="Target, features and split" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="hs-label mb-1.5 block">Target variable</label>
            <select className="hs-input" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Choose target…</option>
              {options.targets
                .filter((t) => t.task !== "unsupported")
                .map((t) => (
                  <option key={t.column} value={t.column}>
                    {t.column} — {t.task} ({t.unique} classes)
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="hs-label mb-1.5 block">Task</label>
            <select
              className="hs-input"
              value={task}
              onChange={(e) => setTask(e.target.value as any)}
            >
              <option value="classification">Classification</option>
              <option value="regression">Regression</option>
            </select>
          </div>

          <div>
            <label className="hs-label mb-1.5 block">Model</label>
            <select className="hs-input" value={model} onChange={(e) => setModel(e.target.value)}>
              {modelsForTask.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="hs-label mb-1.5 block">Test size ({Math.round(testSize * 100)}%)</label>
            <input
              type="range"
              min={10}
              max={50}
              value={testSize * 100}
              onChange={(e) => setTestSize(Number(e.target.value) / 100)}
              className="w-full"
            />
          </div>

          <div>
            <label className="hs-label mb-1.5 block">Random seed</label>
            <input
              type="number"
              className="hs-input"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="hs-label mb-2 block">Features ({features.length})</label>
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 rounded-lg border border-slate-200">
            {options.columns.column_names
              .filter((c) => c !== target)
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

        <div className="flex gap-2">
          <button className="hs-btn-primary" onClick={run} disabled={running}>
            <FlaskConical className="h-4 w-4" />
            {running ? "Training…" : "Train model"}
          </button>
          <button className="hs-btn-ghost" onClick={runCompare} disabled={comparing}>
            <Layers className="h-4 w-4" />
            {comparing ? "Comparing…" : "Compare all models"}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </Card>

      {result && <ResultView result={result} />}

      {compareResults && (
        <Card>
          <SectionTitle
            title="Model comparison"
            subtitle={`Task: ${compareResults.task} · ${compareResults.results.length} models succeeded`}
          />
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="hs-table w-full">
              <thead>
                <tr>
                  <th>Model</th>
                  {Object.keys(compareResults.results[0]?.metrics ?? {}).map((m) => (
                    <th key={m}>{m.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareResults.results.map((r: any) => (
                  <tr key={r.model}>
                    <td className="font-medium text-midnight-800">{r.model}</td>
                    {Object.values(r.metrics).map((v: any, i) => (
                      <td key={i} className="tabular-nums">
                        {typeof v === "number" ? v.toFixed(3) : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {compareResults.errors?.length > 0 && (
            <div className="mt-3 text-xs text-slate-500">
              Skipped: {compareResults.errors.map((e: any) => e.model).join(", ")}
            </div>
          )}
        </Card>
      )}

      {experiments.length > 0 && (
        <Card>
          <SectionTitle title="Saved experiments" subtitle={`${experiments.length} runs`} />
          <div className="space-y-2">
            {experiments.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
              >
                <div className="h-8 w-8 rounded-lg bg-pale flex items-center justify-center text-royal shrink-0">
                  <FlaskConical className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-midnight-800 truncate">{e.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {e.task} · target: {e.target} · {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {Object.entries(e.metrics).slice(0, 3).map(([k, v]: any) => (
                    <Badge key={k} tone="royal">
                      {k}: {typeof v === "number" ? v.toFixed(2) : v}
                    </Badge>
                  ))}
                </div>
                <button
                  className="text-slate-400 hover:text-red-500 p-1"
                  onClick={async () => {
                    await del(`/api/experiments/${e.id}`);
                    const res = await get<{ items: any[] }>(
                      `/api/experiments?dataset_id=${selected.id}`,
                    );
                    setExperiments(res.items);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function ResultView({ result }: { result: TrainResult }) {
  return (
    <>
      <Card>
        <SectionTitle
          title="Evaluation"
          subtitle={`${result.model} · ${result.task} · ${result.n_train} train / ${result.n_test} test`}
          right={
            result.experiment_id ? (
              <Badge tone="teal">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Saved
              </Badge>
            ) : undefined
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {Object.entries(result.metrics).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-slate-200 p-3">
              <div className="hs-label mb-1">{k.toUpperCase()}</div>
              <div className="text-xl font-semibold tabular-nums">
                {typeof v === "number" ? v.toFixed(3) : v}
              </div>
            </div>
          ))}
        </div>

        {result.warnings?.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1 mb-4">
            {result.warnings.map((w, i) => (
              <div key={i} className="flex gap-2">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {result.confusion_matrix && (
          <div className="mb-5">
            <div className="hs-label mb-2">Confusion matrix</div>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="p-2"></th>
                    {result.confusion_matrix.labels.map((l) => (
                      <th key={l} className="p-2 text-slate-500 font-semibold">
                        pred {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.confusion_matrix.matrix.map((row, i) => (
                    <tr key={i}>
                      <td className="p-2 text-slate-500 font-semibold text-right pr-3">
                        true {result.confusion_matrix!.labels[i]}
                      </td>
                      {row.map((v, j) => (
                        <td key={j} className="p-0">
                          <div
                            className="w-20 h-12 flex items-center justify-center font-semibold tabular-nums"
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result.feature_importance.length > 0 && (
          <div className="mb-5">
            <div className="hs-label mb-2">Feature importance</div>
            <ResponsiveContainer width="100%" height={Math.max(180, result.feature_importance.length * 22)}>
              <BarChart
                data={result.feature_importance.slice(0, 12)}
                layout="vertical"
                margin={{ left: 100 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="feature"
                  tick={{ fontSize: 11 }}
                  width={150}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                />
                <Bar dataKey="importance" fill="#4169E1" radius={[0, 6, 6, 0]}>
                  {result.feature_importance.slice(0, 12).map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#4169E1" : "#6C8CEA"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {result.scatter && result.scatter.length > 0 && (
          <div>
            <div className="hs-label mb-2">Predicted vs actual</div>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="actual" name="Actual" tick={{ fontSize: 11 }} />
                <YAxis dataKey="predicted" name="Predicted" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                />
                <Scatter data={result.scatter} fill="#14B8A6" fillOpacity={0.55} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle title="Metric definitions" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm text-slate-600">
          {result.task === "classification" ? (
            <>
              <Def term="Accuracy" desc="Proportion of all predictions that are correct." />
              <Def term="Precision" desc="Of the samples predicted positive, how many truly are." />
              <Def term="Recall" desc="Of the true positives, how many the model caught." />
              <Def term="F1" desc="Harmonic mean of precision and recall." />
              <Def term="ROC-AUC" desc="Ranking quality across thresholds; 0.5 = random, 1.0 = perfect." />
            </>
          ) : (
            <>
              <Def term="MAE" desc="Mean absolute error — average magnitude of residuals." />
              <Def term="RMSE" desc="Root mean squared error — penalises larger errors more." />
              <Def term="R²" desc="Variance explained. 1.0 = perfect, 0 = predicts the mean, <0 = worse." />
            </>
          )}
        </div>
      </Card>
    </>
  );
}

function Def({ term, desc }: { term: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="font-semibold text-midnight-800 w-20 shrink-0">{term}</div>
      <div className="text-slate-500">{desc}</div>
    </div>
  );
}