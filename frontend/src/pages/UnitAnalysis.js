import { useEffect, useState, useCallback } from "react";
import { api, fmtRp, fmtNum, monthLabel, downloadFile } from "@/lib/api";
import { PageHeader, SectionCard } from "@/components/Shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";

const BAR_COLORS = ["hsl(152,69%,31%)","hsl(217,91%,60%)","hsl(35,92%,53%)","hsl(280,65%,60%)","hsl(340,75%,55%)","hsl(190,80%,45%)"];

export default function UnitAnalysis() {
  const [data, setData] = useState({ summary: [], freq: [], units: [] });
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = useCallback(async () => {
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    const res = await api.get("/analytics/units", { params });
    setData(res.data);
  }, [start, end]);

  useEffect(() => { load(); }, [load]);

  const freqData = data.freq.map((f) => ({ ...f, label: monthLabel(f.bulan) }));
  const topUnits = data.units.slice(0, 6);

  return (
    <div>
      <PageHeader title="Analisis Operasional Unit" subtitle="Frekuensi & performa unit kendaraan">
        <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
        <Button variant="outline" onClick={() => downloadFile(`/export/units-analysis?start=${start}&end=${end}`, "analisis_unit.xlsx").then(() => toast.success("Excel diunduh"))} data-testid="export-units-btn">
          <Download className="mr-2 h-4 w-4" /> Excel
        </Button>
      </PageHeader>

      <SectionCard title="Frekuensi Pemakaian Unit per Bulan" className="mb-6">
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={freqData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {topUnits.map((u, i) => <Bar key={u} dataKey={u} stackId="a" fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <SectionCard title="Ringkasan Unit">
        <div className="max-h-[460px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Jumlah Order</TableHead>
                <TableHead className="text-right">Total Omset</TableHead>
                <TableHead className="text-right">Rata-rata Omset</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.summary.map((u, i) => (
                <TableRow key={u.unit} data-testid={`unit-row-${i}`}>
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
