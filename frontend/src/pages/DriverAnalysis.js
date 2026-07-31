import { useEffect, useState, useCallback } from "react";
import { api, fmtRp, fmtNum, BULAN, downloadFile } from "@/lib/api";
import { PageHeader, SectionCard, KpiCard } from "@/components/Shared";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Users, Wallet, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

const now = new Date();
const YEARS = [2025, 2026];

export default function DriverAnalysis() {
  const [data, setData] = useState({ drivers: [] });
  const [bulan, setBulan] = useState("all");
  const [tahun, setTahun] = useState(String(now.getFullYear()));

  const load = useCallback(async () => {
    const params = {};
    if (bulan !== "all") params.bulan = bulan;
    if (tahun !== "all") params.tahun = tahun;
    const res = await api.get("/analytics/drivers", { params });
    setData(res.data);
  }, [bulan, tahun]);

  useEffect(() => { load(); }, [load]);

  const totalGaji = data.drivers.reduce((s, d) => s + d.total_gaji, 0);
  const totalTugas = data.drivers.reduce((s, d) => s + d.tugas, 0);
  const chart = data.drivers.slice(0, 10).map((d) => ({ nama: d.nama, tugas: d.tugas }));

  return (
    <div>
      <PageHeader title="Analisis Performa Driver" subtitle="Driver paling aktif & total kompensasi per periode">
        <Select value={bulan} onValueChange={setBulan}>
          <SelectTrigger className="w-36" data-testid="filter-bulan"><SelectValue placeholder="Bulan" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Bulan</SelectItem>
            {BULAN.map((b, i) => <SelectItem key={i} value={String(i + 1)}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tahun} onValueChange={setTahun}>
          <SelectTrigger className="w-28" data-testid="filter-tahun"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tahun</SelectItem>
            {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => downloadFile(`/export/drivers-analysis?bulan=${bulan === "all" ? "" : bulan}&tahun=${tahun === "all" ? "" : tahun}`, "analisis_driver.xlsx").then(() => toast.success("Excel diunduh"))} data-testid="export-drivers-btn">
          <Download className="mr-2 h-4 w-4" /> Excel
        </Button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Driver Aktif" value={fmtNum(data.drivers.length)} icon={Users} accent="blue" />
        <KpiCard label="Total Penugasan" value={fmtNum(totalTugas)} icon={Award} accent="emerald" />
        <KpiCard label="Total Gaji Driver" value={fmtRp(totalGaji)} icon={Wallet} accent="amber" />
      </div>

      <SectionCard title="10 Driver Paling Aktif" className="mb-6">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chart} layout="vertical" margin={{ left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="nama" tick={{ fontSize: 11 }} width={90} />
            <Tooltip />
            <Bar dataKey="tugas" name="Penugasan" fill="hsl(152,69%,31%)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Daftar Driver">
        <div className="max-h-[460px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                <TableHead>#</TableHead><TableHead>Driver</TableHead>
                <TableHead className="text-right">Jumlah Tugas</TableHead>
                <TableHead className="text-right">Total Gaji</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.drivers.map((d, i) => (
                <TableRow key={d.nama} data-testid={`driver-row-${i}`}>
                  <TableCell className="text-slate-400">{i + 1}</TableCell>
                  <TableCell className="font-medium">{d.nama}</TableCell>
                  <TableCell className="text-right">{fmtNum(d.tugas)}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600">{fmtRp(d.total_gaji)}</TableCell>
                </TableRow>
              ))}
              {data.drivers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-slate-400 py-8">Tidak ada data pada periode ini</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
