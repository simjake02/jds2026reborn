import { useEffect, useState, useCallback } from "react";
import { api, fmtDate } from "@/lib/api";
import { PageHeader, SectionCard } from "@/components/Shared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const tipeLabel = { A: "Agen", D: "Kedinasan", P: "Perorangan" };
const tipeBadge = { A: "bg-blue-100 text-blue-700", D: "bg-amber-100 text-amber-700", P: "bg-purple-100 text-purple-700" };

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

  const load = useCallback(async () => {
    const [c, u, d] = await Promise.all([api.get("/clients"), api.get("/units"), api.get("/drivers")]);
    setClients(c.data); setUnits(u.data); setDrivers(d.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filt = (arr, q, keys) => arr.filter((r) => keys.some((k) => (r[k] || "").toString().toLowerCase().includes(q.toLowerCase())));

  const openDialog = (kind, data) => setDialog({ kind, data: data || (kind === "clients" ? { penyewa_id: "", nama: "" } : kind === "units" ? { unit_id: "", nama: "" } : { nama: "", telepon: "", alamat: "", tanggal_bergabung: "", aktif: true }) });
  const setField = (k, v) => setDialog((d) => ({ ...d, data: { ...d.data, [k]: v } }));

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
          <CrudTable kind="drivers" columns={["Nama", "Telepon", "Alamat", "Bergabung", "Status"]} rows={filt(drivers, sd, ["nama", "telepon"])}
            search={sd} setSearch={setSd} canDelete={canDelete}
            onAdd={() => openDialog("drivers")} onEdit={(r) => openDialog("drivers", r)} onDelete={(id) => setDel({ kind: "drivers", id })}
            renderCell={(r) => (<><TableCell className="font-medium">{r.nama}</TableCell><TableCell>{r.telepon || "-"}</TableCell><TableCell className="max-w-[180px] truncate">{r.alamat || "-"}</TableCell><TableCell>{r.tanggal_bergabung ? fmtDate(r.tanggal_bergabung) : "-"}</TableCell><TableCell><Badge className={r.aktif ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}>{r.aktif ? "Aktif" : "Nonaktif"}</Badge></TableCell></>)} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{dialog?.data?.id ? "Edit" : "Tambah"} {dialog?.kind === "clients" ? "Penyewa" : dialog?.kind === "units" ? "Unit" : "Driver"}</DialogTitle></DialogHeader>
          {dialog?.kind === "clients" && (
            <div className="space-y-3">
              <div><Label>ID Penyewa (A/D/P + nomor)</Label><Input value={dialog.data.penyewa_id} onChange={(e) => setField("penyewa_id", e.target.value)} placeholder="A0001 / D0001 / P0001" data-testid="input-penyewa-id" /><p className="mt-1 text-xs text-slate-400">A=Agen, D=Kedinasan, P=Perorangan</p></div>
              <div><Label>Nama</Label><Input value={dialog.data.nama} onChange={(e) => setField("nama", e.target.value)} data-testid="input-penyewa-nama" /></div>
            </div>
          )}
          {dialog?.kind === "units" && (
            <div className="space-y-3">
              <div><Label>ID Unit</Label><Input value={dialog.data.unit_id} onChange={(e) => setField("unit_id", e.target.value)} placeholder="U0001" data-testid="input-unit-id" /></div>
              <div><Label>Nama Unit</Label><Input value={dialog.data.nama} onChange={(e) => setField("nama", e.target.value)} data-testid="input-unit-nama" /></div>
            </div>
          )}
          {dialog?.kind === "drivers" && (
            <div className="space-y-3">
              <div><Label>Nama</Label><Input value={dialog.data.nama} onChange={(e) => setField("nama", e.target.value)} data-testid="input-driver-nama" /></div>
              <div><Label>Nomor Telepon</Label><Input value={dialog.data.telepon} onChange={(e) => setField("telepon", e.target.value)} data-testid="input-driver-telepon" /></div>
              <div><Label>Alamat</Label><Input value={dialog.data.alamat} onChange={(e) => setField("alamat", e.target.value)} data-testid="input-driver-alamat" /></div>
              <div><Label>Tanggal Bergabung</Label><Input type="date" value={dialog.data.tanggal_bergabung || ""} onChange={(e) => setField("tanggal_bergabung", e.target.value)} data-testid="input-driver-tgl" /></div>
              <div className="flex items-center gap-2"><Switch checked={dialog.data.aktif} onCheckedChange={(v) => setField("aktif", v)} data-testid="input-driver-aktif" /><Label>Aktif</Label></div>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setDialog(null)}>Batal</Button><Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-master-btn">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus data ini?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete-master">Hapus</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
