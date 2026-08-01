import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Car, ShieldCheck, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

function formatApiErrorDetail(detail) {
  if (detail == null) return "Terjadi kesalahan. Coba lagi.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => (e && e.msg) || JSON.stringify(e)).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [forgotOpen, setForgotOpen] = useState(false);
  const [fpEmail, setFpEmail] = useState("");
  const [fpPass, setFpPass] = useState("");
  const [fpConfirm, setFpConfirm] = useState("");
  const [fpLoading, setFpLoading] = useState(false);
  const [fpError, setFpError] = useState("");

  const handleGoogle = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      setUser(res.data.user);
      navigate("/dashboard", { state: { user: res.data.user } });
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || "Gagal masuk");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setFpError("");
    if (fpPass.length < 6) { setFpError("Password minimal 6 karakter"); return; }
    if (fpPass !== fpConfirm) { setFpError("Konfirmasi password tidak cocok"); return; }
    setFpLoading(true);
    try {
      await api.post("/auth/reset-password", { email: fpEmail.trim(), new_password: fpPass });
      toast.success("Password berhasil diperbarui. Silakan masuk.");
      setForgotOpen(false);
      setEmail(fpEmail.trim());
      setFpEmail(""); setFpPass(""); setFpConfirm("");
    } catch (err) {
      setFpError(formatApiErrorDetail(err.response?.data?.detail) || "Gagal mengubah password");
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1518043610038-064362b44076?crop=entropy&cs=srgb&fm=jpg&q=85&w=1920')" }}
      />
      <div className="absolute inset-0 bg-slate-900/70" />
      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Car className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Jawa Dwipa Solutions</h1>
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Sistem Operasional Travel</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.com" required data-testid="login-email" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" onClick={() => { setFpEmail(email); setForgotOpen(true); }}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline" data-testid="forgot-password-link">
                  Lupa password?
                </button>
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required data-testid="login-password" />
            </div>
            {error && <p className="text-sm text-red-600" data-testid="login-error">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition" size="lg" data-testid="login-submit-btn">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Masuk dengan Email
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs uppercase tracking-widest text-slate-400">atau</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <Button variant="outline" onClick={handleGoogle} className="w-full active:scale-[0.98] transition" size="lg" data-testid="google-login-btn">
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="mr-2 h-5 w-5" />
            Masuk dengan Google
          </Button>

          <div className="mt-6 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Akses terbatas untuk pemilik, admin operasional, dan operator.</span>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-white/70">PT. Jawa Dwipa Solutions · Surabaya</p>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent data-testid="forgot-password-dialog">
          <DialogHeader>
            <DialogTitle>Atur Ulang Password</DialogTitle>
            <DialogDescription>Masukkan email akun Anda dan password baru. Perubahan langsung berlaku.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Email</Label><Input type="email" value={fpEmail} onChange={(e) => setFpEmail(e.target.value)} placeholder="nama@perusahaan.com" data-testid="fp-email" /></div>
            <div><Label>Password Baru (min. 6 karakter)</Label><Input type="password" value={fpPass} onChange={(e) => setFpPass(e.target.value)} data-testid="fp-password" /></div>
            <div><Label>Konfirmasi Password Baru</Label><Input type="password" value={fpConfirm} onChange={(e) => setFpConfirm(e.target.value)} data-testid="fp-confirm" /></div>
            {fpError && <p className="text-sm text-red-600" data-testid="fp-error">{fpError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForgotOpen(false)}>Batal</Button>
            <Button onClick={handleReset} disabled={fpLoading} className="bg-emerald-600 hover:bg-emerald-700" data-testid="fp-submit-btn">
              {fpLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
