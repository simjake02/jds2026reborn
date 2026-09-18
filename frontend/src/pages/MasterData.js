import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { PageHeader, SectionCard } from "@/components/Shared";
import { FormDialog } from "@/components/FormDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DialogFooter, Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const tipeLabel = { A: "Agen", D: "Kedinasan", P: "Perorangan" };
const tipeBadge = { A: "bg-blue-100 text-blue-700", D: "bg-amber-100 text-amber-700", P: "bg-purple-100 text-purple-700" };

// Compress & resize an image file to a small JPEG data URL (keeps DB docs light).
function fileToCompressedDataUrl(file, maxDim = 1100, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width >= height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > width && height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function CrudTable({ kind, columns, rows, onAdd, onEdit, onDelete, canDelete, search, setSearch, renderCell }) {
  return (
    <SectionCard action={
      <div className="flex gap-2">
        <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input placeholder="Cari..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-40 pl-8" data-testid={`search-${kind}`} /></div>
        <Button onClick={onAdd} className="bg-emerald-600 hover:bg-emerald-700" data-testid={`add-${kind}`}><Plus className="mr-2 h-4 w-4" /> Tambah</Button>
      </div>
    }>
      <div className="max-h-[520px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-white"><TableRow>{columns.map((c) => <TableHead key={c}>{c}</TableHead>)}<TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} data-testid={`${kind}-row`}>
                {renderCell(r)}
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(r)} data-testid={`edit-${kind}`}><Pencil className="h-4 w-4" /></Button>
                  {canDelete && <Button variant="ghost" size="icon" onClick={() => onDelete(r.id)} data-testid={`delete-${kind}`}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={columns.length + 1} className="py-8 text-center text-slate-400">Tidak ada data</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}

export default function MasterData() {
  const { user } = useAuth();
  const canDelete = ["owner", "admin"].includes(user?.role);
  const [clients, setClients] = useState([]);
  const [units, setUnits] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [sc, setSc] = useState(""); const [su, setSu] = useState(""); const [sd, setSd] = useState("");
  const [dialog, setDialog] = useState(null); // {kind, data}
  const [del, setDel] = useState(null); // {kind, id}
  const [simView, setSimView] = useState(null); // data url for lightbox

  const load = useCallback(async () => {
    const [c, u, d] = await Promise.all([api.get("/clients"), api.get("/units"), api.get("/drivers")]);
    setClients(c.data); setUnits(u.data); setDrivers(d.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filt = (arr, q, keys) => arr.filter((r) => keys.some((k) => (r[k] || "").toString().toLowerCase().includes(q.toLowerCase())));

  const openDialog = async (kind, data) => {
    if (data) { setDialog({ kind, data }); return; }
    if (kind === "clients") setDialog({ kind, data: { penyewa_id: "", nama: "" } });
    else if (kind === "units") setDialog({ kind, data: { unit_id: "", nama: "" } });
    else {
      let driver_id = "";
      try { driver_id = (await api.get("/drivers/next-code")).data.driver_id; } catch {}
      setDialog({ kind, data: { driver_id, nama: "", telepon: "", aktif: true, foto_sim: null } });
    }
  };
  const setField = (k, v) => setDialog((d) => ({ ...d, data: { ...d.data, [k]: v } }));

  const handleSimFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Ukuran file maksimal 10MB"); e.target.value = ""; return; }
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setField("foto_sim", dataUrl);
    } catch { toast.error("Gagal memproses gambar"); }
    e.target.value = "";
  };

  const save = async () => {
    const { kind, data } = dialog;
    try {
      if (data.id) await api.put(`/${kind}/${data.id}`, data);
      else await api.post(`/${kind}`, data);
      toast.success("Data disimpan");
      setDialog(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal menyimpan"); }
  };
  const doDelete = async () => { await api.delete(`/${del.kind}/${del.id}`); setDel(null); toast.success("Data dihapus"); load(); };

  const kindLabel = dialog?.kind === "clients" ? "Penyewa" : dialog?.kind === "units" ? "Unit" : "Driver";

  return (
    <div>
      <PageHeader title="Data Master" subtitle="Kelola penyewa, unit kendaraan, dan driver" />
      <Tabs defaultValue="clients">
        <TabsList className="mb-4">
          <TabsTrigger value="clients" data-testid="tab-clients">Penyewa ({clients.length})</TabsTrigger>
          <TabsTrigger value="units" data-testid="tab-units">Unit ({units.length})</TabsTrigger>
          <TabsTrigger value="drivers" data-testid="tab-drivers">Driver ({drivers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          <CrudTable kind="clients" columns={["ID Penyewa", "Nama", "Tipe"]} rows={filt(clients, sc, ["penyewa_id", "nama"])}
            search={sc} setSearch={setSc} canDelete={canDelete}
            onAdd={() => openDialog("clients")} onEdit={(r) => openDialog("clients", r)} onDelete={(id) => setDel({ kind: "clients", id })}
            renderCell={(r) => (<><TableCell className="font-medium">{r.penyewa_id}</TableCell><TableCell>{r.nama}</TableCell><TableCell><Badge variant="secondary" className={tipeBadge[r.tipe]}>{tipeLabel[r.tipe]}</Badge></TableCell></>)} />
        </TabsContent>
        <TabsContent value="units">
          <CrudTable kind="units" columns={["ID Unit", "Nama Unit"]} rows={filt(units, su, ["unit_id", "nama"])}
            search={su} setSearch={setSu} canDelete={canDelete}
            onAdd={() => openDialog("units")} onEdit={(r) => openDialog("units", r)} onDelete={(id) => setDel({ kind: "units", id })}
            renderCell={(r) => (<><TableCell className="font-medium">{r.unit_id}</TableCell><TableCell>{r.nama}</TableCell></>)} />
        </TabsContent>
        <TabsContent value="drivers">
          <CrudTable kind="drivers" columns={["ID Driver", "Nama", "Telepon", "Status", "Foto SIM"]} rows={filt(drivers, sd, ["driver_id", "nama", "telepon"])}
            search={sd} setSearch={setSd} canDelete={canDelete}
            onAdd={() => openDialog("drivers")} onEdit={(r) => openDialog("drivers", r)} onDelete={(id) => setDel({ kind: "drivers", id })}
            renderCell={(r) => (<><TableCell className="font-medium">{r.driver_id || "-"}</TableCell><TableCell>{r.nama}</TableCell><TableCell>{r.telepon || "-"}</TableCell><TableCell><Badge className={r.aktif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}>{r.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell><TableCell>{r.foto_sim ? <button type="button" onClick={() => setSimView(r.foto_sim)} data-testid="view-sim" title="Lihat foto SIM"><img src={r.foto_sim} alt="SIM" className="h-10 w-16 rounded border border-slate-200 object-cover transition hover:opacity-80" /></button> : <span className="text-xs text-slate-400">-</span>}</TableCell></>)} />
        </TabsContent>
      </Tabs>

      {dialog && (
        <FormDialog open={!!dialog} onClose={() => setDialog(null)} title={`${dialog?.data?.id ? "Edit" : "Tambah"} ${kindLabel}`} testid="master-dialog">
          {dialog.kind === "clients" && (
            <div className="space-y-3">
              <div><Label>ID Penyewa (A/D/P + nomor)</Label><Input value={dialog.data.penyewa_id} onChange={(e) => setField("penyewa_id", e.target.value)} placeholder="A0001 / D0001 / P0001" data-testid="input-penyewa-id" /><p className="mt-1 text-xs text-slate-400">A=Agen, D=Kedinasan, P=Perorangan</p></div>
              <div><Label>Nama</Label><Input value={dialog.data.nama} onChange={(e) => setField("nama", e.target.value)} data-testid="input-penyewa-nama" /></div>
            </div>
          )}
          {dialog.kind === "units" && (
            <div className="space-y-3">
              <div><Label>ID Unit</Label><Input value={dialog.data.unit_id} onChange={(e) => setField("unit_id", e.target.value)} placeholder="U0001" data-testid="input-unit-id" /></div>
              <div><Label>Nama Unit</Label><Input value={dialog.data.nama} onChange={(e) => setField("nama", e.target.value)} data-testid="input-unit-nama" /></div>
            </div>
          )}
          {dialog.kind === "drivers" && (
            <div className="space-y-3">
              <div><Label>ID Driver</Label><Input value={dialog.data.driver_id || ""} onChange={(e) => setField("driver_id", e.target.value)} placeholder="DR001" data-testid="input-driver-id" /><p className="mt-1 text-xs text-slate-400">Otomatis dari sistem, bisa diubah manual.</p></div>
              <div><Label>Nama</Label><Input value={dialog.data.nama} onChange={(e) => setField("nama", e.target.value)} data-testid="input-driver-nama" /></div>
              <div><Label>Nomor Telepon</Label><Input value={dialog.data.telepon} onChange={(e) => setField("telepon", e.target.value)} data-testid="input-driver-telepon" /></div>
              <div className="flex items-center gap-2"><Switch checked={dialog.data.aktif} onCheckedChange={(v) => setField("aktif", v)} data-testid="input-driver-aktif" /><Label>Aktif</Label></div>
              <div>
                <Label>Foto SIM</Label>
                <div className="mt-1 flex items-center gap-3">
                  {dialog.data.foto_sim ? (
                    <img src={dialog.data.foto_sim} alt="SIM" className="h-20 w-32 rounded-md border border-slate-200 object-cover" data-testid="sim-preview" />
                  ) : (
                    <div className="flex h-20 w-32 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400">Belum ada</div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input type="file" accept="image/*" id="sim-file-input" className="hidden" onChange={handleSimFile} data-testid="input-sim-file" />
                    <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("sim-file-input").click()} data-testid="upload-sim-btn">
                      {dialog.data.foto_sim ? "Ganti Foto" : "Unggah Foto"}
                    </Button>
                    {dialog.data.foto_sim && <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => setField("foto_sim", null)} data-testid="remove-sim-btn">Hapus Foto</Button>}
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-400">Format gambar (JPG/PNG). Otomatis dikompres saat diunggah.</p>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setDialog(null)}>Batal</Button><Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-master-btn">Simpan</Button></DialogFooter>
        </FormDialog>
      )}

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus data ini?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete-master">Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!simView} onOpenChange={(o) => !o && setSimView(null)}>
        <DialogContent className="max-w-lg" data-testid="sim-lightbox">
          {simView && <img src={simView} alt="Foto SIM" className="max-h-[70vh] w-full rounded-md object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
