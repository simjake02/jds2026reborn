import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Car, ShieldCheck } from "lucide-react";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Login() {
  const handleLogin = () => {
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
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
          <p className="mb-6 text-sm text-slate-500">
            Aplikasi internal untuk mengelola transaksi, driver, dan laporan operasional perusahaan.
            Masuk menggunakan akun Google yang telah diberi akses.
          </p>
          <Button
            data-testid="google-login-btn"
            onClick={handleLogin}
            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition"
            size="lg"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="mr-2 h-5 w-5 bg-white rounded-sm p-0.5" />
            Masuk dengan Google
          </Button>
          <div className="mt-6 flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Akses terbatas untuk pemilik, admin operasional, dan operator.</span>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-white/70">PT. Jawa Dwipa Solutions · Surabaya</p>
      </div>
    </div>
  );
}
