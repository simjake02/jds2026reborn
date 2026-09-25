import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AuthCallback from "@/components/AuthCallback";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import DashboardExecutive from "@/pages/DashboardExecutive";
import ClientAnalysis from "@/pages/ClientAnalysis";
import UnitAnalysis from "@/pages/UnitAnalysis";
import DriverAnalysis from "@/pages/DriverAnalysis";
import Orders from "@/pages/Orders";
import MasterData from "@/pages/MasterData";
import KasbonDriver from "@/pages/KasbonDriver";
import SlipGaji from "@/pages/SlipGaji";
import UsersPage from "@/pages/Users";
import { Loader2 } from "lucide-react";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<Protected><DashboardExecutive /></Protected>} />
      <Route path="/analisis-klien" element={<Protected><ClientAnalysis /></Protected>} />
      <Route path="/analisis-unit" element={<Protected><UnitAnalysis /></Protected>} />
      <Route path="/analisis-driver" element={<Protected><DriverAnalysis /></Protected>} />
      <Route path="/transaksi" element={<Protected><Orders /></Protected>} />
      <Route path="/master" element={<Protected><MasterData /></Protected>} />
      <Route path="/kasbon" element={<Protected><KasbonDriver /></Protected>} />
      <Route path="/slip-gaji" element={<Protected><SlipGaji /></Protected>} />
      <Route path="/pengguna" element={<Protected><UsersPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}
