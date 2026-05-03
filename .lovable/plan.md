## Tujuan
Outlet "Manajemen" hanya muncul sebagai opsi cabang di **3 tempat** saja:
1. **Data Karyawan** (`StaffManagement.tsx`) — agar admin bisa assign staff manajemen
2. **Profil Saya** (`Profile.tsx`) — tampil sebagai cabang user manajemen
3. **Rekapan Absensi** (`personalia/Attendance.tsx`) — agar absen staff manajemen tetap bisa direkap terpisah

Di **semua menu lain** (Dashboard, Absen Selfie, Finance, Inventory, Performance Review, Settings, signup, dll) outlet "Manajemen" **disembunyikan** dari dropdown / filter / rekap, supaya rekapan per-cabang tidak tercampur data manajemen.

## Pendekatan

Tambah opsi `includeManagement` pada hook `useOutlets` (default `false`). Hook menyaring outlet bernama `"Manajemen"` (case-insensitive) dari list kecuali dipanggil `useOutlets({ includeManagement: true })`. Auto-select juga akan melewati Manajemen.

Untuk fetch outlets langsung tanpa hook, tambahkan filter `.neq('name', 'Manajemen')`.

## Perubahan File

**Hook**
- `src/hooks/useOutlets.tsx` — tambah param `{ includeManagement?: boolean }`, filter "Manajemen" dari list & dari auto-select default.

**Sertakan Manajemen (pakai `includeManagement: true`)**
- `src/pages/StaffManagement.tsx`
- `src/pages/personalia/Attendance.tsx`
- `src/pages/Profile.tsx` — hanya jika ada dropdown outlet; kalau cuma display `outlet_name` tidak perlu diubah

**Sembunyikan Manajemen (default behavior, hanya verifikasi tidak pakai opsi include)**
- `src/pages/Dashboard.tsx` (juga: tambah `.neq('name','Manajemen')` pada fetch langsungnya)
- `src/pages/FinancialReport.tsx`
- `src/pages/finance/DailyRecap.tsx`
- `src/pages/finance/ProfitLoss.tsx`
- `src/pages/finance/Invoice.tsx`
- `src/pages/finance/NoteArchive.tsx`
- `src/pages/Inventory.tsx`
- `src/pages/inventory/ShoppingList.tsx`
- `src/pages/inventory/MaterialControl.tsx`
- `src/components/finance/FinanceStatsRecap.tsx`
- `src/components/finance/OutletReportRecap.tsx`
- `src/components/settings/AttendanceThresholdsTab.tsx`

**Fetch outlets langsung — tambah `.neq('name','Manajemen')`**
- `src/pages/Login.tsx` (signup form)
- `src/pages/personalia/CheckIn.tsx` (Absen Selfie)
- `src/pages/personalia/PerformanceReview.tsx`
- `src/pages/Dashboard.tsx`

**Tidak diubah**
- Bagian admin kelola outlet di `Attendance.tsx` (sekitar baris 1267) — perlu lihat semua outlet termasuk Manajemen.

## Catatan
- Filter berbasis nama persis `"Manajemen"`. Jika nama berubah, sesuaikan filter.
- Tidak menambah kolom DB baru, tidak mengubah RLS.
