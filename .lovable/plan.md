## Tujuan
Menghubungkan tab **Input Absensi** dengan **Log Absen Selfie** agar data kehadiran yang sudah di-submit lewat selfie (check-in/out) otomatis terisi di tabel Input Absensi — mengurangi input ganda dan menyamakan rekap.

## Cara kerja yang diusulkan

Saat tab **Input Absensi** memuat data untuk `tanggal + outlet`, sistem akan:
1. Tetap query `attendance` (data yang sudah pernah disimpan manual).
2. Tambah query `attendance_logs` untuk tanggal + outlet yang sama, ambil semua log selfie hari itu.
3. Untuk setiap karyawan, gabungkan log selfie-nya:
   - **Check-in paling awal** → dipakai untuk menentukan status `H` (Hadir) dan menghitung **Terlambat (menit)** otomatis berdasarkan `attendance_thresholds` shift karyawan (`getAttendanceStatus` yg sudah dipakai di tab Logs).
   - **Check-out paling akhir** → dicatat sebagai jam pulang (info di kolom keterangan).
4. Jika baris belum punya `existingId` di `attendance` dan ada log selfie → row di-prefill (tidak otomatis dirty, tapi ditandai "dari selfie") sehingga PIC tinggal verifikasi & klik **Simpan**.
5. Jika sudah ada record di `attendance` → tetap tampilkan badge kecil yang memberi tahu "ada X log selfie hari ini" + tombol "Sinkronkan dari selfie" untuk menimpa late_minutes & status berdasarkan log.

## Perubahan UI di tab Input Absensi
- Kolom **Status Kehadiran**: tambahkan ikon kecil 📷 di samping tombol H bila row punya log selfie.
- Kolom **Ket. Terlambat**: auto-prefill dengan teks `IN HH:mm · OUT HH:mm` (dari selfie) jika kosong.
- Tombol baru di toolbar: **"Tarik dari Selfie"** — meng-apply hasil log selfie ke semua row outlet/tanggal terpilih sekaligus (status=H, late_minutes terhitung, keterangan jam IN/OUT).
- Tooltip pada baris yang sudah disinkronkan: tampilkan jumlah log dan jam IN/OUT terdeteksi.

## Detail teknis
File yang diubah: `src/pages/personalia/Attendance.tsx`

1. Tambah state `selfieLogsByUser: Record<string, AttendanceLog[]>`.
2. Di efek loader (sekitar baris 144–166), setelah query `attendance`, jalankan query paralel:
   ```ts
   supabase.from('attendance_logs')
     .select('id,user_id,log_type,created_at,outlet_id')
     .eq('outlet_id', selectedOutlet)
     .gte('created_at', `${date}T00:00:00`)
     .lte('created_at', `${date}T23:59:59`)
   ```
   Group by `user_id`.
3. Buat helper `deriveFromSelfie(logs, profile)` yang mengembalikan `{ status:'H', late_minutes, late_notes }` memakai `useAttendanceThresholds().resolve(outletId, shiftName)` + `getAttendanceStatus` (sudah tersedia & dipakai di tab Logs).
4. Saat membangun `map` row: jika tidak ada `rec` di `attendance` tapi ada logs → pakai hasil `deriveFromSelfie` sebagai default (dirty=false, tandai `fromSelfie:true`).
5. Tambah tombol "Tarik dari Selfie": iterasi `outletProfiles`, untuk yang punya logs panggil `updateRow` dengan hasil derive (set dirty=true).
6. Tambah indikator visual (ikon kecil + tooltip jumlah log).
7. Tidak ada perubahan skema DB. Tidak ada perubahan RLS (PIC sudah punya akses `attendance_logs` outletnya).

## Yang TIDAK diubah
- Tab Log Absen Selfie tetap seperti sekarang (filter All/IN/OUT yg sudah ditambahkan).
- Karyawan dengan status I/S/C/L/T tetap diinput manual (selfie hanya menyentuh status H).
- Tidak otomatis menyimpan ke DB — PIC tetap menekan "Simpan Absensi" untuk konfirmasi.
