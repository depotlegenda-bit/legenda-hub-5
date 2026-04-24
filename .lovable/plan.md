## Tujuan
Menambahkan tombol **Edit** pada tab **Rekap Laporan** di submenu **Laporan Harian Finance** (`/finance/daily-recap?tab=recap`) yang **hanya muncul untuk role `admin`**, sehingga admin bisa memperbarui laporan harian yang sudah disimpan tanpa harus menghapus & input ulang.

## Lokasi & Konteks
- File utama: `src/pages/finance/DailyRecap.tsx`
- Tabel terkait: `finance_daily_reports` (header) + `finance_expense_items` (rincian pengeluaran)
- RLS sudah mendukung: kebijakan `Admin full access finance_daily_reports` dan `Admin full access finance_expense_items` (lewat `is_admin()`) → admin bisa UPDATE/DELETE/INSERT tanpa perlu migrasi tambahan.
- Saat ini admin hanya melihat tombol **Hapus** (ikon `Trash2`) di kolom paling kanan tabel rekap (baris ~711-717). Kolom Edit belum ada.

## Perubahan UI
1. **Kolom aksi tambahan untuk admin** di tabel rekap:
   - Tambah satu kolom header kosong khusus admin (di samping kolom hapus) untuk tombol Edit (ikon `Pencil` dari `lucide-react`).
   - Sesuaikan `colSpan` pada baris expanded & baris kosong "Belum ada laporan…" menjadi `8` saat `role === 'admin'` (sebelumnya `7`).
   - Tombol Edit di-`stopPropagation` agar tidak ikut meng-expand baris.

2. **Dialog Edit Laporan** (komponen baru lokal di file yang sama, atau sub-komponen `EditReportDialog`):
   - Menggunakan `Dialog` dari `@/components/ui/dialog` dengan ukuran `max-w-3xl`, scrollable.
   - Isi form sama persis dengan form input (re-use struktur), berisi:
     - Tanggal laporan (`report_date`)
     - Nama pelapor (`reporter_name`)
     - Semua **income fields** dinamis sesuai `activeConfig.income_fields` + `pair_groups` (pakai `MoneyInput`).
     - Catatan (`notes`)
     - Daftar **expense items** dengan tab `cash` / `transfer` (mirip form input: item_name, unit_price, qty, tombol hapus, tombol tambah baris).
   - Footer: tombol **Batal** dan **Simpan Perubahan** (loading state saat submitting).

3. **Pre-fill data** saat dialog dibuka:
   - `reportDate`, `reporterName`, `notes` dari row laporan.
   - `incomeValues` dari kolom `extra_fields` (jsonb) — di-merge dengan `createIncomeValuesFromConfig(activeConfig)` agar field yang baru ditambahkan di config tetap muncul dengan nilai 0.
   - `lines` dari array `finance_expense_items` (sudah ada di `r.finance_expense_items` karena query `select('*, finance_expense_items(*)')`). Map ke struktur `ExpenseLine` lokal (`id`, `payment_type`, `item_name`, `unit_price`, `qty`).

## Logika Penyimpanan (handleUpdate)
Fungsi baru `handleUpdate(reportId)` yang:
1. **UPDATE header** `finance_daily_reports` (kolom: `report_date`, `reporter_name`, `starting_cash`, `cash_on_hand_added`, `notes`, `extra_fields`) berdasarkan `id`.
2. **DELETE** semua `finance_expense_items` lama dengan `report_id = reportId`.
3. **INSERT** ulang `finance_expense_items` dari state dialog (filter baris kosong: `item_name.trim() !== '' || unit_price > 0`, dengan `subtotal = unit_price * qty`).
4. Jika langkah 2/3 gagal, tampilkan toast error (header sudah terupdate; tidak rollback karena risk minimal — alternatif ditandai di bawah).
5. Toast sukses → tutup dialog → `fetchReports()` untuk refresh tabel.

> **Catatan strategi delete+insert items**: paling sederhana & konsisten dengan struktur tabel saat ini (tidak ada FK action). Lebih aman dibanding diff per-item. Aman untuk admin karena RLS `is_admin()` mengizinkan DELETE.

## Pembatasan Akses
- Tombol Edit & dialog hanya di-render saat `role === 'admin'` (mengikuti pola tombol Hapus yang sudah ada).
- Tidak ada perubahan untuk role lain (PIC/management tetap hanya bisa lihat di rekap).

## Persistensi Draft
- Tidak menyentuh logika `usePersistentDraft` untuk form **Input Laporan**. Edit dialog menggunakan **state lokal terpisah** (di-mount on demand), sehingga draft input baru yang sedang diketik user **tidak terganggu**.

## Tidak Ada Perubahan Database
- Tidak ada migrasi baru. RLS sudah memadai untuk admin (`is_admin()` ALL command pada kedua tabel).

## File Yang Akan Diedit
- `src/pages/finance/DailyRecap.tsx` (tambah ikon `Pencil`, kolom Edit, sub-komponen dialog, fungsi `handleUpdate`).

## Verifikasi Setelah Implementasi
- Login sebagai admin → buka `/finance/daily-recap?tab=recap` → klik Edit pada salah satu baris → ubah nominal & rincian pengeluaran → simpan → tabel rekap ter-update sesuai (selisih ikut dihitung ulang dari `extra_fields` baru).
- Login sebagai role lain (pic/management/staff) → tombol Edit **tidak muncul**.
- Refresh halaman setelah edit → data persist (sudah di DB, bukan draft).
