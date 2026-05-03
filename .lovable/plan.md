## Tujuan
Di halaman **Absen Selfie** (`CheckIn.tsx`), panel "5 Absen Terakhir" saat ini menampilkan log Check-In dan Check-Out tercampur, sehingga sulit dipakai untuk merekap. Tambahkan **filter cepat** untuk memilih hanya `IN`, hanya `OUT`, atau `Semua`.

## Pendekatan

Menambahkan toggle filter di header card "Absen Terakhir" — tidak perlu perubahan database, cukup state lokal + filter di sisi klien.

Agar filter tetap bermakna meski hanya 5 baris, naikkan jumlah fetch terakhir menjadi **20 log** (tetap `.limit(20)` di Supabase), lalu tampilkan maksimal 10 baris setelah difilter. Judul card disesuaikan menjadi "Riwayat Absen Terakhir".

## Perubahan File

**`src/pages/personalia/CheckIn.tsx`**
- Tambah state `logFilter: 'all' | 'check_in' | 'check_out'` (default `'all'`).
- Naikkan `limit(5)` → `limit(20)` saat fetch `attendance_logs`.
- Tambah grup tombol filter (Semua / IN / OUT) di `CardHeader` panel log, menggunakan komponen `Button` dengan variant `default`/`outline` (selaras dengan toggle Check-In/Check-Out di form submit).
- Filter array `recentLogs` sebelum `.map()` berdasarkan `logFilter`, lalu `.slice(0, 10)`.
- Tampilkan info ringkas hitung: misal "Menampilkan X dari Y log" (kecil, di bawah filter) supaya jelas berapa yang tersaring.

## Tidak diubah
- Skema database, RLS, dan logika simpan absen.
- Halaman Rekap Absensi (`Attendance.tsx`) — itu sudah punya pemisahan tersendiri.

## Catatan
Filter berlaku hanya pada panel preview di halaman Absen Selfie milik user sendiri. Untuk rekap menyeluruh per outlet, pakai menu Rekap Absensi.