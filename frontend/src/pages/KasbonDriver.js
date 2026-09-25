import { useEffect, useState, useCallback } from "react";
import { api, fmtRp, fmtNum, fmtDate } from "@/lib/api";
import { PageHeader, SectionCard } from "@/components/Shared";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function KasbonDriver() {
  const { user } = useAuth();
  const canDelete = ["owner", "admin"].includes(user?.role);
  const [summary, setSummary] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [detail, setDetail] = useState(null); // {driver_id, driver_nama,...}
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ driver_id: "", tanggal: "", jumlah: "" });

  const loadSummary = useCallback(async () => {
    const res = await api.get("/kasbon/summary");
    setSummary(res.data.drivers || []);
  }, []);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { api.get("/drivers").then((r) => setDrivers(r.data)); }, []);

  const openDetail = async (driver_id) => {
    const res = await api.get(`/kasbon/driver/${driver_id}`);
    setDetail(res.data);
  };

  const openAdd = (driver_id) => { setAddForm({ driver_id: driver_id || "", tanggal: new Date().toISOString().slice(0, 10), jumlah: "" }); setAddOpen(true); };

  const saveKasbon = async () => {
    if (!addForm.driver_id) { toast.error("Pilih driver"); return; }
    if (!addForm.tanggal) { toast.error("Isi tanggal pinjam"); return; }
    if (!Number(addForm.jumlah)) { toast.error("Isi jumlah kasbon"); return; }
    try {
      await api.post("/kasbon", { driver_id: addForm.driver_id, tanggal: addForm.tanggal, jumlah: Number(addForm.jumlah) });
      toast.success("Kasbon ditambahkan");
      setAddOpen(false);
      await loadSummary();
      if (detail && detail.driver_id === addForm.driver_id) await openDetail(addForm.driver_id);
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal menyimpan"); }
  };

  const delKasbon = async (id) => {
    try {
      await api.delete(`/kasbon/${id}`);
      toast.success("Kasbon dihapus");
      await loadSummary();
      if (detail) await openDetail(detail.driver_id);
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal menghapus"); }
  };

  return (
    <div>
      <PageHeader title="Kasbon Driver" subtitle="Pinjaman driver ke perusahaan (dipotong saat gajian)">
        <Button onClick={() => openAdd("")} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-kasbon-btn">
          <Plus className="mr-2 h-4 w-4" /> Tambah Kasbon
        </Button>
      </PageHeader>

      <SectionCard title="Daftar Kasbon">
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                <TableHead>#</TableHead><TableHead>Driver</TableHead>
                <TableHead className="text-right">Jumlah Kasbon</TableHead>
                <TableHead className="text-right">Total Kasbon (Sisa)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((d, i) => (
                <TableRow key={d.driver_id} data-testid={`kasbon-row-${i}`}>
                  <TableCell className="text-slate-400">{i + 1}</TableCell>
                  <TableCell className="font-medium">{d.driver_nama}</TableCell>
                  <TableCell className="text-right">
                    <button type="button" onClick={() => openDetail(d.driver_id)}
                      className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 hover:underline" data-testid={`kasbon-jumlah-${i}`} title="Lihat detail kasbon">
                      {fmtNum(d.jumlah)} <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${d.sisa > 0 ? "text-amber-600" : "text-emerald-600"}`}>{fmtRp(d.sisa)}</TableCell>
                </TableRow>
              ))}
              {summary.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-slate-400">Belum ada kasbon</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl" data-testid="kasbon-detail-dialog">
          <DialogHeader>
            <DialogTitle>Detail Kasbon &mdash; {detail?.driver_nama}</DialogTitle>
            <DialogDescription>Riwayat pinjaman & potongan kasbon driver.</DialogDescription>
          </DialogHeader>
          <div className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-900 p-3 text-white">
            <div><p className="text-[10px] uppercase text-slate-400">Total Pinjam</p><p className="font-bold">{fmtRp(detail?.total_pinjam)}</p></div>
            <div><p className="text-[10px] uppercase text-slate-400">Total Terpotong</p><p className="font-bold">{fmtRp(detail?.total_potong)}</p></div>
            <div><p className="text-[10px] uppercase text-slate-400">Sisa Kasbon</p><p className="font-bold text-amber-400">{fmtRp(detail?.sisa)}</p></div>
          </div>
          <div className="mb-2 flex justify-end">
            <Button size="sm" onClick={() => openAdd(detail.driver_id)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-kasbon-detail-btn">
              <Plus className="mr-1 h-4 w-4" /> Tambah Kasbon
            </Button>
          </div>
          <div className="max-h-[46vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow><TableHead>Tanggal Pinjam</TableHead><TableHead className="text-right">Jumlah Kasbon</TableHead>{canDelete && <TableHead className="text-right">Aksi</TableHead>}</TableRow>
              </TableHeader>
              <TableBody>
                {(detail?.pinjam || []).map((k, i) => (
                  <TableRow key={k.id} data-testid={`pinjam-row-${i}`}>
                    <TableCell>{fmtDate(k.tanggal)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtRp(k.jumlah)}</TableCell>
                    {canDelete && <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => delKasbon(k.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button></TableCell>}
                  </TableRow>
                ))}
                {(detail?.pinjam || []).length === 0 && <TableRow><TableCell colSpan={canDelete ? 3 : 2} className="py-6 text-center text-slate-400">Belum ada pinjaman</TableCell></TableRow>}
              </TableBody>
            </Table>
            {(detail?.potong || []).length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Potongan (dari Slip Gaji)</p>
                <Table>
                  <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Keterangan</TableHead><TableHead className="text-right">Jumlah</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(detail?.potong || []).map((k, i) => (
                      <TableRow key={k.id} data-testid={`potong-row-${i}`}>
                        <TableCell>{fmtDate(k.tanggal)}</TableCell>
                        <TableCell className="text-slate-500">{k.ket || "Potongan gaji"}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">- {fmtRp(k.jumlah)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent data-testid="add-kasbon-dialog">
          <DialogHeader><DialogTitle>Tambah Kasbon</DialogTitle><DialogDescription>Catat pinjaman baru driver ke perusahaan.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div><Label>Driver</Label>
              <Select value={addForm.driver_id} onValueChange={(v) => setAddForm((f) => ({ ...f, driver_id: v }))}>
                <SelectTrigger data-testid="kasbon-driver-select"><SelectValue placeholder="Pilih driver" /></SelectTrigger>
                <SelectContent className="max-h-64">{drivers.map((d) => <SelectItem key={d.id} value={d.driver_id}>{d.driver_id} · {d.nama}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tanggal Pinjam</Label><Input type="date" value={addForm.tanggal} onChange={(e) => setAddForm((f) => ({ ...f, tanggal: e.target.value }))} data-testid="kasbon-tanggal" /></div>
            <div><Label>Jumlah Kasbon</Label><CurrencyInput value={addForm.jumlah} onChange={(v) => setAddForm((f) => ({ ...f, jumlah: v }))} data-testid="kasbon-jumlah" /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setAddOpen(false)}>Batal</Button><Button onClick={saveKasbon} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-kasbon-btn">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
