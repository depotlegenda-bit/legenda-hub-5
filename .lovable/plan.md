## Tujuan

Memudahkan pengisian **akun L/R** di halaman Laporan Laba Rugi (`/finance/profit-loss`) untuk item pengeluaran yang masih **"Belum Diassign"**, lewat alur:

1. **Export CSV** semua item Belum Diassign pada periode/outlet aktif
2. User isi kolom `category` di Excel/Google Sheets
3. **Import CSV** untuk update massal kategori ke DB

Tidak menambah item pengeluaran baru — hanya meng-assign kategori untuk item yang sudah ada (input item baru tetap lewat Daily Recap supaya konsisten dengan laporan harian).

---

## 1. Perubahan di `src/pages/finance/ProfitLoss.tsx`

### A. Tombol baru di section "Belum Diassign" (Tab Input Akun)

Di header section `Belum Diassign` (sekitar baris 370-380), tambahkan **dua tombol** di sebelah kanan judul, **hanya tampil jika** `role === 'admin' || role === 'management'`:

- **`📥 Export CSV (untuk diisi)`** — download CSV item Belum Diassign saat ini
- **`📤 Import Kategori CSV`** — buka dialog upload + preview + commit ke DB

Untuk role lain (PIC), section tetap bisa di-assign manual lewat dropdown seperti sekarang — tidak ada perubahan UX.

### B. Format CSV Export

**Filename:** `belum-diassign-{outlet}-{periode}.csv`

**Kolom (urut):**
| Kolom | Sumber | Catatan |
|---|---|---|
| `id` | `expense.id` | **WAJIB & jangan diubah** — kunci untuk update |
| `tanggal` | `report_date` | Read-only (info untuk user) |
| `outlet` | `outlet_name` | Read-only |
| `deskripsi` | `description` (item_name + tag transfer) | Read-only |
| `qty` | `qty` | Read-only |
| `unit_price` | `unit_price` | Read-only (angka) |
| `subtotal` | `amount` | Read-only (angka) |
| `category` | kosong | **Kolom yang user isi** |

Tambahkan baris pertama setelah header berisi catatan: `# JANGAN UBAH KOLOM 'id'. Isi kolom 'category' dengan nama akun L/R (lihat sheet/list akun di app).` — atau alternatif: simpan instruksi di filename + toast saja, supaya CSV tetap clean. **Pilihan default:** tidak ada baris instruksi (CSV bersih), instruksi muncul di toast saat download.

### C. Alur Import (komponen `CsvImportButton` reusable)

Pakai komponen `CsvImportButton<TParsed>` yang sudah ada di `src/components/CsvImportButton.tsx`:

- `entityLabel`: `"Assign Kategori"`
- `headers`: `['id', 'tanggal', 'outlet', 'deskripsi', 'qty', 'unit_price', 'subtotal', 'category']`
- `templateFilename`: `belum-diassign-template`
- `helperText`: *"Hanya kolom 'category' yang akan di-update. Item dengan kategori kosong dilewati."*

**`parseRow(row)` validasi:**
- `id` wajib UUID non-empty
- `category` wajib non-empty (kalau kosong → row di-skip dengan error "kategori kosong")
- `category` harus match (case-insensitive) salah satu dari `categories` (akun L/R) yang sudah ada di DB **ATAU** auto-create kategori baru jika belum ada (akan saya konfirmasi default ke validasi ketat — tolak jika tidak match, supaya tidak bikin akun L/R typo)

→ **Default plan:** **validasi ketat**. Jika kategori belum ada, baris masuk ke "invalid" dengan pesan `Akun "X" belum ada. Tambahkan di section "Kategori Akun L/R" dulu.`

**`onImport(rows)` aksi:**
- Loop tiap row → `supabase.from('finance_expense_items').update({ category: row.category }).eq('id', row.id)`
- Hitung `success` & `failed` berdasar response error per row
- Setelah selesai → panggil `fetchData()` supaya tabel refresh
- Toast: `"X item berhasil di-assign, Y gagal"`

### D. Hak akses (role gate)

```tsx
const { role } = useAuth();
const canBulkAssign = role === 'admin' || role === 'management';
```

Tombol Export/Import hanya render jika `canBulkAssign` true. RLS sudah aman:
- `Management full access finance_expense_items` (ALL) → bisa update
- `Admin full access finance_expense_items` (ALL) → bisa update
- PIC tidak punya UPDATE policy untuk `finance_expense_items` → tombol disembunyikan & secara DB juga akan ditolak

### E. UX tambahan

- Tombol Export disabled jika `unassignedGroups` kosong (toast: "Tidak ada item Belum Diassign")
- Toast saat download: *"File berisi {N} item. Isi kolom 'category' dengan nama akun L/R, lalu import balik."*
- Dialog preview (sudah built-in di `CsvImportButton`) menampilkan jumlah valid vs error sebelum commit

---

## 2. Tidak ada perubahan database

- Tidak ada migration baru
- RLS yang ada sudah cukup (Admin & Management bisa UPDATE `finance_expense_items`)
- Tidak menambah tabel/kolom baru
- Komponen `CsvImportButton`, `parseCSVtoObjects`, `exportToCSV`, `formatRpExport` semuanya sudah ada — tinggal dirangkai

---

## 3. File yang akan diubah

- `src/pages/finance/ProfitLoss.tsx` — tambah:
  - Import `CsvImportButton`, `exportToCSV`, `useAuth`
  - Helper `handleExportUnassigned()` & `handleImportCategories(rows)`
  - Render dua tombol baru di header section "Belum Diassign" (gated by role)

## 4. Yang TIDAK diubah

- Tidak menambah fitur "import item pengeluaran baru" (sengaja, supaya data Profit Loss tetap sinkron dengan Daily Recap)
- Tidak mengubah tampilan/fungsi section "Sudah Diassign" maupun tab "Laporan L/R"
- Tidak mengubah RLS policies, schema, atau komponen reusable

---

## 5. Testing manual setelah implementasi

1. Login sebagai **admin** → buka `/finance/profit-loss` → tab "Input Akun" → cek section "Belum Diassign"
2. Klik **Export CSV (untuk diisi)** → file ter-download dengan kolom `id, tanggal, outlet, deskripsi, qty, unit_price, subtotal, category`
3. Buka di Excel → isi kolom `category` untuk beberapa baris → save sebagai CSV
4. Klik **Import Kategori CSV** → upload file → preview muncul (X valid, Y error)
5. Konfirmasi → loading → toast sukses → tabel refresh → item yang sudah diisi pindah ke section "Sudah Diassign"
6. Test edge cases:
   - CSV dengan `category` kosong → masuk ke "invalid" dengan pesan jelas
   - CSV dengan kategori tidak ada di list akun L/R → masuk ke "invalid"
   - CSV dengan `id` tidak valid (item sudah dihapus) → update gagal, dihitung sebagai `failed`
7. Login sebagai **PIC** → tombol Export & Import **tidak muncul**, dropdown manual tetap berfungsi
8. Login sebagai **management** → tombol muncul & berfungsi sama seperti admin
