# Draft: Laporan Harian PIC

Menu baru standalone (di luar group Personalia) untuk PIC mencatat kondisi lapangan harian, plus tab rekap agar Management bisa memantau laporan tiap PIC.

## Lokasi Menu
- **Group sidebar baru / standalone**: **Laporan Harian PIC** (sejajar dengan group lain seperti "Laporan Harian Outlet")
- Icon: `ClipboardCheck` (lucide)
- Route: `/pic-daily-report`
- Menu key: `pic_daily.report`
- Akses default:
  - PIC, Management, Admin → bisa lihat & input
  - Management/Admin → bisa lihat & filter rekap semua PIC
  - PIC → hanya lihat laporannya sendiri + outlet yang ia pegang

## Struktur Halaman (2 Tab)

### Tab 1 — Input Laporan Harian
Form harian (1 laporan per PIC per outlet per tanggal). Field draft:

| Field | Tipe | Catatan |
|---|---|---|
| Tanggal | date | default hari ini |
| Outlet | select | auto untuk PIC, pilih untuk management |
| Kondisi Operasional | select | Lancar / Ada Kendala / Tutup Sementara |
| Jumlah Crew Hadir | number | opsional |
| Kondisi Kebersihan | select | Baik / Cukup / Kurang |
| Kondisi Peralatan | select | Normal / Perlu Perbaikan / Rusak |
| Stok Bahan Kritis | textarea | item yang menipis |
| Kendala / Masalah | textarea | |
| Tindakan yang Diambil | textarea | |
| Catatan untuk Management | textarea | |
| Foto Lapangan | upload (multi, opsional) | storage bucket |

Tombol: Simpan / Update (jika sudah ada untuk tanggal & outlet itu).

### Tab 2 — Rekap Laporan
Filter: rentang tanggal, outlet, PIC.
Tabel rekap: Tanggal • PIC • Outlet • Kondisi • Kebersihan • Peralatan • Kendala (ringkas) • Aksi (lihat detail).
Klik baris → dialog detail lengkap + foto.
Export CSV (ikut pola halaman lain).

## Technical Notes

- **Tabel baru** `pic_daily_reports`: `id`, `user_id` (PIC), `outlet_id`, `report_date`, kolom sesuai field, `photos jsonb`, `created_at`, `updated_at`. Unique `(user_id, outlet_id, report_date)`.
- **GRANT + RLS**:
  - PIC: insert/update/select baris miliknya (`user_id = auth.uid()`) dan dibatasi `pic_can_access_outlet`.
  - Management/Admin: select & update semua.
- **Storage**: bucket baru `pic-daily-photos` (public read).
- **Menu registry** (`src/lib/menuRegistry.ts`): tambah group baru standalone `pic_daily` di luar `personalia`, berisi 1 item `pic_daily.report`.
- **Routing** (`src/App.tsx`): route `/pic-daily-report` dengan `ProtectedRoute menuKey="pic_daily.report"`.
- **File baru**: `src/pages/PicDailyReport.tsx` (dua tab dengan komponen `Tabs`).
- **Activity log**: trigger `log_table_activity('PIC Daily Report')` mengikuti pola tabel lain.

## Hal yang Perlu Konfirmasi Sebelum Implementasi
1. Field form di atas sudah cukup, atau ada yang ditambah/dikurangi?
2. Foto lapangan: wajib, opsional, atau skip dulu?
3. 1 laporan per hari per outlet (unique) — setuju?
4. Nama menu di sidebar: **Laporan Harian PIC** — oke atau ganti?

Setelah kamu approve / koreksi, aku langsung implement (migration + halaman + menu).
