import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Beaker,
  Bell,
  ChevronDown,
  Database,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Menu,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { useApp } from "../store/AppContext";
import { Toasts } from "./ui";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/data", label: "Data Explorer", icon: Database },
  { to: "/quality", label: "Data Quality Lab", icon: ShieldAlert },
  { to: "/eda", label: "Exploratory Analysis", icon: BarChart3 },
  { to: "/risk", label: "Risk Assessment", icon: Activity },
  { to: "/models", label: "Model Laboratory", icon: FlaskConical },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [datasetOpen, setDatasetOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const location = useLocation();
  const { datasets, selected, selectDataset, activities } = useApp();

  return (
    <div className="min-h-screen flex bg-pale">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 shrink-0 bg-midnight-800 text-white flex flex-col transition-transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-white/10">
          <div className="h-8 w-8 rounded-lg bg-royal flex items-center justify-center shadow-soft">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">HealthScope</div>
            <div className="text-[10px] text-white/50 -mt-0.5">Public Health Intelligence</div>
          </div>
          <button
            className="ml-auto lg:hidden text-white/60 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-royal text-white shadow-soft"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="rounded-lg bg-white/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">
              Disclaimer
            </div>
            <p className="text-[11px] leading-snug text-white/60">
              Population-level research and educational decision support only. Not for individual
              diagnosis or treatment.
            </p>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-midnight-900/40 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center gap-3 sticky top-0 z-20">
          <button
            className="lg:hidden p-2 -ml-2 text-midnight-800"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search datasets, indicators, pages…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm outline-none focus:border-royal focus:bg-white focus:ring-2 focus:ring-royal/15"
            />
          </div>

          <div className="hidden md:flex items-center gap-2">
            {/* Dataset selector */}
            <div className="relative">
              <button
                onClick={() => setDatasetOpen((v) => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-midnight-800 hover:bg-slate-50"
              >
                <Database className="h-4 w-4 text-royal" />
                <span className="max-w-[180px] truncate">
                  {selected?.name ?? "No dataset"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {datasetOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setDatasetOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-card z-20 overflow-hidden">
                    <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-100">
                      Active dataset
                    </div>
                    {datasets.length === 0 && (
                      <div className="p-4 text-sm text-slate-500">
                        No datasets yet. Load the demo from the Overview page.
                      </div>
                    )}
                    {datasets.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => {
                          selectDataset(d.id);
                          setDatasetOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 ${
                          selected?.id === d.id ? "bg-pale" : ""
                        }`}
                      >
                        <div className="text-sm font-medium text-midnight-800 truncate">
                          {d.name}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {d.rows.toLocaleString()} rows · {d.columns} cols
                          {d.is_demo && " · synthetic"}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              >
                <Bell className="h-4 w-4" />
                {activities.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-royal text-[9px] text-white flex items-center justify-center font-bold">
                    {Math.min(activities.length, 9)}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setNotifOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-96 bg-white border border-slate-200 rounded-xl shadow-card z-20 max-h-[420px] overflow-y-auto">
                    <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-midnight-800">
                      Recent activity
                    </div>
                    {activities.length === 0 ? (
                      <div className="p-6 text-sm text-slate-500 text-center">
                        No activity yet.
                      </div>
                    ) : (
                      activities.map((a) => (
                        <div
                          key={a.id}
                          className="px-4 py-3 border-b border-slate-100 last:border-0"
                        >
                          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                            {a.kind}
                          </div>
                          <div className="text-sm text-midnight-800 mt-0.5">{a.message}</div>
                          {a.created_at && (
                            <div className="text-[11px] text-slate-400 mt-1">
                              {new Date(a.created_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Profile */}
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-royal to-teal flex items-center justify-center text-white text-xs font-bold">
              HS
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>

        <footer className="px-6 py-4 text-center text-[11px] text-slate-500 border-t border-slate-200 bg-white">
          HealthScope · {new Date().getFullYear()} · Research & educational decision support — not a
          medical device.
        </footer>
      </div>

      <Toasts />
    </div>
  );
}