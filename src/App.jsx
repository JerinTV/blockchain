// src/App.jsx
import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import RoleSelect from "./pages/RoleSelect";
import Login from "./pages/Login";
import UserDashboard from "./pages/Dashboards/UserDashboard";
import RetailerDashboard from "./pages/Dashboards/RetailerDashboard";
import ManufacturerDashboard from "./pages/Dashboards/ManufacturerDashboard";
import AdminDashboard from "./pages/Dashboards/AdminDashboard";
import BlockchainData from "./pages/BlockchainData";


export default function App() {
  const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

  useEffect(() => {
    fetch(`${API_BASE}/health`).catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/roles" element={<RoleSelect />} />
        <Route path="/login/:role" element={<Login />} />

        <Route path="/dashboard/user" element={<UserDashboard />} />
        <Route path="/dashboard/retailer" element={<RetailerDashboard />} />
        <Route path="/dashboard/manufacturer" element={<ManufacturerDashboard />} />
        <Route path="/dashboard/admin" element={<AdminDashboard />} />
        <Route path="/blockchain-data" element={<BlockchainData />} />

        {/* fallback */}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
