import { useEffect, useState } from "react";
import {
  BarChart3,
  Box,
  LineChart as LineIcon,
  ScatterChart as ScatterChartIcon,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { post } from "../api/client";
import { useApp } from "../store/AppContext";
import { Card, EmptyState, Loading, SectionTitle } from "../components/ui";
import ChartCard from "../components/ChartCard";
import BoxPlot from "../components/BoxPlot";

const ROYAL_TONES = ["#4169E1", "#14B8A6", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9"];

const CHART_TYPES = [
  { id: "histogram", label: "Histogram", icon: BarChart3 },
  { id: "bar", label: "Bar", icon: BarChart3 },
  { id: "line", label: "Line", icon: LineIcon },
  { id: "scatter", label: "Scatter", icon: ScatterChartIcon },
  { id: "box", label: "Box plot", icon: Box },
] as const;

export default function EDALab() {
  const { selected, toast } = useApp();
  const [chartType, setChartType] = useState<string>("histogram");
  const [x, setX] = useState<string>("");
  const [y, setY] = useState<string>("");
  const [groupBy, setGroupBy] = useState<string>("");
  const [bins, setBins] = useState(20);
  const [agg, setAgg] = useState("mean");
  const [topN, setTopN] = useState(15);

  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [corrData, setCorrData] = useState<any>(null);
  const [corrLoading, setCorrLoading] = useState(false);

  // Autoselect sensible defaults when dataset changes
  useEffect(() => {
    if (!selected) return;
    setX(selected.numeric_columns[0] ?? selected.categorical_columns[0] ?? "");
    setY(selected.numeric_columns[1] ?? selected.numeric_columns[0] ?? "");
    setGroupBy("");
    setChartData(null);
    setCorrData(null);
  }, [selected]);

  const fetchChart = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const spec: any = { chart_type: chartType, bins, agg, top_n: topN, filters: [] };
      if (x) spec.x = x;
      if (y) spec.y = y;
      if (groupBy) spec.group_by = groupBy;
      const res = await post<any>(`/api/analysis/${selected.id}/chart`, spec);
      setChartData(res);
    } catch (err: any) {
      setError(err?.message ?? "Chart failed.");
      setChartData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selected && x) fetchChart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, chartType, x, y, groupBy, bins, agg, topN]);

  const fetchCorrelation = async () => {
    if (!selected || selected.numeric_columns.length < 2) return;
    setCorrLoading(true);
    try {
      const res = await post<any>(`/api/analysis/${selected.id}/correlation`, {
        columns: selected.numeric_columns.slice(0, 10),
        method: "pearson",
        filters: [],
      });
      setCorrData(res);
    } catch (err: any) {
      toast("error", err?.message ?? "Correlation failed.");
    } finally {
      setCorrLoading(false);
    }
  };

  useEffect(() => {
    if (selected) fetchCorrelation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (!selected) {
    return (
      <EmptyState
        title="No dataset selected"
        description="Load or select a dataset to begin exploring."
      />
    );
  }

  const allCols = selected.column_names;
  const numCols = selected.numeric_columns;
  const catCols = selected.categorical_columns;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-midnight-800">
          Exploratory Data Analysis
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Build interactive visualisations and inspect distributions, relationships and groupings.
        </p>
      </div>

      {/* Chart builder */}
      <Card>
        <SectionTitle title="Chart builder" subtitle="Choose a chart type and configure the axes" />

        <div className="flex flex-wrap gap-2 mb-5">
          {CHART_TYPES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setChartType(id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border transition ${
                chartType === id
                  ? "border-royal bg-royal text-white shadow-soft"
                  : "border-slate-200 bg-white text-midnight-800 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div>
            <label className="hs-label mb-1.5 block">
              {chartType === "box" ? "Group by (optional)" : "X axis"}
            </label>
            <select className="hs-input" value={x} onChange={(e) => setX(e.target.value)}>
              <option value="">— none —</option>
              {(chartType === "histogram" ? numCols : allCols).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {(chartType === "bar" || chartType === "line" || chartType === "scatter" || chartType === "box") && (
            <div>
              <label className="hs-label mb-1.5 block">
                {chartType === "box" ? "Value column" : "Y axis"}
              </label>
              <select className="hs-input" value={y} onChange={(e) => setY(e.target.value)}>
                <option value="">— none —</option>
                {numCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {chartType === "line" && (
            <div>
              <label className="hs-label mb-1.5 block">Series (optional)</label>
              <select
                className="hs-input"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <option value="">— single series —</option>
                {catCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {chartType === "scatter" && (
            <div>
              <label className="hs-label mb-1.5 block">Color by (optional)</label>
              <select
                className="hs-input"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
              >
                <option value="">— none —</option>
                {catCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {chartType === "histogram" && (
            <div>
              <label className="hs-label mb-1.5 block">Bins</label>
              <input
                type="number"
                className="hs-input"
                value={bins}
                min={2}
                max={100}
                onChange={(e) => setBins(Number(e.target.value))}
              />
            </div>
          )}

          {chartType === "bar" && (
            <>
              <div>
                <label className="hs-label mb-1.5 block">Aggregation</label>
                <select className="hs-input" value={agg} onChange={(e) => setAgg(e.target.value)}>
                  <option value="mean">Mean</option>
                  <option value="median">Median</option>
                  <option value="sum">Sum</option>
                  <option value="count">Count</option>
                  <option value="max">Max</option>
                  <option value="min">Min</option>
                </select>
              </div>
              <div>
                <label className="hs-label mb-1.5 block">Top N</label>
                <input
                  type="number"
                  className="hs-input"
                  value={topN}
                  min={1}
                  max={50}
                  onChange={(e) => setTopN(Number(e.target.value))}
                />
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Chart */}
      <ChartCard
        title={`${chartType[0].toUpperCase() + chartType.slice(1)} chart`}
        subtitle={
          chartData
            ? `n = ${chartData.n.toLocaleString()} rows`
            : loading
              ? "Computing…"
              : undefined
        }
        empty={
          error
            ? { title: "Could not render chart", description: error }
            : undefined
        }
      >
        {loading ? (
          <Loading />
        ) : chartData ? (
          <ChartRenderer chart={chartData} />
        ) : (
          <div className="py-12 text-center text-sm text-slate-500">
            Configure the chart above to see results.
          </div>
        )}
      </ChartCard>

      {/* Correlation */}
      <Card>
        <SectionTitle
          title="Correlation matrix"
          subtitle={
            corrData
              ? `Pearson · ${corrData.columns.length} numeric columns`
              : "Computing…"
          }
          right={
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Correlation ≠ causation
            </span>
          }
        />
        {corrLoading ? (
          <Loading />
        ) : corrData ? (
          <>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="p-1.5"></th>
                    {corrData.columns.map((c: string) => (
                      <th key={c} className="p-1.5 text-slate-500 font-semibold whitespace-nowrap">
                        {c.length > 10 ? c.slice(0, 9) + "…" : c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {corrData.columns.map((row: string, i: number) => (
                    <tr key={row}>
                      <td className="p-1.5 text-slate-500 font-semibold text-right pr-3 whitespace-nowrap">
                        {row.length > 14 ? row.slice(0, 13) + "…" : row}
                      </td>
                      {corrData.matrix[i].map((v: number, j: number) => {
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
            </div>

            {corrData.top_pairs?.length > 0 && (
              <div className="mt-5">
                <div className="hs-label mb-2">Strongest observed pairwise associations</div>
                <div className="space-y-2">
                  {corrData.top_pairs.map((p: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 text-xs rounded-lg border border-slate-200 px-3 py-2"
                    >
                      <div className="font-semibold text-midnight-800">
                        {p.a} ↔ {p.b}
                      </div>
                      <div className="text-slate-500">r = {p.r.toFixed(3)}</div>
                      <div className="text-slate-400 ml-auto">n = {p.n}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  These coefficients describe linear association strength within this sample only.
                  They do not establish causality and are sensitive to outliers, sample size and
                  sampling method.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">
            Need at least two numeric columns.
          </div>
        )}
      </Card>
    </div>
  );
}

function ChartRenderer({ chart }: { chart: any }) {
  const height = 340;

  if (chart.chart_type === "histogram") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey={chart.x_key} tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
          />
          <Bar dataKey={chart.y_key} fill="#4169E1" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chart.chart_type === "bar") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey={chart.x_key} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
          />
          <Bar dataKey={chart.y_key} radius={[6, 6, 0, 0]}>
            {chart.data.map((_: any, i: number) => (
              <Cell key={i} fill={ROYAL_TONES[i % ROYAL_TONES.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chart.chart_type === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey={chart.x_key} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {chart.series.map((s: string, i: number) => (
            <Line
              key={s}
              type="monotone"
              dataKey={s}
              stroke={ROYAL_TONES[i % ROYAL_TONES.length]}
              strokeWidth={2.2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chart.chart_type === "scatter") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis
            type="number"
            dataKey="x"
            name={chart.x_label}
            tick={{ fontSize: 11 }}
            domain={["auto", "auto"]}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={chart.y_label}
            tick={{ fontSize: 11 }}
            domain={["auto", "auto"]}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {chart.series_data.map((s: any, i: number) => (
            <Scatter
              key={s.name}
              name={s.name}
              data={s.points}
              fill={ROYAL_TONES[i % ROYAL_TONES.length]}
              fillOpacity={0.6}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (chart.chart_type === "box") {
    return <BoxPlot data={chart.data} yLabel={chart.y_label} height={height} />;
  }

  return null;
}