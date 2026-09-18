# PRD — PT. Jawa Dwipa Solutions · Sistem Operasional Travel

## Problem Statement
Aplikasi web operasional internal untuk perusahaan jasa travel di Surabaya. Akses terbatas (pemilik, admin operasional, operator). Responsif desktop & mobile. UI Bahasa Indonesia, mata uang Rupiah.

## Architecture
- **Stack**: FastAPI + MongoDB + React (CRA/craco) + Tailwind + shadcn/ui + Recharts.
- **Auth**: Emergent-managed Google OAuth. Session token (httpOnly cookie, 7 hari) + Bearer fallback.
- **RBAC**: `owner` (Pemilik, full + user mgmt), `admin` (Admin Operasional, kelola + hapus), `operator` (input/edit, tanpa hapus). User pertama login = owner otomatis; user baru = operator (owner atur peran/aktif via halaman Pengguna).
- **Data model**: `orders` (header) dengan array `drivers` embedded (detail order_drivers, maks 4). `total_gaji_driver`, `total_biaya`, `margin`, `status` (draft/lengkap) dihitung otomatis. Master: `clients` (tipe A/D/P dari prefix id), `units`, `drivers`.

## User Personas
- **Pemilik**: lihat semua dashboard & laporan, kelola pengguna.
- **Admin Operasional**: input & kelola transaksi harian + master data.
- **Operator**: bantu input data (tanpa hapus).

## Core Requirements (static)
- Alur input bertahap (info dasar → biaya operasional → penugasan driver) + edit kapan saja.
- Multiple driver per order dengan gaji & segmen rute; validasi total gaji ≤ harga.
- CRUD master (penyewa/unit/driver), registrasi driver baru inline.
- 4 dashboard ala Looker Studio: Ringkasan Eksekutif, Analisis Klien, Analisis Unit, Performa Driver.
- Export Excel di setiap laporan; search & filter di tiap halaman.

## Implemented (2026-07-31)- ✅ Google OAuth + RBAC (owner/admin/operator) + halaman Manajemen Pengguna.
- ✅ Import data contoh Excel (Agu–Okt 2025): 299 orders, 52 clients, 14 units, 55 drivers.
- ✅ Transaksi: wizard 3-langkah, multi-driver dinamis (maks 4), auto margin, validasi gaji, edit/hapus.
- ✅ Master data CRUD (3 tab) dengan tipe klien otomatis.
- ✅ 4 dashboard dengan KPI, line/bar/donut charts, tabel, filter tanggal/tipe/bulan-tahun, search.
- ✅ Export Excel (orders, klien, unit, driver) via openpyxl.
- ✅ Tested: backend 26/26 pytest pass; semua flow frontend pass.

## Backlog / Next
- ✅ (2025-07 batch) Rename "Biaya Sewa Rekanan"→"Biaya Sewa Mobil"; input Nominal DP saat status bayar DP; hapus login Google + divider; logo PNG baru (login+sidebar); upload Foto SIM driver (kompres base64) + thumbnail/lightbox; Transaksi default kosong + filter dropdown Bulan/Tahun (urut naik id_order); filter driver di Daftar Driver + klik "jumlah tugas" → modal detail tugas; Admin bisa ubah akun sendiri; index MongoDB (tanggal_mulai, unique id_order); filter menempel antar halaman (localStorage).
- P1: unique index on orders.id_order.
- P1: Index MongoDB pada `tanggal_mulai`, unique `id_order`; pagination list endpoints.
- P2: Kolom "sisa pembayaran"/status pembayaran; ekspor PDF; audit log per user.
- P2: Self-host login background image; DialogDescription a11y.
