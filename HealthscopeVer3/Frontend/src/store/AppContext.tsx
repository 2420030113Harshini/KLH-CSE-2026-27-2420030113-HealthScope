import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { get, post } from "../api/client";

export type Dataset = {
  id: string;
  name: string;
  source: string;
  description: string;
  original_filename: string;
  rows: number;
  columns: number;
  size_bytes: number;
  is_demo: boolean;
  parent_id: string | null;
  created_at: string;
  cleaning_log: any[];
  column_names: string[];
  numeric_columns: string[];
  categorical_columns: string[];
  datetime_columns: string[];
};

export type Activity = {
  id: number;
  kind: string;
  message: string;
  dataset_id: string | null;
  created_at: string | null;
};

export type Toast = {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
};

type Ctx = {
  datasets: Dataset[];
  selectedId: string | null;
  selected: Dataset | null;
  activities: Activity[];
  toasts: Toast[];
  loadingDatasets: boolean;
  selectDataset: (id: string | null) => void;
  refreshDatasets: () => Promise<void>;
  refreshActivity: () => Promise<void>;
  loadDemo: () => Promise<Dataset | null>;
  removeDataset: (id: string) => Promise<void>;
  toast: (kind: Toast["kind"], message: string) => void;
  dismissToast: (id: number) => void;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);

  const toast = useCallback((kind: Toast["kind"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const refreshDatasets = useCallback(async () => {
    setLoadingDatasets(true);
    try {
      const data = await get<{ items: Dataset[] }>("/api/datasets");
      setDatasets(data.items);
      setSelectedId((current) => {
        if (current && data.items.some((d) => d.id === current)) return current;
        return data.items[0]?.id ?? null;
      });
    } catch (err: any) {
      toast("error", err?.message ?? "Failed to load datasets.");
    } finally {
      setLoadingDatasets(false);
    }
  }, [toast]);

  const refreshActivity = useCallback(async () => {
    try {
      const data = await get<{ items: Activity[] }>("/api/activity?limit=25");
      setActivities(data.items);
    } catch {
      /* silent — activity is non-critical */
    }
  }, []);

  const loadDemo = useCallback(async () => {
    try {
      const created = await post<Dataset>("/api/datasets/demo", {});
      await refreshDatasets();
      setSelectedId(created.id);
      await refreshActivity();
      toast("success", "Demonstration dataset loaded.");
      return created;
    } catch (err: any) {
      toast("error", err?.message ?? "Could not load demo dataset.");
      return null;
    }
  }, [refreshDatasets, refreshActivity, toast]);

  const removeDataset = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/datasets/${id}`, { method: "DELETE" });
        await refreshDatasets();
        await refreshActivity();
        toast("success", "Dataset deleted.");
      } catch (err: any) {
        toast("error", err?.message ?? "Delete failed.");
      }
    },
    [refreshDatasets, refreshActivity, toast],
  );

  useEffect(() => {
    refreshDatasets();
    refreshActivity();
  }, [refreshDatasets, refreshActivity]);

  const selected = useMemo(
    () => datasets.find((d) => d.id === selectedId) ?? null,
    [datasets, selectedId],
  );

  const value: Ctx = {
    datasets,
    selectedId,
    selected,
    activities,
    toasts,
    loadingDatasets,
    selectDataset: setSelectedId,
    refreshDatasets,
    refreshActivity,
    loadDemo,
    removeDataset,
    toast,
    dismissToast,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}