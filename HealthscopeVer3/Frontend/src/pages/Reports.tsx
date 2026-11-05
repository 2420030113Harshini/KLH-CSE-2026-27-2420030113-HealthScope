import { useMemo, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { get, post } from "../api/client";
import { useApp } from "../store/AppContext";
import { Card, EmptyState, Loading, SectionTitle } from "../components/ui";

export default function Reports() {
  const { selected, datasets, activities, toast } = useApp();
  const [building, setBuilding] = useState(false);
  const [report, setReport] = useState<any>(null);

  const filteredDatasets = useMemo(() => datasets, [datasets]);

  const buildReport = async () => {
    if (!selected) return;
    setBuilding(true);
    setReport(null);
    try {
      const [overview, quality, stats] = await Promise.all([
        get<any>(`/api/analysis/${selected.id}/overview`),
        get<any>(`/api/analysis/${selected.id}/quality`),
        get<any>(`/api/datasets/${selected.id}/statistics`),
      ]);
      setReport({
        generated_at: new Date().toISOString(),
        dataset: overview.dataset,
        kpis: overview.kpis,
        quality: overview.quality,
        stats: stats.stats,
        correlation: overview.correlation,
        recent_activity: activities.slice(0, 10),
        column_quality: quality.columns,
      });
      toast("success", "Report generated.");
    } catch (err: any) {
      toast("error", err?.message ?? "Report generation failed.");
    } finally {
      setBuilding(false);
    }
  };

  const downloadCSV = () => {
    if (!selected) return;
    window.open(`/api/datasets/${selected.id}/download`, "_blank");
  };

  const downloadSummaryCSV = () => {
    if (!report) return;
    const rows: string[][] = [["Section", "Key", "Value"]];
    rows.push(["Dataset", "Name", report.dataset.name]);
    rows.push(["Dataset", "Source", report.dataset.source]);
    rows.push(["Dataset", "Rows", String(report.dataset.rows)]);
    rows.push(["Dataset", "Columns", String(report.dataset.columns)]);
    Object.entries(report.kpis).forEach(([k, v]) =>
      rows.push(["KPI", k, String(v)]),
    );
    (report.column_quality ?? []).forEach((c: any) => {
      rows.push([
        "Column",
        c.name,
        `dtype=${c.dtype}, missing=${c.missing}, unique=${c.unique}`,
      ]);
    });
    (report.stats ?? []).forEach((s: any) => {
      const bits = Object.entries(s)
        .filter(([k]) => k !== "column" && k !== "top_values")
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
      rows.push(["Statistic", s.column, bits]);
    });

    const csv = rows
      .map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `healthscope_summary_${selected.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadHTML = () => {
    if (!report) return;
    const html = buildHTMLReport(report);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `healthscope_report_${report.dataset.name.replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    if (!report) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(buildHTMLReport(report));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-midnight-800">Reports</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Generate reproducible summaries of your dataset and analyses.
        </p>
      </div>

      {!selected ? (
        <EmptyState
          title="No dataset selected"
          description="Select a dataset to build a report."
        />
      ) : (
        <>
          <Card>
            <SectionTitle
              title="Report builder"
              subtitle={`Source dataset: ${selected.name}`}
              right={
                <button className="hs-btn-primary" onClick={buildReport} disabled={building}>
                  <FileText className="h-4 w-4" />
                  {building ? "Building…" : "Generate report"}
                </button>
              }
            />

            <div className="flex flex-wrap gap-2">
              <button className="hs-btn-ghost" onClick={downloadCSV}>
                <FileSpreadsheet className="h-4 w-4" />
                Download dataset (CSV)
              </button>
              <button
                className="hs-btn-ghost"
                onClick={downloadSummaryCSV}
                disabled={!report}
              >
                <Download className="h-4 w-4" />
                Download summary (CSV)
              </button>
              <button className="hs-btn-ghost" onClick={downloadHTML} disabled={!report}>
                <FileText className="h-4 w-4" />
                Download report (HTML)
              </button>
              <button className="hs-btn-ghost" onClick={printReport} disabled={!report}>
                <Printer className="h-4 w-4" />
                Print / PDF
              </button>
            </div>
          </Card>

          {building && <Loading label="Assembling report from the live dataset…" />}

          {report && (
            <Card>
              <div className="space-y-6 text-sm">
                <div>
                  <div className="hs-label mb-1.5">Dataset</div>
                  <div className="text-lg font-semibold text-midnight-800">
                    {report.dataset.name}
                  </div>
                  <div className="text-slate-500 mt-0.5">{report.dataset.source}</div>
                  <div className="text-xs text-slate-400 mt-2">
                    Analysis date: {new Date(report.generated_at).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="hs-label mb-2">Key indicators</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(report.kpis).map(([k, v]: any) => (
                      <div key={k} className="rounded-lg border border-slate-200 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          {k.replace(/_/g, " ")}
                        </div>
                        <div className="text-base font-semibold text-midnight-800 mt-1 tabular-nums">
                          {typeof v === "number" ? v.toLocaleString() : v}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {report.quality.warnings?.length > 0 && (
                  <div>
                    <div className="hs-label mb-2">Quality warnings</div>
                    <ul className="list-disc pl-5 text-amber-700 space-y-1">
                      {report.quality.warnings.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.correlation?.top_pairs?.length > 0 && (
                  <div>
                    <div className="hs-label mb-2">Strongest pairwise correlations</div>
                    <ul className="list-disc pl-5 text-slate-600 space-y-1">
                      {report.correlation.top_pairs.slice(0, 5).map((p: any, i: number) => (
                        <li key={i}>
                          {p.a} ↔ {p.b}: r = {p.r.toFixed(3)} (n = {p.n})
                        </li>
                      ))}
                    </ul>
                    <div className="text-xs text-slate-400 mt-1">
                      Correlation does not imply causation.
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-3">
                  <ShieldAlert className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800 leading-relaxed">
                    <strong>Limitations.</strong> HealthScope is a research and educational
                    decision-support tool. All statistics describe the loaded dataset slice and do
                    not represent population truth. Never use this output for individual
                    diagnosis, treatment, or medical decision-making.
                  </div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function buildHTMLReport(report: any): string {
  const statRows = (report.stats ?? [])
    .map((s: any) => {
      const vals = [
        s.dtype,
        s.count,
        s.missing,
        s.unique,
        s.mean ?? "",
        s.median ?? "",
        s.std ?? "",
        s.min ?? "",
        s.max ?? "",
      ];
      return `<tr>${vals.map((v) => `<td>${v}</td>`).join("")}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>HealthScope Report</title>
<style>
body{font-family:Inter,system-ui,sans-serif;color:#101A35;background:#F3F5FA;margin:0;padding:32px}
.wrap{max-width:900px;margin:auto;background:white;padding:40px;border-radius:16px;box-shadow:0 4px 16px rgba(16,26,53,.06)}
h1{margin:0;color:#101A35}
h2{color:#101A35;border-bottom:2px solid #EAF2FF;padding-bottom:6px;margin-top:32px}
.sub{color:#64748B;margin-top:4px}
.tag{display:inline-block;background:#EAF2FF;color:#4169E1;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600}
.warn{background:#FEF3C7;border-left:4px solid #F59E0B;padding:12px;border-radius:8px;color:#78350F;font-size:13px;line-height:1.5;margin-top:16px}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}
th{text-align:left;background:#F8FAFC;padding:8px;color:#64748B;font-weight:600;border-bottom:1px solid #E2E8F0}
td{padding:8px;border-bottom:1px solid #F1F5F9}
.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:12px}
.kpi div{background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:12px}
.kpi .l{font-size:10px;text-transform:uppercase;color:#64748B;letter-spacing:.05em;font-weight:600}
.kpi .v{font-size:18px;font-weight:600;color:#101A35;margin-top:4px}
footer{margin-top:40px;padding-top:16px;border-top:1px solid #E2E8F0;font-size:11px;color:#94A3B8;text-align:center}
</style></head>
<body><div class="wrap">
<span class="tag">HealthScope Report</span>
<h1 style="margin-top:12px">${report.dataset.name}</h1>
<div class="sub">${report.dataset.source || "Source not specified"}</div>
<div class="sub" style="font-size:12px">Generated ${new Date(report.generated_at).toLocaleString()}</div>

<h2>Key indicators</h2>
<div class="kpi">
${Object.entries(report.kpis)
  .map(
    ([k, v]: any) =>
      `<div><div class="l">${k.replace(/_/g, " ")}</div><div class="v">${
        typeof v === "number" ? v.toLocaleString() : v
      }</div></div>`,
  )
  .join("")}
</div>

<h2>Column statistics</h2>
<table><thead><tr>
<th>Column</th><th>Dtype</th><th>Count</th><th>Missing</th><th>Unique</th>
<th>Mean</th><th>Median</th><th>Std</th><th>Min</th><th>Max</th>
</tr></thead><tbody>${statRows}</tbody></table>

${
  report.quality.warnings?.length
    ? `<h2>Quality warnings</h2><ul>${report.quality.warnings
        .map((w: string) => `<li>${w}</li>`)
        .join("")}</ul>`
    : ""
}

${
  report.correlation?.top_pairs?.length
    ? `<h2>Strongest correlations</h2><ul>${report.correlation.top_pairs
        .slice(0, 8)
        .map((p: any) => `<li>${p.a} ↔ ${p.b}: r = ${p.r.toFixed(3)} (n=${p.n})</li>`)
        .join("")}</ul>`
    : ""
}

<div class="warn">
<strong>Limitations.</strong> HealthScope is a research and educational decision-support tool.
All statistics describe this specific dataset slice and do not represent population truth.
Correlation does not imply causation. Never use this output for individual diagnosis, treatment,
or medical decision-making.
</div>

<footer>HealthScope · Population-level research and educational decision support only — not a medical device.</footer>
</div></body></html>`;
}