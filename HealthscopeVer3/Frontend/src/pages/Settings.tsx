import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Database,
  ExternalLink,
  Heart,
  Info,
  Server,
  Trash2,
} from "lucide-react";
import { del, get } from "../api/client";
import { useApp } from "../store/AppContext";
import { Badge, Card, ConfirmDialog, Loading, SectionTitle } from "../components/ui";

export default function Settings() {
  const { refreshActivity, toast } = useApp();
  const [health, setHealth] = useState<any>(null);
  const [catalogue, setCatalogue] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    Promise.all([
      get<any>("/api/health"),
      get<any>("/api/catalogue"),
      get<any>("/api/activity?limit=100"),
    ])
      .then(([h, c, a]) => {
        setHealth(h);
        setCatalogue(c);
        setActivity(a);
      })
      .catch((err) => toast("error", err?.message ?? "Failed to load settings."))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <Loading label="Loading settings…" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-midnight-800">Settings</h1>
        <p className="text-slate-500 mt-1 text-sm">
          System information, dataset catalogue and activity log.
        </p>
      </div>

      {/* System */}
      <Card>
        <SectionTitle title="System" subtitle="Backend status" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-slate-200 p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-teal/10 text-teal flex items-center justify-center">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <div className="hs-label">API status</div>
              <div className="text-sm font-semibold text-midnight-800">
                {health?.status === "ok" ? "Connected" : "Unknown"}
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-royal/10 text-royal flex items-center justify-center">
              <Info className="h-4 w-4" />
            </div>
            <div>
              <div className="hs-label">Version</div>
              <div className="text-sm font-semibold text-midnight-800">
                {health?.version ?? "—"}
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <div className="hs-label">Service</div>
              <div className="text-sm font-semibold text-midnight-800">
                {health?.service ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Data catalogue */}
      <Card>
        <SectionTitle
          title="Public health dataset catalogue"
          subtitle="Reference sources — download manually and upload the CSV/XLSX"
        />
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-3 mb-4">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800 leading-relaxed">
            {catalogue?.note}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(catalogue?.datasets ?? []).map((d: any) => (
            <div key={d.name} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-semibold text-midnight-800">{d.name}</div>
                <Badge tone="royal">{d.date_range}</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">{d.description}</p>
              <div className="mt-3 space-y-1 text-[11px] text-slate-500">
                <div>
                  <span className="font-semibold text-slate-600">Coverage:</span> {d.coverage}
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Indicators:</span> {d.indicators}
                </div>
                <div>
                  <span className="font-semibold text-slate-600">Access:</span> {d.access}
                </div>
              </div>
              <a
                href={d.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-royal hover:text-royal-dark"
              >
                Open source <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      </Card>

      {/* Activity log */}
      <Card>
        <SectionTitle
          title="Activity log"
          subtitle={`${activity?.items?.length ?? 0} recent events`}
          right={
            (activity?.items?.length ?? 0) > 0 && (
              <button
                className="hs-btn-ghost text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setConfirmClear(true)}
              >
                <Trash2 className="h-4 w-4" />
                Clear log
              </button>
            )
          }
        />
        {!activity?.items?.length ? (
          <div className="text-sm text-slate-500 py-6 text-center">No activity yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 -mx-5">
            {activity.items.map((a: any) => (
              <div key={a.id} className="px-5 py-3 flex items-center gap-3">
                <Badge tone="slate">{a.kind}</Badge>
                <div className="flex-1 text-sm text-midnight-800 truncate">{a.message}</div>
                {a.created_at && (
                  <div className="text-[11px] text-slate-400 shrink-0">
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* About */}
      <Card>
        <SectionTitle title="About HealthScope" subtitle="Purpose and boundaries" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-600">
          <div className="space-y-3">
            <div className="flex gap-3">
              <BookOpen className="h-4 w-4 text-royal mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-midnight-800">What it does</div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Import public-health datasets, inspect and clean them, explore distributions and
                  correlations, train machine-learning models, and generate configurable
                  population-level risk categories.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Heart className="h-4 w-4 text-teal mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-midnight-800">Who it is for</div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Students, researchers, public-health analysts and other stakeholders working with
                  population-level data.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800 leading-relaxed">
                <strong className="block mb-1">What it is not</strong>
                HealthScope is not a medical device. It must not be used to diagnose disease,
                prescribe treatments, or present model predictions as confirmed individual medical
                risks. All analyses describe the loaded dataset and must be interpreted alongside
                study design, sampling and known limitations.
              </div>
            </div>
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmClear}
        title="Clear activity log?"
        message="This removes the local record of recent analyses. It does not delete datasets."
        confirmLabel="Clear log"
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          await del("/api/activity");
          const fresh = await get<any>("/api/activity?limit=100");
          setActivity(fresh);
          await refreshActivity();
          setConfirmClear(false);
          toast("success", "Activity log cleared.");
        }}
      />
    </div>
  );
}