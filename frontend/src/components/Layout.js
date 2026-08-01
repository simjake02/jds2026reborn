import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import {
  LayoutDashboard, Users, Car, UserCog, ClipboardList, Database,
  LogOut, Menu, X, TrendingUp, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ROLE_LABEL = { owner: "Pemilik", admin: "Admin Operasional", operator: "Operator" };

const nav = [
  { to: "/dashboard", label: "Ringkasan Eksekutif", icon: LayoutDashboard, roles: ["owner", "admin", "operator"] },
  { to: "/analisis-klien", label: "Analisis Klien", icon: Users, roles: ["owner", "admin", "operator"] },
  { to: "/analisis-unit", label: "Analisis Unit", icon: Car, roles: ["owner", "admin", "operator"] },
  { to: "/analisis-driver", label: "Performa Driver", icon: TrendingUp, roles: ["owner", "admin", "operator"] },
  { to: "/transaksi", label: "Transaksi Order", icon: ClipboardList, roles: ["owner", "admin", "operator"] },
  { to: "/master", label: "Data Master", icon: Database, roles: ["owner", "admin", "operator"] },
  { to: "/pengguna", label: "Manajemen Pengguna", icon: UserCog, roles: ["owner", "admin", "operator"] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const items = nav.filter((n) => n.roles.includes(user?.role));

  return (
    <div className="flex min-h-screen bg-slate-50">
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-slate-900 text-slate-300 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Car className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-tight">Jawa Dwipa</p>
            <p className="text-[10px] uppercase tracking-widest text-emerald-400">Operasional</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {items.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              data-testid={`nav-${n.to.replace("/", "")}`}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-emerald-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-8">
          <button className="lg:hidden" onClick={() => setOpen(!open)} data-testid="sidebar-toggle">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <div className="hidden lg:block">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Dashboard Internal</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              {ROLE_LABEL[user?.role] || user?.role}
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            {user?.picture && <img src={user.picture} alt="" className="h-9 w-9 rounded-full border border-slate-200" />}
            <Button variant="ghost" size="icon" onClick={logout} data-testid="logout-btn" title="Keluar">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
