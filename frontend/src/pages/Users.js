import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { PageHeader, SectionCard } from "@/components/Shared";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserPlus, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "operator" });
  const [pwUser, setPwUser] = useState(null);
  const [newPw, setNewPw] = useState("");

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

  const resetPassword = async () => {
    try {
      await api.put(`/users/${pwUser.user_id}`, { password: newPw });
      toast.success(`Password ${pwUser.name} diperbarui`);
      setPwUser(null); setNewPw("");
    } catch (e) { toast.error(e.response?.data?.detail || "Gagal"); }
  };

  return (
    <div>
      <PageHeader title="Manajemen Pengguna" subtitle="Buat akun email/password, atur peran & akses. Login Google juga didukung untuk email yang terdaftar.">
        <Button onClick={() => setCreateOpen(true)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-user-btn">
          <UserPlus className="mr-2 h-4 w-4" /> Tambah Pengguna
        </Button>
      </PageHeader>
      <SectionCard>
        <Table>
          <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>Peran</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.user_id} data-testid="user-row">
                <TableCell className="font-medium">{u.name} {u.user_id === user.user_id && <Badge variant="secondary" className="ml-1">Anda</Badge>}</TableCell>
                <TableCell className="text-slate-500">{u.email}</TableCell>
                <TableCell>
                  <Select value={u.role} onValueChange={(v) => changeRole(u, v)} disabled={u.user_id === user.user_id}>
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
                    <Switch checked={u.active !== false} onCheckedChange={(v) => toggleActive(u, v)} disabled={u.user_id === user.user_id} data-testid={`active-switch-${u.email}`} />
                    <span className="text-sm text-slate-500">{u.active !== false ? "Aktif" : "Nonaktif"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setPwUser(u)} title="Atur ulang password" data-testid={`reset-pw-${u.email}`}>
                    <KeyRound className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Pengguna</DialogTitle></DialogHeader>
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
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwUser} onOpenChange={(o) => !o && setPwUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atur Ulang Password — {pwUser?.name}</DialogTitle></DialogHeader>
          <div><Label>Password Baru (min. 6 karakter)</Label><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} data-testid="reset-pw-input" /></div>
          <DialogFooter><Button variant="ghost" onClick={() => setPwUser(null)}>Batal</Button><Button onClick={resetPassword} className="bg-emerald-600 hover:bg-emerald-700" data-testid="save-pw-btn">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
