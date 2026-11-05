import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  FileSpreadsheet,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { get } from "../api/client";
import { useApp } from "../store/AppContext";
import { Badge, Card, ConfirmDialog, EmptyState, Loading, SectionTitle } from "../components/ui";

type Preview = {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  columns: string[];
  rows: Record<string, any>[];
};

export default function DataExplorer() {
  const navigate = useNavigate();
  const { datasets, selected, selectDataset, refreshDatasets, refreshActivity, loadDemo, toast, removeDataset } =
    useApp();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!selected) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      page: String(page),
      page_size: "25",
      sort_dir: sortDir,
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (sortBy) params.set("sort_by", sortBy);

    get<Preview>(`/api/datasets/${selected.id}/preview?${params}`)
      .then((res) => {
        if (!cancelled) setPreview(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load preview.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, page, debouncedSearch, sortBy, sortDir]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", file.name.replace(/\.[^.]+$/, ""));
      const res = await fetch("/api/datasets/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? `Upload failed (${res.status}).`);
      }
      const created = await res.json();
      await refreshDatasets();
      await refreshActivity();
      selectDataset(created.id);
      toast("success", `Uploaded ${created.rows.toLocaleString()} rows.`);
    } catch (err: any) {
      toast("error", err?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const downloadCurrent = () => {
    if (!selected) return;
    window.open(`/api/datasets/${selected.id}/download`, "_blank");
  };

  const onSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-midnight-800">Data Explorer</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Upload, inspect and manage public-health datasets.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls,.txt"
            className="hidden"
            onChange={onFileInput}
          />
          <button
            className="hs-btn-ghost"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload CSV / XLSX"}
          </button>
          {datasets.length === 0 && (
            <button className="hs-btn-primary" onClick={() => loadDemo()}>
              <Sparkles className="h-4 w-4" />
              Load demo dataset
            </button>
          )}
        </div>
      </div>

      {datasets.length === 0 && !uploading ? (
        <EmptyState
          icon={<Database className="h-6 w-6" />}
          title="No datasets yet"
          description="Upload a CSV or XLSX file, or load the synthetic demonstration dataset to explore the platform."
        />
      ) : (
        <>
          {/* Dataset list */}
          <Card>
            <SectionTitle
              title="Datasets"
              subtitle={`${datasets.length} loaded`}
              right={
                selected && (
                  <div className="flex gap-2">
                    <button className="hs-btn-ghost" onClick={downloadCurrent}>
                      <Download className="h-4 w-4" />
                      Download CSV
                    </button>
                    <button
                      className="hs-btn-ghost text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setConfirmDelete(selected.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                )
              }
            />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {datasets.map((d) => (
                <button
                  key={d.id}
                  onClick={() => selectDataset(d.id)}
                  className={`text-left rounded-xl border p-4 transition ${
                    selected?.id === d.id
                      ? "border-royal bg-pale shadow-soft"
                      : "border-slate-200 bg-white hover:border-royal/40 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-midnight-800 truncate">
                        {d.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {d.rows.toLocaleString()} rows · {d.columns} columns ·{" "}
                        {(d.size_bytes / 1024).toFixed(1)} KB
                      </div>
                    </div>
                    {d.is_demo && <Badge tone="amber">Synthetic</Badge>}
                  </div>
                  {d.description && (
                    <p className="mt-2 text-xs text-slate-500 line-clamp-2">{d.description}</p>
                  )}
                  <div className="mt-3 text-[11px] text-slate-400">
                    {new Date(d.created_at).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Preview table */}
          {selected && (
            <Card>
              <SectionTitle
                title={`Preview · ${selected.name}`}
                subtitle={
                  preview
                    ? `${preview.total.toLocaleString()} matching records`
                    : "Loading preview…"
                }
                right={
                  <div className="relative w-64">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search rows…"
                      className="hs-input pl-9"
                    />
                  </div>
                }
              />

              {loading ? (
                <Loading label="Loading rows…" />
              ) : error ? (
                <div className="text-sm text-red-700 py-4">{error}</div>
              ) : preview && preview.rows.length > 0 ? (
                <>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="hs-table w-full">
                      <thead>
                        <tr>
                          {preview.columns.map((c) => (
                            <th
                              key={c}
                              onClick={() => onSort(c)}
                              className="cursor-pointer select-none hover:bg-slate-100"
                            >
                              <span className="inline-flex items-center gap-1">
                                {c}
                                {sortBy === c &&
                                  (sortDir === "asc" ? (
                                    <ArrowUp className="h-3 w-3 text-royal" />
                                  ) : (
                                    <ArrowDown className="h-3 w-3 text-royal" />
                                  ))}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-pale/40">
                            {preview.columns.map((c) => (
                              <td key={c}>
                                {row[c] === null || row[c] === undefined
                                  ? "—"
                                  : String(row[c])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
                    <div>
                      Page {preview.page} of {preview.pages} · {preview.total.toLocaleString()} rows
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="hs-btn-ghost"
                        disabled={preview.page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        className="hs-btn-ghost"
                        disabled={preview.page >= preview.pages}
                        onClick={() => setPage((p) => Math.min(preview.pages, p + 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-10 text-center text-sm text-slate-500">
                  No rows match the current search.
                </div>
              )}
            </Card>
          )}

          {/* Column summary */}
          {selected && (
            <Card>
              <SectionTitle
                title="Column profile"
                subtitle={`${selected.numeric_columns.length} numeric · ${selected.categorical_columns.length} categorical · ${selected.datetime_columns.length} date`}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="hs-label mb-2">Numeric</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.numeric_columns.map((c) => (
                      <Badge key={c} tone="royal">
                        {c}
                      </Badge>
                    ))}
                    {selected.numeric_columns.length === 0 && (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="hs-label mb-2">Categorical</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.categorical_columns.map((c) => (
                      <Badge key={c} tone="teal">
                        {c}
                      </Badge>
                    ))}
                    {selected.categorical_columns.length === 0 && (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="hs-label mb-2">Date / time</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.datetime_columns.map((c) => (
                      <Badge key={c} tone="amber">
                        {c}
                      </Badge>
                    ))}
                    {selected.datetime_columns.length === 0 && (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete dataset?"
        message="This will permanently remove the dataset file and its metadata. This action cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) {
            await removeDataset(confirmDelete);
            setConfirmDelete(null);
          }
        }}
      />
    </div>
  );
}