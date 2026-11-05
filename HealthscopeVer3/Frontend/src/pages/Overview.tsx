import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Database,
  FlaskConical,
  Heart,
  Layers,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { get } from "../api/client";
import { useApp } from "../store/AppContext";
import { Card, EmptyState, Loading, StatCard } from "../components/ui";
import ChartCard from "../components/ChartCard";

type Overview = {
  dataset: {
    id: string;
    name: string;
    source: string;
    description: string;
    rows: number;
    columns: number;
    is_demo: boolean;
    created_at: string;
  };
  kpis: {
    total_records: number;
    total_columns: number;
    missing_pct: number;
    indicators: number;
    duplicate_rows: number;
    quality_score: number;
    categorical_columns: number;
    datetime_columns: number;
  };
  quality: {
    score: number;
    warnings: string[];
    top_missing: { column: string; missing_pct: number }[];
  };
  trend: any;
  demographic: any;
  correlation: any;
};

const ROYAL_TONES = ["#4169E1", "#14B8A6", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9"];

export default function Overview() {
  const navigate = useNavigate();
  const { selected, loadDemo, activities, loadingDatasets, datasets } = useApp();
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    get<Overview>(`/api/analysis/${selected.id}/overview`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load overview.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (loadingDatasets) return <Loading label="Connecting to HealthScope API…" />;

  if (!selected) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-midnight-800">
            Public Health Intelligence
          </h1>
          <p className="text-slate-500 mt-1.5">
            Explore the patterns. Understand the factors. Support better decisions.
          </p>
        </div>

        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="Welcome to HealthScope"
          description="Load a dataset to begin. You can start with a deterministic synthetic demonstration dataset, or upload your own CSV/XLSX public-health data."
          action={
            <>
              <button className="hs-btn-primary" onClick={() => loadDemo()}>
                <Sparkles className="h-4 w-4" />
                Load demonstration dataset
              </button>
              <button className="hs-btn-ghost" onClick={() => navigate("/data")}>
                <Database className="h-4 w-4" />
                Upload your own
              </button>
            </>
          }
        />

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            The demonstration dataset is <strong>synthetic</strong> — values are generated with
            plausible relationships for software demonstration only. It must not be cited as
            evidence, and HealthScope is not a medical device.
          </div>
        </div>
      </div>
    );
  }

  if (loading || !data) return <Loading label="Loading overview…" />;
  if (error) {
    return (
      <Card className="border-red-200">
        <div className="text-sm text-red-700">{error}</div>
      </Card>
    );
  }

  const k = data.kpis;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-midnight-800">
            Public Health Intelligence
          </h1>
          <p className="text-slate-500 mt-1">
            Explore the patterns. Understand the factors. Support better decisions.
          </p>
        </div>
        {data.dataset.is_demo && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" />
            Synthetic demonstration data
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Records analyzed"
          value={k.total_records.toLocaleString()}
          icon={<Database className="h-4 w-4" />}
        />
        <StatCard
          label="Datasets loaded"
          value={datasets.length}
          icon={<Layers className="h-4 w-4" />}
          tone="teal"
        />
        <StatCard
          label="Missing values"
          value={`${k.missing_pct.toFixed(2)}%`}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={k.missing_pct > 5 ? "amber" : "teal"}
        />
        <StatCard
          label="Indicators analyzed"
          value={k.indicators}
          hint={`${k.total_columns} total columns`}
          icon={<BarChart3 className="h-4 w-4" />}
          tone="royal"
        />
        <StatCard
          label="Quality score"
          value={`${k.quality_score.toFixed(0)}/100`}
          icon={<ShieldAlert className="h-4 w-4" />}
          tone={k.quality_score >= 90 ? "teal" : k.quality_score >= 70 ? "amber" : "red"}
        />
        <StatCard
          label="Last analysis"
          value={new Date(data.dataset.created_at).toLocaleDateString()}
          hint={new Date(data.dataset.created_at).toLocaleTimeString()}
          icon={<Activity className="h-4 w-4" />}
          tone="slate"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ChartCard
          title="Health trend over time"
          subtitle={data.trend ? `${data.trend.y_label} by ${data.trend.x_label}` : undefined}
          empty={
            data.trend
              ? undefined
              : {
                  title: "No time-series indicator available",
                  description: "This dataset has no date column or numeric indicator.",
                }
          }
        >
          {data.trend && (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.trend.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey={data.trend.x_key} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey={data.trend.y_key}
                  stroke="#4169E1"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Demographic comparison"
          subtitle={
            data.demographic
              ? `${data.demographic.y_label} by ${data.demographic.x_label}`
              : undefined
          }
          empty={
            data.demographic
              ? undefined
              : {
                  title: "No demographic column available",
                  description: "This dataset has no region / age group / sex style column.",
                }
          }
        >
          {data.demographic && (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.demographic.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey={data.demographic.x_key} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                />
                <Bar dataKey={data.demographic.y_key} radius={[6, 6, 0, 0]}>
                  {data.demographic.data.map((_: any, i: number) => (
                    <Cell key={i} fill={ROYAL_TONES[i % ROYAL_TONES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <ChartCard
            title="Correlation heatmap"
            subtitle={
              data.correlation
                ? `Pearson correlation across ${data.correlation.columns.length} numeric columns`
                : undefined
            }
            empty={
              data.correlation
                ? undefined
                : {
                    title: "Not enough numeric columns",
                    description:
                      "At least two numeric columns are required to compute a correlation matrix.",
                  }
            }
          >
            {data.correlation && (
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="p-1.5"></th>
                      {data.correlation.columns.map((c: string) => (
                        <th
                          key={c}
                          className="p-1.5 text-slate-500 font-semibold whitespace-nowrap"
                        >
                          {c.length > 10 ? c.slice(0, 9) + "…" : c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.correlation.columns.map((row: string, i: number) => (
                      <tr key={row}>
                        <td className="p-1.5 text-slate-500 font-semibold whitespace-nowrap text-right pr-3">
                          {row.length > 14 ? row.slice(0, 13) + "…" : row}
                        </td>
                        {data.correlation.matrix[i].map((v: number, j: number) => {
                          const intensity = Math.abs(v);
                          const color =
                            v >= 0
                              ? `rgba(65, 105, 225, ${intensity})`
                              : `rgba(239, 68, 68, ${intensity})`;
                          return (
                            <td
                              key={j}
                              className="p-0 text-center"
                              title={`r = ${v.toFixed(3)}`}
                              style={{ width: 42, height: 42 }}
                            >
                              <div
                                className="w-full h-full flex items-center justify-center font-semibold"
                                style={{
                                  backgroundColor: color,
                                  color: intensity > 0.4 ? "white" : "#334155",
                                  borderRadius: 4,
                                  fontSize: 10,
                                }}
                              >
                                {v.toFixed(2)}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.correlation.top_pairs?.length > 0 && (
                  <div className="mt-4 text-xs text-slate-500">
                    <div className="font-semibold text-slate-600 mb-1">
                      Strongest observed associations
                    </div>
                    {data.correlation.top_pairs.slice(0, 3).map((p: any, i: number) => (
                      <div key={i}>
                        {p.a} ↔ {p.b}: r = {p.r.toFixed(3)} (n = {p.n})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </ChartCard>
        </div>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-midnight-800">Data quality summary</h3>
            <span
              className={`text-sm font-bold ${
                k.quality_score >= 90
                  ? "text-teal"
                  : k.quality_score >= 70
                    ? "text-amber-600"
                    : "text-red-600"
              }`}
            >
              {k.quality_score.toFixed(0)}
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full ${
                k.quality_score >= 90
                  ? "bg-teal"
                  : k.quality_score >= 70
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${k.quality_score}%` }}
            />
          </div>
          <div className="mt-4 space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Duplicates</span>
              <span className="font-semibold tabular-nums">{k.duplicate_rows}</span>
            </div>
            <div className="flex justify-between">
              <span>Missing cells</span>
              <span className="font-semibold tabular-nums">{k.missing_pct.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Categorical columns</span>
              <span className="font-semibold tabular-nums">{k.categorical_columns}</span>
            </div>
            <div className="flex justify-between">
              <span>Date columns</span>
              <span className="font-semibold tabular-nums">{k.datetime_columns}</span>
            </div>
          </div>
          {data.quality.warnings.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
              {data.quality.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-royal" />
          <h3 className="text-sm font-semibold text-midnight-800">Recent activity</h3>
        </div>
        {activities.length === 0 ? (
          <div className="text-sm text-slate-500 py-6 text-center">No activity yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 -mx-5">
            {activities.slice(0, 6).map((a) => (
              <div key={a.id} className="px-5 py-3 flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg bg-pale flex items-center justify-center text-royal shrink-0">
                  {a.kind === "model" ? (
                    <FlaskConical className="h-3.5 w-3.5" />
                  ) : a.kind === "upload" ? (
                    <Database className="h-3.5 w-3.5" />
                  ) : a.kind === "cleaning" ? (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  ) : (
                    <Heart className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-midnight-800 truncate">{a.message}</div>
                  {a.created_at && (
                    <div className="text-[11px] text-slate-400">
                      {new Date(a.created_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}