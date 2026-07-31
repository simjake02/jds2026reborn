import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { PageHeader, SectionCard } from "@/components/Shared";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const ROLE_LABEL = { owner: "Pemilik", admin: "Admin Operasional", operator: "Operator" };

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);

  const load = useCallback(async () => {
    const res = await api.get("/users");
    setUsers(res.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const changeRole = async (u, role) => {
    await api.put(`/users/${u.user_id}`, { role });
    toast.success(`Peran ${u.name} diubah`);
    load();
  };
  const toggleActive = async (u, active) => {
    await api.put(`/users/${u.user_id}`, { active });
    toast.success(active ? "Akun diaktifkan" : "Akun dinonaktifkan");
    load();
  };

  return (
    <div>
      <PageHeader title="Manajemen Pengguna" subtitle="Atur peran dan akses. Pengguna baru masuk sebagai Operator dan menunggu persetujuan Pemilik." />
      <SectionCard>
        <Table>
          <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Email</TableHead><TableHead>Peran</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
