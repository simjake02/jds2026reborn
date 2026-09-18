import { Card } from "@/components/ui/card";

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl font-heading">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-end gap-3">{children}</div>}
    </div>
  );
}

export function KpiCard({ label, value, icon: Icon, accent = "emerald", testid }) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <Card className="animate-fade-in-up border-slate-200 p-5 shadow-sm" data-testid={testid}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors[accent]}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight text-slate-900 md:text-3xl font-heading">{value}</p>
    </Card>
  );
}

export function LabeledField({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      {children}
    </div>
  );
}

export function FilterBar({ children, className = "" }) {
  return (
    <div
      className={`mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:flex-wrap sm:items-end ${className}`}
      data-testid="filter-bar"
    >
      {children}
    </div>
  );
}

export function SectionCard({ title, action, children, className = "" }) {
  return (
    <Card className={`border-slate-200 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </Card>
  );
}
