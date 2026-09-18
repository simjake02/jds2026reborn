import { useEffect, useState, useCallback, useMemo } from "react";
import { api, fmtRp, fmtNum, monthLabel, downloadFile } from "@/lib/api";
import { PageHeader, SectionCard, LabeledField, FilterBar } from "@/components/Shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";

const PALETTE = ["hsl(152,69%,40%)","hsl(217,91%,60%)","hsl(35,92%,53%)","hsl(280,65%,60%)","hsl(340,75%,55%)","hsl(190,80%,45%)","hsl(48,95%,53%)","hsl(120,45%,45%)","hsl(258,70%,62%)","hsl(12,80%,58%)","hsl(174,62%,40%)","hsl(300,60%,55%)"];
const colorFor = (key, i) => (key === "Lainnya" ? "#94a3b8" : PALETTE[i % PALETTE.length]);

const SORT_LABEL = { omset: "Omset Tertinggi", order: "Order Terbanyak", margin: "Margin Tertinggi" };

export default function UnitAnalysis() {
  const [data, setData] = useState({ summary: [], freq: [], units: [], freq_keys: [] });
  const [allUnits, setAllUnits] = useState([]);
  const [unit, setUnit] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [sortBy, setSortBy] = useState("omset");

  useEffect(() => {
    api.get("/units").then((res) => setAllUnits(res.data.map((u) => u.nama)));
  }, []);

  const load = useCallback(async () => {
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    if (unit !== "all") params.unit = unit;
    const res = await api.get("/analytics/units", { params });
    setData(res.data);
  }, [start, end, unit]);

  useEffect(() => { load(); }, [load]);

  const freqData = data.freq.map((f) => ({ ...f, label: monthLabel(f.bulan) }));
  const freqKeys = data.freq_keys || [];
  const sortedSummary = useMemo(() => [...data.summary].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0)), [data.summary, sortBy]);

  return (
    <div>
      <PageHeader title="Analisis Operasional Unit" subtitle="Frekuensi & performa unit kendaraan" />

      <FilterBar>
        <LabeledField label="Pilih Unit">
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="w-full sm:w-52" data-testid="filter-unit"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">Semua Unit</SelectItem>
              {allUnits.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </LabeledField>
        <div className="flex gap-3">
          <LabeledField label="Tanggal Mulai">
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full sm:w-40" data-testid="filter-start" />
          </LabeledField>
          <LabeledField label="Tanggal Selesai">
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full sm:w-40" data-testid="filter-end" />
          </LabeledField>
        </div>
        <Button variant="outline" className="sm:ml-auto" onClick={() => downloadFile(`/export/units-analysis?start=${start}&end=${end}&unit=${unit === "all" ? "" : encodeURIComponent(unit)}`, "analisis_unit.xlsx").then(() => toast.success("Excel diunduh"))} data-testid="export-units-btn">
          <Download className="mr-2 h-4 w-4" /> Excel
        </Button>
      </FilterBar>

      <SectionCard title="Frekuensi Pemakaian Unit per Bulan (Top 5 + Lainnya)" className="mb-6">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={freqData} margin={{ bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {freqKeys.map((k, i) => <Bar key={k} dataKey={k} stackId="a" fill={colorFor(k, i)} />)}
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Ringkasan Unit" action={
        <LabeledField label="Urutkan berdasarkan">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-52" data-testid="unit-sort"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="omset">{SORT_LABEL.omset}</SelectItem>
              <SelectItem value="order">{SORT_LABEL.order}</SelectItem>
              <SelectItem value="margin">{SORT_LABEL.margin}</SelectItem>
            </SelectContent>
          </Select>
        </LabeledField>
      }>
        <div className="max-h-[460px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Jumlah Order</TableHead>
                <TableHead className="text-right">Total Omset</TableHead>
                <TableHead className="text-right">Rata-rata Omset</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSummary.map((u, i) => (
                <TableRow key={u.unit} data-testid={`unit-row-${i}`}>
                  <TableCell className="text-slate-400">{i + 1}</TableCell>
                  <TableCell className="font-medium">{u.unit}</TableCell>
                  <TableCell className="text-right">{fmtNum(u.order)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtRp(u.omset)}</TableCell>
                  <TableCell className="text-right">{fmtRp(Math.round(u.rata_omset))}</TableCell>
                  <TableCell className={`text-right font-semibold ${u.margin < 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtRp(u.margin)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
