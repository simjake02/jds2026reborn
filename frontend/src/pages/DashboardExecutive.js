import { useEffect, useState, useCallback } from "react";
import { api, fmtRp, fmtNum, fmtDate, monthLabel, downloadFile } from "@/lib/api";
import { PageHeader, KpiCard, SectionCard } from "@/components/Shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, ClipboardList, TrendingUp, Car, Download, Search } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { toast } from "sonner";

const tipeBadge = { A: "bg-blue-100 text-blue-700", D: "bg-amber-100 text-amber-700", P: "bg-purple-100 text-purple-700" };
const tipeLabel = { A: "Agen", D: "Kedinasan", P: "Perorangan" };

export default function DashboardExecutive() {
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    const [a, o] = await Promise.all([
      api.get("/analytics/executive", { params }),
      api.get("/orders", { params: { ...params, search } }),
    ]);
    setData(a.data);
    setOrders(o.data);
  }, [start, end, search]);

  useEffect(() => { load(); }, [load]);

  const chartData = (data?.trend || []).map((t) => ({ ...t, label: monthLabel(t.bulan) }));

  return (
    <div>
      <PageHeader title="Ringkasan Eksekutif" subtitle="Kinerja operasional PT. Jawa Dwipa Solutions">
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" data-testid="filter-start" />
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" data-testid="filter-end" />
        <Button variant="outline" onClick={() => downloadFile(`/export/orders?search=${search}&start=${start}&end=${end}`, "transaksi.xlsx").then(() => toast.success("Excel diunduh"))} data-testid="export-orders-btn">
          <Download className="mr-2 h-4 w-4" /> Excel
        </Button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Omset" value={fmtRp(data?.total_omset)} icon={Wallet} accent="emerald" testid="kpi-omset" />
        <KpiCard label="Total Order" value={fmtNum(data?.total_order)} icon={ClipboardList} accent="blue" testid="kpi-order" />
        <KpiCard label="Total Margin" value={fmtRp(data?.total_margin)} icon={TrendingUp} accent="amber" testid="kpi-margin" />
        <KpiCard label="Unit Digunakan" value={fmtNum(data?.total_unit)} icon={Car} accent="purple" testid="kpi-unit" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <SectionCard title="Tren Omset & Margin per Bulan" className="lg:col-span-8">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v / 1e6}jt`} />
              <Tooltip formatter={(v) => fmtRp(v)} />
              <Legend />
              <Line type="monotone" dataKey="omset" name="Omset" stroke="hsl(152,69%,31%)" strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="margin" name="Margin" stroke="hsl(35,92%,53%)" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>
        <SectionCard title="Jumlah Order per Bulan" className="lg:col-span-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="order" name="Order" fill="hsl(217,91%,60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </SectionCard>
      </div>

      <SectionCard title="Detail Transaksi" action={
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Cari penyewa / rute..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-56 pl-8" data-testid="search-orders" />
        </div>
      }>
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                <TableHead>ID</TableHead><TableHead>Penyewa</TableHead><TableHead>Tipe</TableHead>
                <TableHead>Unit</TableHead><TableHead>Tgl Mulai</TableHead><TableHead>Rute</TableHead>
                <TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id} data-testid={`order-row-${o.id_order}`}>
                  <TableCell className="font-medium">{o.id_order}</TableCell>
                  <TableCell>{o.penyewa_nama}</TableCell>
                  <TableCell><Badge variant="secondary" className={tipeBadge[o.penyewa_tipe]}>{tipeLabel[o.penyewa_tipe]}</Badge></TableCell>
                  <TableCell>{o.unit_nama}</TableCell>
                  <TableCell>{fmtDate(o.tanggal_mulai)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{o.rute}</TableCell>
                  <TableCell className="text-right font-medium">{fmtRp(o.harga)}</TableCell>
                  <TableCell className={`text-right font-semibold ${o.margin < 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtRp(o.margin)}</TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-slate-400 py-8">Tidak ada data</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
