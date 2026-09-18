import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { PageHeader, SectionCard } from "@/components/Shared";
import { FormDialog } from "@/components/FormDialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function UsersPage() {
  const { user } = useAuth();
  const canManage = ["owner", "operator"].includes(user?.role);
  const isAdmin = user?.role === "admin";
  const [users, setUsers] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "operator" });
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", password: "" });
  const [delUser, setDelUser] = useState(null);

  const load = useCallback(async () => {
    const res = await api.get("/users");
    setUsers(res.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const changeRole = async (u, role) => { await api.put(`/users/${u.user_id}`, { role }); toast.success(`Peran ${u.name} diubah`); load(); };
  const toggleActive = async (u, active) => { await api.put(`/users/${u.user_id}`, { active }); toast.success(active ? "Akun diaktifkan" : "Akun dinonaktifkan"); load(); };

  const createUser = async () => {
    try {
      await api.post("/users", form);
      toast.success("Pengguna dibuat");
      setCreateOpen(false); setForm({ email: "", password: "", name: "", role: "operator" }); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal membuat pengguna"); }
  };

  const openEdit = (u) => { setEditUser(u); setEditForm({ name: u.name || "", email: u.email || "", password: "" }); };
  const saveEdit = async () => {
    try {
      const payload = { name: editForm.name, email: editForm.email };
      if (editForm.password) payload.password = editForm.password;
      await api.put(`/users/${editUser.user_id}`, payload);
      toast.success("Data pengguna diperbarui");
      setEditUser(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal memperbarui"); }
  };

  const doDelete = async () => {
    try {
      await api.delete(`/users/${delUser.user_id}`);
      toast.success(`Akses ${delUser.name} dihapus`);
      setDelUser(null); load();
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal menghapus"); setDelUser(null); }
  };

  return (
    <div>
      <PageHeader title="Manajemen Pengguna" subtitle={canManage ? "Buat akun, ubah email/password, atur peran & hapus akses pengguna." : isAdmin ? "Anda dapat mengubah akun Anda sendiri (nama, email, password)." : "Daftar pengguna sistem (hanya lihat)."}>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-user-btn">
            <UserPlus className="mr-2 h-4 w-4" /> Tambah Pengguna
          </Button>
        )}
      </PageHeader>
      <SectionCard>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>Peran</TableHead><TableHead>Status</TableHead>
            {(canManage || isAdmin) && <TableHead className="text-right">Aksi</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.user_id} data-testid="user-row">
                <TableCell className="font-medium">{u.name} {u.user_id === user.user_id && <Badge variant="secondary" className="ml-1">Anda</Badge>}</TableCell>
                <TableCell className="text-slate-500">{u.email}</TableCell>
                <TableCell>
                  <Select value={u.role} onValueChange={(v) => changeRole(u, v)} disabled={!canManage || u.user_id === user.user_id}>
                    <SelectTrigger className="w-44" data-testid={`role-select-${u.email}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Pemilik</SelectItem>
                      <SelectItem value="admin">Admin Operasional</SelectItem>
                      <SelectItem value="operator">Operator</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={u.active !== false} onCheckedChange={(v) => toggleActive(u, v)} disabled={!canManage || u.user_id === user.user_id} data-testid={`active-switch-${u.email}`} />
                    <span className="text-sm text-slate-500">{u.active !== false ? "Aktif" : "Nonaktif"}</span>
                  </div>
                </TableCell>
                {(canManage || isAdmin) && (
                  <TableCell className="text-right">
                    {(canManage || (isAdmin && u.user_id === user.user_id)) && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Ubah email/password" data-testid={`edit-user-${u.email}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => setDelUser(u)} disabled={u.user_id === user.user_id} title="Hapus akses" data-testid={`delete-user-${u.email}`}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      {createOpen && (
        <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} title="Tambah Pengguna" testid="create-user-dialog">
          <div className="space-y-3">
            <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="new-user-name" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="new-user-email" /></div>
            <div><Label>Password (min. 6 karakter)</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="new-user-password" /></div>
            <div><Label>Peran</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="new-user-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Pemilik</SelectItem>
                  <SelectItem value="admin">Admin Operasional</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setCreateOpen(false)}>Batal</Button><Button onClick={createUser} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-user-btn">Simpan</Button></DialogFooter>
        </FormDialog>
      )}

      {editUser && (
        <FormDialog open={!!editUser} onClose={() => setEditUser(null)} title={`Ubah Pengguna — ${editUser?.name}`} description='Ubah email dan/atau password. Kosongkan password bila tidak ingin menggantinya.' testid="edit-user-dialog">
          <div className="space-y-3">
            <div><Label>Nama</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} data-testid="edit-user-name" /></div>
            <div><Label>Email</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} data-testid="edit-user-email" /></div>
            <div><Label>Password Baru (opsional, min. 6 karakter)</Label><Input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="••••••••" data-testid="edit-user-password" /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setEditUser(null)}>Batal</Button><Button onClick={saveEdit} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-edit-user-btn">Simpan</Button></DialogFooter>
        </FormDialog>
      )}

      <AlertDialog open={!!delUser} onOpenChange={(o) => !o && setDelUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus akses {delUser?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Akun <b>{delUser?.email}</b> akan dihapus permanen dan tidak bisa masuk lagi. Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700" data-testid="confirm-delete-user">Hapus Akses</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
