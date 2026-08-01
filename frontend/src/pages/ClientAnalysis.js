import { useEffect, useState, useCallback } from "react";
import { api, fmtRp, fmtNum, downloadFile } from "@/lib/api";
import { PageHeader, SectionCard, LabeledField } from "@/components/Shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { toast } from "sonner";

const COLORS = { A: "hsl(217,91%,60%)", D: "hsl(35,92%,53%)", P: "hsl(280,65%,60%)" };

function Donut({ title, data, dataKey, fmt }) {
  return (
    <SectionCard title={title}>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey={dataKey} nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
            {data.map((d) => <Cell key={d.tipe} fill={COLORS[d.tipe]} />)}
          </Pie>
          <Tooltip formatter={(v) => fmt(v)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </SectionCard>
  );
}

export default function ClientAnalysis() {
  const [data, setData] = useState({ by_tipe: [], top_clients: [] });
  const [tipe, setTipe] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = useCallback(async () => {
    const params = {};
    if (tipe !== "all") params.tipe = tipe;
    if (start) params.start = start;
    if (end) params.end = end;
    const res = await api.get("/analytics/clients", { params });
    setData(res.data);
  }, [tipe, start, end]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader title="Analisis Klien" subtitle="Kontribusi berdasarkan tipe klien (Agen, Kedinasan, Perorangan)">
        <LabeledField label="Tipe Klien">
          <Select value={tipe} onValueChange={setTipe}>
            <SelectTrigger className="w-40" data-testid="filter-tipe"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tipe</SelectItem>
              <SelectItem value="A">Agen</SelectItem>
              <SelectItem value="D">Kedinasan</SelectItem>
              <SelectItem value="P">Perorangan</SelectItem>
            </SelectContent>
          </Select>
        </LabeledField>
        <LabeledField label="Tanggal Mulai">
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
        </LabeledField>
        <LabeledField label="Tanggal Selesai">
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
        </LabeledField>
        <Button variant="outline" onClick={() => downloadFile(`/export/clients-analysis?tipe=${tipe === "all" ? "" : tipe}&start=${start}&end=${end}`, "analisis_klien.xlsx").then(() => toast.success("Excel diunduh"))} data-testid="export-clients-btn">
          <Download className="mr-2 h-4 w-4" /> Excel
        </Button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <Donut title="Proporsi Order" data={data.by_tipe} dataKey="order" fmt={fmtNum} />
        <Donut title="Proporsi Omset" data={data.by_tipe} dataKey="omset" fmt={fmtRp} />
        <Donut title="Proporsi Margin" data={data.by_tipe} dataKey="margin" fmt={fmtRp} />
      </div>

      <SectionCard title="Penyewa Kontribusi Tertinggi">
        <div className="max-h-[460px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                <TableHead>#</TableHead><TableHead>Penyewa</TableHead>
                <TableHead className="text-right">Order</TableHead>
                <TableHead className="text-right">Omset</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.top_clients.map((c, i) => (
                <TableRow key={c.nama} data-testid={`client-row-${i}`}>
                  <TableCell className="text-slate-400">{i + 1}</TableCell>
                  <TableCell className="font-medium">{c.nama}</TableCell>
                  <TableCell className="text-right">{fmtNum(c.order)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtRp(c.omset)}</TableCell>
                  <TableCell className={`text-right font-semibold ${c.margin < 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtRp(c.margin)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
