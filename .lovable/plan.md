## Penyebab Error

Tabel `attendance_thresholds` masih memiliki dua unique index lama dari versi sebelumnya (saat tiap cabang hanya boleh punya 1 baris pengaturan):

- `attendance_thresholds_outlet_unique` — unik pada `outlet_id` saja
- `attendance_thresholds_global_unique` — unik untuk baris global (outlet_id NULL)

Setelah fitur multi-shift ditambahkan, index baru yang benar sudah dibuat berdasarkan kombinasi `(outlet_id, shift_name)`:
- `uniq_attendance_thresholds_outlet_shift`
- `uniq_attendance_thresholds_global_shift`

Tapi index lama tidak pernah di-drop, jadi saat user menyimpan shift kedua untuk cabang yang sama (atau shift global kedua), database menolak dengan error `duplicate key value violates unique constraint "attendance_thresholds_outlet_unique"`.

## Perbaikan

Buat satu migration SQL untuk menghapus dua index lama tersebut:

```sql
DROP INDEX IF EXISTS public.attendance_thresholds_outlet_unique;
DROP INDEX IF EXISTS public.attendance_thresholds_global_unique;
```

Setelah itu:
- Tiap cabang bisa punya banyak shift (mis. Pagi, Siang, Malam) dengan nama shift berbeda.
- Pengaturan global juga bisa punya banyak shift.
- Duplikat tetap dicegah oleh index baru bila kombinasi `(outlet_id, shift_name)` sama.

Tidak ada perubahan kode frontend — hook `useAttendanceThresholds` dan tab `AttendanceThresholdsTab` sudah benar menggunakan `shift_name`.
