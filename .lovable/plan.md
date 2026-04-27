## Tujuan
Memudahkan input & dokumentasi data finance dengan menambahkan:
- **Export CSV + PDF** di Laporan Harian Finance (Daily Recap) dan Laporan Laba Rugi (Profit Loss).
- **Import CSV** di Daily Recap untuk bulk-input rincian pengeluaran (Profit Loss tidak butuh import karena datanya berasal dari kategorisasi expense yang sudah ada).
- **Akses bulk-import dibatasi** ke role `admin` dan `management` saja.

Komponen reusable `ExportButtons` dan `CsvImportButton` sudah ada — tinggal dirangkai. Tidak ada perubahan skema database.

---

## 1. Laporan Harian Finance — `src/pages/finance/DailyRecap.tsx`

### A. Export CSV + PDF (Tab Rekap)
Tambahkan `<ExportButtons>` di header Tab Rekap (di atas tabel daftar laporan), sumber data = `reports` yang sudah difilter periode/outlet aktif.

**Kolom export (1 baris per laporan):**
- Tanggal (`report_date`)
- Outlet (resolved dari `outlets` lookup)
- Reporter (`reporter_name`)
- Pengeluaran Cash (sum `finance_expense_items` payment_type=cash)
- Pengeluaran Transfer (sum payment_type=transfer)
- Total Pengeluaran
- Selisih (hasil `evalSelisih(activeConfig.selisih_formula, …)`)
- Catatan (`notes`)
- Filename: `laporan-harian-finance-{outlet}-{periode}`
- Orientation PDF: `landscape`

**Tambahan (opsional dalam PDF):** Section kedua berisi rincian item pengeluaran semua laporan dalam periode (tanggal · payment_type · nama · qty · unit_price · subtotal) supaya PDF bisa jadi arsip lengkap.

### B. Import CSV (Tab Input — hanya Admin & Management)
Tombol `<CsvImportButton>` muncul di samping tombol "Simpan Laporan" di tab Input, hanya jika `role === 'admin' || role === 'management'`.

**Cakupan import:** Bulk-load **rincian pengeluaran** ke form yang sedang aktif (outlet & tanggal yang dipilih user). Setelah import, semua baris masuk ke state `lines` dan user tetap perlu klik "Simpan Laporan" — ini lebih aman daripada langsung insert ke DB karena:
- User bisa review hasil parse sebelum commit
- Tetap pakai 1 alur simpan (header report + items) yang sudah ada
- Mendukung outlet & tanggal yang sudah dipilih user

**Header CSV template:**
```
payment_type,item_name,unit_price,qty,category
cash,Bawang Merah,15000,2,Bahan Baku
transfer,Bayar Listrik,250000,1,Utilitas
```

**Validasi `parseRow`:**
- `payment_type` wajib `cash` atau `transfer` (case-insensitive)
- `item_name` wajib non-empty
- `unit_price` & `qty` numeric ≥ 0
- `category` opsional (default `Lain-lain`)

**`onImport`:** Tidak insert ke DB. Append ke state `lines` lalu return `{success, failed: 0}`. Toast: *"X baris pengeluaran ditambahkan ke form. Klik Simpan untuk menyimpan."*

### C. Import CSV untuk Pendapatan (opsional, sebagai tombol kedua)
Tombol kedua "Import Pendapatan CSV" yang mengisi `incomeValues` (field-field income dari `activeConfig.income_fields`).

**Header CSV** auto-generated dari config aktif outlet:
```
field_key,amount
cash_start,500000
cash_added,200000
penjualan_offline,2500000
```

Validasi: `field_key` harus ada di `activeConfig.income_fields` atau pair_groups; `amount` numeric (boleh negatif sesuai pengaturan MoneyInput).

→ Akan saya tanyakan saat implementasi jika ternyata tidak diperlukan; default-nya **disertakan** karena melengkapi alur input.

---

## 2. Laporan Laba Rugi — `src/pages/finance/ProfitLoss.tsx`
File ini **sudah punya** `<ExportButtons>` (CSV + PDF) di header — sudah selesai. Yang perlu ditingkatkan:

### A. Perbaikan Export
- Saat ini export hanya berisi rekap kategori. Tambahkan opsi export "Detail" yang berisi semua expense items dalam periode (tanggal · outlet · kategori · deskripsi · qty · unit_price · amount) supaya bisa dipakai untuk audit.
- Implementasi: jadikan dua tombol terpisah — **Export Rekap** (existing) dan **Export Detail** (baru), keduanya CSV + PDF.

### B. Tidak ada Import CSV di Profit Loss
Alasan: data Profit Loss adalah hasil **kategorisasi** dari `expense_items` (tabel `financial_reports`) yang sudah diinput di halaman lain. Import CSV di sini akan menduplikasi data. Bila user butuh bulk-input, jalurnya lewat Daily Recap (point 1B) atau halaman Financial Report.

→ Akan saya konfirmasi ulang jika ternyata user mau import langsung kategori/akun L/R; secara default **tidak ditambahkan**.

---

## 3. Hak Akses
- Tombol Export CSV/PDF: tampil untuk **semua role** yang bisa membuka halaman tersebut (export = read-only, aman).
- Tombol Import CSV (Daily Recap): **hanya tampil** jika `role === 'admin' || role === 'management'`. Cek role pakai `useAuth()` yang sudah ada di file.

---

## 4. File yang akan diubah
- `src/pages/finance/DailyRecap.tsx` — tambah ExportButtons (rekap) + CsvImportButton (input, role-gated) + helper untuk konversi data ke kolom export.
- `src/pages/finance/ProfitLoss.tsx` — tambah tombol Export Detail (CSV + PDF) di samping Export Rekap yang sudah ada.

## 5. Tidak diubah
- Skema database (tidak ada migration).
- Komponen `ExportButtons.tsx`, `CsvImportButton.tsx`, `exportUtils.ts`, `csvImport.ts` (sudah generic, dipakai apa adanya).
- RLS — semua operasi tetap lewat alur insert biasa yang sudah dilindungi RLS yang ada.

## 6. Testing manual setelah implementasi
1. Login sebagai admin → buka Daily Recap → klik Export CSV/PDF di tab Rekap → file ter-download dengan kolom benar.
2. Di tab Input, klik "Template CSV" → isi → "Import CSV" → preview muncul → konfirmasi → baris pengeluaran ter-load ke form → klik Simpan → tersimpan ke DB.
3. Login sebagai PIC → tombol Import **tidak muncul** di Daily Recap; tombol Export tetap muncul.
4. Profit Loss → Export Rekap dan Export Detail menghasilkan dua file berbeda.
