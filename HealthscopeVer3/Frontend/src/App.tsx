import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import DataExplorer from "./pages/DataExplorer";
import QualityLab from "./pages/QualityLab";
import EDALab from "./pages/EDALab";
import RiskAssessment from "./pages/RiskAssessment";
import ModelLab from "./pages/ModelLab";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Overview />} />
        <Route path="/data" element={<DataExplorer />} />
        <Route path="/quality" element={<QualityLab />} />
        <Route path="/eda" element={<EDALab />} />
        <Route path="/risk" element={<RiskAssessment />} />
        <Route path="/models" element={<ModelLab />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}