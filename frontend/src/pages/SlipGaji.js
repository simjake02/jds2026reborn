import { useEffect, useState, useCallback } from "react";
import { api, fmtRp, fmtNum, fmtDate, BULAN, downloadPost } from "@/lib/api";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { PageHeader, SectionCard, LabeledField, FilterBar } from "@/components/Shared";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

const now = new Date();
const YEARS = [2024, 2025, 2026, 2027];

export default function SlipGaji() {
  const [bulan, setBulan] = usePersistedState("slip.bulan", String(now.getMonth() + 1));
  const [tahun, setTahun] = usePersistedState("slip.tahun", String(now.getFullYear()));
  const [periode, setPeriode] = usePersistedState("slip.periode", "1");
  const [rows, setRows] = useState([]);
  const [slip, setSlip] = useState(null); // driver object
  const [potongan, setPotongan] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get("/payroll", { params: { bulan, tahun, periode } });
    setRows(res.data.drivers || []);
  }, [bulan, tahun, periode]);
  useEffect(() => { load(); }, [load]);

  const openSlip = (d) => { setSlip(d); setPotongan(""); };
  const bersih = slip ? Number(slip.total_gaji || 0) - Number(potongan || 0) : 0;

  const prosesSlip = async () => {
    if (Number(potongan || 0) > Number(slip.total_gaji || 0)) { toast.error("Potongan melebihi gaji kotor"); return; }
    setBusy(true);
    try {
      const safe = (slip.driver_nama || "driver").replace(/[^a-zA-Z0-9]+/g, "_");
      await downloadPost("/payroll/slip",
        { driver_id: slip.driver_id, tahun: Number(tahun), bulan: Number(bulan), periode: Number(periode), potongan_kasbon: Number(potongan || 0) },
        `slip_gaji_${safe}.pdf`);
      toast.success("Slip gaji diunduh" + (Number(potongan || 0) > 0 ? " & kasbon dipotong" : ""));
      setSlip(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Gagal membuat slip");
    } finally { setBusy(false); }
  };

  const periodeLabel = periode === "1" ? "Tanggal 1 – 15" : "Tanggal 16 – Akhir Bulan";

  return (
    <div>
      <PageHeader title="Slip Gaji Driver" subtitle="Penggajian per periode (tgl 15 & 30) — potong kasbon & unduh slip PDF" />

      <FilterBar>
        <LabeledField label="Bulan">
          <Select value={bulan} onValueChange={setBulan}>
            <SelectTrigger className="w-full sm:w-40" data-testid="slip-bulan"><SelectValue /></SelectTrigger>
            <SelectContent>{BULAN.map((b, i) => <SelectItem key={i} value={String(i + 1)}>{b}</SelectItem>)}</SelectContent>
          </Select>
        </LabeledField>
        <LabeledField label="Tahun">
          <Select value={tahun} onValueChange={setTahun}>
            <SelectTrigger className="w-full sm:w-28" data-testid="slip-tahun"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </LabeledField>
        <LabeledField label="Periode Gajian">
          <Select value={periode} onValueChange={setPeriode}>
            <SelectTrigger className="w-full sm:w-56" data-testid="slip-periode"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Tgl 15 (hari 1 – 15)</SelectItem>
              <SelectItem value="2">Tgl 30 (hari 16 – akhir)</SelectItem>
            </SelectContent>
          </Select>
        </LabeledField>
      </FilterBar>

      <SectionCard title={`Penggajian ${BULAN[Number(bulan) - 1]} ${tahun} · ${periodeLabel}`}>
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                <TableHead>#</TableHead><TableHead>Driver</TableHead>
                <TableHead className="text-right">Jumlah Hari</TableHead>
                <TableHead className="text-right">Total Gaji</TableHead>
                <TableHead className="text-right">Sisa Kasbon</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d, i) => (
                <TableRow key={d.driver_id} data-testid={`slip-row-${i}`}>
                  <TableCell className="text-slate-400">{i + 1}</TableCell>
                  <TableCell className="font-medium">{d.driver_nama}</TableCell>
                  <TableCell className="text-right">{fmtNum(d.items?.length || 0)}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600">{fmtRp(d.total_gaji)}</TableCell>
                  <TableCell className={`text-right ${d.sisa_kasbon > 0 ? "text-amber-600" : "text-slate-400"}`}>{fmtRp(d.sisa_kasbon)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openSlip(d)} data-testid={`slip-btn-${i}`}>
                      <FileText className="mr-1 h-4 w-4" /> Buat Slip
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-8 text-center text-slate-400">Tidak ada penggajian pada periode ini</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <Dialog open={!!slip} onOpenChange={(o) => !o && setSlip(null)}>
        <DialogContent className="max-w-2xl" data-testid="slip-dialog">
          <DialogHeader>
            <DialogTitle>Slip Gaji &mdash; {slip?.driver_nama}</DialogTitle>
            <DialogDescription>{BULAN[Number(bulan) - 1]} {tahun} · {periodeLabel}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[42vh] overflow-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow><TableHead>Tanggal</TableHead><TableHead>ID Order</TableHead><TableHead>Rute</TableHead><TableHead className="text-right">Gaji</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(slip?.items || []).map((it, i) => (
                  <TableRow key={i} data-testid={`slip-item-${i}`}>
                    <TableCell>{fmtDate(it.tanggal)}</TableCell>
                    <TableCell className="font-medium">{it.id_order}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={it.rute}>{it.rute || "-"}</TableCell>
                    <TableCell className="text-right">{fmtRp(it.gaji)}</TableCell>
                  </TableRow>
                ))}
                {(slip?.items || []).length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-slate-400">Tidak ada penugasan</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Total Gaji Kotor</span><span className="font-semibold">{fmtRp(slip?.total_gaji)}</span></div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="text-sm text-slate-500">Potongan Kasbon</span>
                <p className="text-xs text-slate-400">Sisa kasbon: {fmtRp(slip?.sisa_kasbon)}</p>
              </div>
              <div className="w-48"><CurrencyInput value={potongan} onChange={setPotongan} data-testid="slip-potongan" /></div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-base"><span className="font-semibold">Gaji Bersih</span><span className="font-bold text-emerald-600">{fmtRp(bersih)}</span></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSlip(null)}>Batal</Button>
            <Button onClick={prosesSlip} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700" data-testid="proses-slip-btn">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Proses & Unduh PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
