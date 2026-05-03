# Template CSV Resep yang Lebih Mudah Dipahami

## Konteks Saat Ini

Template CSV resep di **Kontrol Bahan Baku → Resep** sekarang punya format:

```text
menu_item_name, portions, ingredient_name, qty, unit
Es Kopi Susu,   1,        Kopi,            18,  gram
Es Kopi Susu,   1,        Susu,            150, ml
Es Kopi Susu,   1,        Gula Aren,       30,  ml
Nasi Goreng,    1,        Beras,           200, gram
Nasi Goreng,    1,        Telur,           1,   butir
```

Masalah untuk menu dengan banyak bahan:
- Nama menu & porsi harus diulang di setiap baris (rawan typo → menu jadi pecah dua resep berbeda).
- Tidak ada keterangan kolom / contoh / nomor bahan, pengguna bingung urutan.
- Tidak ada baris pemisah antar menu, sulit dibaca di Excel saat menu punya 10+ bahan.

## Usulan Perbaikan

Tetap pakai format **1 baris per ingredient** (paling kompatibel dengan parser yang ada), tapi buat template jauh lebih ramah:

### 1. Tambah kolom opsional `catatan` & header lebih deskriptif
Header baru (urutan tetap, parser tetap pakai key lowercase):

```text
menu_item_name, portions, ingredient_name, qty, unit, catatan
```

- `catatan` opsional (diabaikan parser, hanya untuk pengguna). Berguna untuk tulis "bahan utama", "topping", dll.

### 2. Sample rows lebih kaya & realistis
Ganti contoh dengan 2 menu: 1 menu kopi sederhana + 1 menu makanan dengan banyak bahan, supaya pola "ulang nama menu" terlihat jelas.

```text
menu_item_name, portions, ingredient_name, qty, unit, catatan
Es Kopi Susu,   1,        Espresso,         18,  gram, bahan utama
Es Kopi Susu,   1,        Susu Full Cream,  150, ml,
Es Kopi Susu,   1,        Gula Aren Cair,   30,  ml,
Es Kopi Susu,   1,        Es Batu,          80,  gram, garnish
,               ,         ,                 ,    ,     --- pemisah antar menu (baris kosong, abaikan) ---
Nasi Goreng Spesial, 1,   Beras (matang),   200, gram, bahan utama
Nasi Goreng Spesial, 1,   Telur Ayam,       1,   butir,
Nasi Goreng Spesial, 1,   Bawang Merah,     10,  gram, bumbu
Nasi Goreng Spesial, 1,   Bawang Putih,     5,   gram, bumbu
Nasi Goreng Spesial, 1,   Cabai Rawit,      5,   gram, bumbu
Nasi Goreng Spesial, 1,   Kecap Manis,      15,  ml,   bumbu
Nasi Goreng Spesial, 1,   Minyak Goreng,    10,  ml,
Nasi Goreng Spesial, 1,   Ayam Suwir,       50,  gram, topping
Nasi Goreng Spesial, 1,   Daun Bawang,      5,   gram, garnish
```

Aturan yang dijelaskan ke pengguna lewat dialog:
- 1 baris = 1 bahan.
- Semua baris dengan `menu_item_name` sama digabung jadi 1 resep otomatis.
- `portions` cukup ditulis sama di tiap baris menu yang sama (parser ambil dari baris pertama).
- Baris kosong total akan diabaikan (boleh dipakai sebagai pemisah visual antar menu).

### 3. Helper text & dialog preview lebih informatif
- Update `helperText` di tombol import jadi panduan ringkas multi-baris (tampilkan aturan di atas).
- Di `parseRow`, lewati baris yang seluruh kolomnya kosong (supaya pemisah visual aman).
- Validasi tambahan: peringatkan kalau `portions` di baris-baris dengan menu sama tidak konsisten (pakai nilai pertama, tampilkan warning di dialog preview).

### 4. Tambah panduan singkat di UI (di samping tombol Import CSV)
Tooltip / teks kecil: "Format: 1 baris per bahan. Ulang nama menu di setiap bahannya. Lihat baris contoh di template."

## Detail Teknis

File yang disentuh:
- `src/pages/inventory/MaterialControl.tsx`
  - Tambah `'catatan'` ke `headers` & `sampleRows` (template).
  - Perluas `sampleRows` jadi contoh menu dengan banyak bahan (minimal 8 ingredient).
  - Update `parseRow`: skip baris kosong (`!menu && !ingName && !r.qty` → `return null`-style → lempar `Error('__SKIP__')` lalu filter di luar). Karena `CsvImportButton` tidak punya mekanisme skip, cara paling simpel: di `parseRow` lempar error khusus, tetapi itu masuk ke `invalid`. **Solusi yang lebih bersih**: tambahkan dukungan skip di `CsvImportButton` — jika `parseRow` mengembalikan `undefined`, baris di-skip (bukan error, bukan valid). Perubahan kecil & backward compatible.
  - Update `helperText` jadi panduan multi-baris.
- `src/components/CsvImportButton.tsx`
  - Ubah signature `parseRow` agar boleh return `undefined` → baris diabaikan (tidak masuk valid maupun invalid).
  - Tampilkan jumlah baris diabaikan di dialog preview (kecil, opsional).

Tidak ada perubahan database / RLS.

## Hasil Akhir untuk Pengguna

- Saat klik **Template CSV** di Resep, file yang diunduh sudah berisi 2 contoh menu lengkap (termasuk menu dengan 9 bahan) + kolom `catatan` untuk anotasi.
- Saat import, baris kosong sebagai pemisah visual antar menu tidak dianggap error.
- Helper text & contoh membuat pengguna langsung paham pola "ulang nama menu di tiap baris bahan".
