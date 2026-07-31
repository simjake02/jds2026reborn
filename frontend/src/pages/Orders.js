import { useEffect, useState, useCallback, useMemo } from "react";
import { api, fmtRp, fmtDate, downloadFile } from "@/lib/api";
import { PageHeader, SectionCard } from "@/components/Shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Download, Search, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const tipeLabel = { A: "Agen", D: "Kedinasan", P: "Perorangan" };
const tipeBadge = { A: "bg-blue-100 text-blue-700", D: "bg-amber-100 text-amber-700", P: "bg-purple-100 text-purple-700" };
const empty = { penyewa_id: "", penyewa_nama: "", tamu: "", unit_id: "", unit_nama: "", tanggal_mulai: "", tanggal_selesai: "", rute: "", harga: "", biaya_sewa_rekanan: "", biaya_bbm: "", biaya_toll_parkir: "", biaya_lain: "", ket: "", drivers: [] };

const NumInput = ({ value, onChange, ...p }) => (
  <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} {...p} />
);

export default function Orders() {
  const { user } = useAuth();
  const canDelete = ["owner", "admin"].includes(user?.role);
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [units, setUnits] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [newDriverName, setNewDriverName] = useState("");

  const loadMasters = useCallback(async () => {
    const [c, u, d] = await Promise.all([api.get("/clients"), api.get("/units"), api.get("/drivers")]);
    setClients(c.data); setUnits(u.data); setDrivers(d.data);
  }, []);
  const loadOrders = useCallback(async () => {
    const res = await api.get("/orders", { params: { search } });
    setOrders(res.data);
  }, [search]);

  useEffect(() => { loadMasters(); }, [loadMasters]);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const totalGaji = useMemo(() => form.drivers.reduce((s, d) => s + Number(d.gaji || 0), 0), [form.drivers]);
  const totalBiaya = totalGaji + Number(form.biaya_sewa_rekanan || 0) + Number(form.biaya_bbm || 0) + Number(form.biaya_toll_parkir || 0) + Number(form.biaya_lain || 0);
  const margin = Number(form.harga || 0) - totalBiaya;

  const openCreate = () => { setForm(empty); setEditId(null); setStep(1); setOpen(true); };
  const openEdit = async (o) => {
    setForm({ ...empty, ...o, harga: o.harga || "", biaya_sewa_rekanan: o.biaya_sewa_rekanan || "", biaya_bbm: o.biaya_bbm || "", biaya_toll_parkir: o.biaya_toll_parkir || "", biaya_lain: o.biaya_lain || "", drivers: (o.drivers || []).map((d) => ({ ...d })) });
    setEditId(o.id); setStep(1); setOpen(true);
  };

  const addDriverRow = () => setForm((f) => ({ ...f, drivers: [...f.drivers, { driver_id: "", driver_nama: "", gaji: "", segmen: "" }] }));
  const removeDriverRow = (i) => setForm((f) => ({ ...f, drivers: f.drivers.filter((_, idx) => idx !== i) }));
  const setDriver = (i, k, v) => setForm((f) => ({ ...f, drivers: f.drivers.map((d, idx) => idx === i ? { ...d, [k]: v } : d) }));

  const pickClient = (id) => { const c = clients.find((x) => x.id === id); if (c) setForm((f) => ({ ...f, penyewa_id: c.penyewa_id, penyewa_nama: c.nama })); };
  const pickUnit = (id) => { const u = units.find((x) => x.id === id); if (u) setForm((f) => ({ ...f, unit_id: u.unit_id, unit_nama: u.nama })); };
  const pickDriver = (i, id) => { const d = drivers.find((x) => x.id === id); if (d) setDriver(i, "driver_nama", d.nama), setDriver(i, "driver_id", d.id); };

  const registerDriver = async () => {
    if (!newDriverName.trim()) return;
    const res = await api.post("/drivers", { nama: newDriverName.trim(), aktif: true });
    await loadMasters();
    setNewDriverName("");
    toast.success(`Driver "${res.data.nama}" ditambahkan`);
  };

  const save = async () => {
    if (!form.penyewa_nama || !form.unit_nama) { toast.error("Penyewa dan unit wajib diisi"); setStep(1); return; }
    if (totalGaji > Number(form.harga || 0)) { toast.error("Total gaji driver melebihi harga sewa"); return; }
    const payload = {
      ...form,
      harga: Number(form.harga || 0), biaya_sewa_rekanan: Number(form.biaya_sewa_rekanan || 0),
      biaya_bbm: Number(form.biaya_bbm || 0), biaya_toll_parkir: Number(form.biaya_toll_parkir || 0),
      biaya_lain: Number(form.biaya_lain || 0),
      drivers: form.drivers.filter((d) => d.driver_nama).map((d) => ({ ...d, gaji: Number(d.gaji || 0) })),
    };
    try {
      if (editId) await api.put(`/orders/${editId}`, payload);
      else await api.post("/orders", payload);
      toast.success(editId ? "Transaksi diperbarui" : "Transaksi dibuat");
      setOpen(false); loadOrders();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal menyimpan"); }
  };

  const doDelete = async () => { await api.delete(`/orders/${delId}`); setDelId(null); toast.success("Transaksi dihapus"); loadOrders(); };

  const steps = ["Info Dasar", "Biaya Operasional", "Penugasan Driver"];

  return (
    <div>
      <PageHeader title="Transaksi Order" subtitle="Input & kelola order perjalanan">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48 pl-8" data-testid="search-orders" />
        </div>
        <Button variant="outline" onClick={() => downloadFile(`/export/orders?search=${search}`, "transaksi.xlsx").then(() => toast.success("Excel diunduh"))} data-testid="export-btn">
          <Download className="mr-2 h-4 w-4" /> Excel
        </Button>
        <Button onClick={openCreate} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-order-btn">
          <Plus className="mr-2 h-4 w-4" /> Order Baru
        </Button>
      </PageHeader>

      <SectionCard>
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-white">
              <TableRow>
                <TableHead>ID</TableHead><TableHead>Penyewa</TableHead><TableHead>Unit</TableHead>
                <TableHead>Tgl Mulai</TableHead><TableHead>Driver</TableHead>
                <TableHead className="text-right">Harga</TableHead><TableHead className="text-right">Margin</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id} data-testid={`order-row-${o.id_order}`}>
                  <TableCell className="font-medium">{o.id_order}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={tipeBadge[o.penyewa_tipe]}>{tipeLabel[o.penyewa_tipe]?.[0]}</Badge>
                      {o.penyewa_nama}
                    </div>
                  </TableCell>
                  <TableCell>{o.unit_nama}</TableCell>
                  <TableCell>{fmtDate(o.tanggal_mulai)}</TableCell>
                  <TableCell>{(o.drivers || []).map((d) => d.driver_nama).join(", ") || "-"}</TableCell>
                  <TableCell className="text-right font-medium">{fmtRp(o.harga)}</TableCell>
                  <TableCell className={`text-right font-semibold ${o.margin < 0 ? "text-red-600" : "text-emerald-600"}`}>{fmtRp(o.margin)}</TableCell>
                  <TableCell><Badge className={o.status === "lengkap" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>{o.status === "lengkap" ? "Lengkap" : "Draft"}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(o)} data-testid={`edit-${o.id_order}`}><Pencil className="h-4 w-4" /></Button>
                    {canDelete && <Button variant="ghost" size="icon" onClick={() => setDelId(o.id)} data-testid={`delete-${o.id_order}`}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && <TableRow><TableCell colSpan={9} className="py-8 text-center text-slate-400">Belum ada transaksi</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Transaksi" : "Order Baru"}</DialogTitle></DialogHeader>

          <div className="mb-4 flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex flex-1 items-center gap-2">
                <button onClick={() => setStep(i + 1)} className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step === i + 1 ? "bg-emerald-600 text-white" : step > i + 1 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{i + 1}</button>
                <span className={`text-xs ${step === i + 1 ? "font-semibold text-slate-800" : "text-slate-400"}`}>{s}</span>
                {i < 2 && <div className="h-px flex-1 bg-slate-200" />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label>Penyewa</Label>
                <Select value={clients.find((c) => c.penyewa_id === form.penyewa_id)?.id || ""} onValueChange={pickClient}>
                  <SelectTrigger data-testid="select-client"><SelectValue placeholder="Pilih penyewa" /></SelectTrigger>
                  <SelectContent className="max-h-64">{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.penyewa_id} · {c.nama}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Nama Tamu</Label><Input value={form.tamu} onChange={(e) => set("tamu", e.target.value)} data-testid="input-tamu" /></div>
              <div><Label>Unit Kendaraan</Label>
                <Select value={units.find((u) => u.unit_id === form.unit_id)?.id || ""} onValueChange={pickUnit}>
                  <SelectTrigger data-testid="select-unit"><SelectValue placeholder="Pilih unit" /></SelectTrigger>
                  <SelectContent className="max-h-64">{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.unit_id} · {u.nama}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Harga Sewa</Label><NumInput value={form.harga} onChange={(v) => set("harga", v)} data-testid="input-harga" /></div>
              <div><Label>Tanggal Mulai</Label><Input type="date" value={form.tanggal_mulai || ""} onChange={(e) => set("tanggal_mulai", e.target.value)} data-testid="input-tgl-mulai" /></div>
              <div><Label>Tanggal Selesai</Label><Input type="date" value={form.tanggal_selesai || ""} onChange={(e) => set("tanggal_selesai", e.target.value)} data-testid="input-tgl-selesai" /></div>
              <div className="sm:col-span-2"><Label>Rute Perjalanan</Label><Input value={form.rute} onChange={(e) => set("rute", e.target.value)} data-testid="input-rute" /></div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label>Biaya Sewa Rekanan</Label><NumInput value={form.biaya_sewa_rekanan} onChange={(v) => set("biaya_sewa_rekanan", v)} data-testid="input-rekanan" /></div>
              <div><Label>Biaya BBM</Label><NumInput value={form.biaya_bbm} onChange={(v) => set("biaya_bbm", v)} data-testid="input-bbm" /></div>
              <div><Label>Biaya Tol / Parkir</Label><NumInput value={form.biaya_toll_parkir} onChange={(v) => set("biaya_toll_parkir", v)} data-testid="input-toll" /></div>
              <div><Label>Biaya Lain-lain</Label><NumInput value={form.biaya_lain} onChange={(v) => set("biaya_lain", v)} data-testid="input-lain" /></div>
              <div className="sm:col-span-2"><Label>Keterangan</Label><Textarea value={form.ket} onChange={(e) => set("ket", e.target.value)} data-testid="input-ket" /></div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="flex items-end gap-2 rounded-lg bg-slate-50 p-3">
                <div className="flex-1"><Label className="text-xs">Daftarkan Driver Baru</Label>
                  <Input placeholder="Nama driver baru" value={newDriverName} onChange={(e) => setNewDriverName(e.target.value)} data-testid="input-new-driver" /></div>
                <Button type="button" variant="outline" onClick={registerDriver} data-testid="register-driver-btn"><UserPlus className="mr-1 h-4 w-4" /> Daftar</Button>
              </div>

              {form.drivers.map((d, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-12" data-testid={`driver-row-form-${i}`}>
                  <div className="sm:col-span-4"><Label className="text-xs">Driver</Label>
                    <Select value={d.driver_id || ""} onValueChange={(v) => pickDriver(i, v)}>
                      <SelectTrigger data-testid={`select-driver-${i}`}><SelectValue placeholder="Pilih driver" /></SelectTrigger>
                      <SelectContent className="max-h-64">{drivers.map((dr) => <SelectItem key={dr.id} value={dr.id}>{dr.nama}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="sm:col-span-4"><Label className="text-xs">Segmen Rute</Label><Input value={d.segmen} onChange={(e) => setDriver(i, "segmen", e.target.value)} data-testid={`input-segmen-${i}`} /></div>
                  <div className="sm:col-span-3"><Label className="text-xs">Gaji</Label><NumInput value={d.gaji} onChange={(v) => setDriver(i, "gaji", v)} data-testid={`input-gaji-${i}`} /></div>
                  <div className="flex items-end sm:col-span-1"><Button type="button" variant="ghost" size="icon" onClick={() => removeDriverRow(i)} data-testid={`remove-driver-${i}`}><X className="h-4 w-4 text-red-600" /></Button></div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addDriverRow} disabled={form.drivers.length >= 4} className="w-full" data-testid="add-driver-row-btn">
                <Plus className="mr-2 h-4 w-4" /> Tambah Driver {form.drivers.length >= 4 && "(maks 4)"}
              </Button>

              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-900 p-4 text-white sm:grid-cols-4">
                <div><p className="text-[10px] uppercase text-slate-400">Harga</p><p className="font-bold" data-testid="calc-harga">{fmtRp(form.harga)}</p></div>
                <div><p className="text-[10px] uppercase text-slate-400">Total Gaji Driver</p><p className={`font-bold ${totalGaji > Number(form.harga || 0) ? "text-red-400" : ""}`} data-testid="calc-gaji">{fmtRp(totalGaji)}</p></div>
                <div><p className="text-[10px] uppercase text-slate-400">Total Biaya</p><p className="font-bold" data-testid="calc-biaya">{fmtRp(totalBiaya)}</p></div>
                <div><p className="text-[10px] uppercase text-slate-400">Margin</p><p className={`font-bold ${margin < 0 ? "text-red-400" : "text-emerald-400"}`} data-testid="calc-margin">{fmtRp(margin)}</p></div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-2 flex-row justify-between gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>Kembali</Button>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="next-step-btn">Lanjut</Button>
            ) : (
              <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-order-btn">Simpan Transaksi</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus transaksi?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete-btn">Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
