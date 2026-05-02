## Perubahan Logika Rekomendasi Belanja

Mengubah rumus target stok ideal pada halaman **Stok & Inventaris → Rekomendasi Belanja** (`src/pages/inventory/ShoppingList.tsx`).

### Sebelum
```
needed = max(minimum_threshold × 2 − ending_stock, 0)
```
Target ideal = 2× (200%) dari stok minimum.

### Sesudah
```
target_ideal = ceil(minimum_threshold × 1.3)
needed = max(target_ideal − ending_stock, 0)
```
Target ideal = 130% dari stok minimum (30% di atas minimum), dibulatkan ke atas agar tidak menghasilkan angka pecahan.

### Contoh Perhitungan
| Min. Threshold | Stok Sisa | Target Ideal (×1.3) | Rekomendasi Beli |
|---|---|---|---|
| 5  | 2  | 7   | 5  |
| 10 | 4  | 13  | 9  |
| 20 | 15 | 26  | 11 |
| 8  | 8  | 11  | 3  |

### File yang Diubah
- `src/pages/inventory/ShoppingList.tsx` — ubah perhitungan `needed` dari `× 2` menjadi `Math.ceil(× 1.3)`.

### Tidak Berubah
- Kondisi munculnya item (`ending_stock ≤ minimum_threshold`) tetap sama.
- Default `minimum_threshold = 5` jika kosong, tetap sama.
- Tampilan tabel & ekspor CSV tetap sama (kolom Rekomendasi Beli otomatis ikut update).
