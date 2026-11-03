import { parseCSV } from '@/lib/csvImport';
import { baseUnitInfo, validateProduct, type Material, type Product } from './calculations';

export const MATERIAL_HEADER = ['Nama Bahan', 'Kategori', 'Harga Beli', 'Satuan Beli', 'Jumlah Pembelian'];
export const PRODUCT_HEADER = ['Nama Menu', 'Kategori', 'Target Margin (%)', 'Harga Jual (Rp)', 'Biaya Operasional (Rp)', 'Nama Bahan', 'Jumlah Bahan', 'Satuan Bahan'];
function number(value: string) {
  let text = value.trim().replace(/^Rp\.?\s*/i, '').replace(/\s/g, '');
  if (!text) return 0;
  // Currency uses Indonesian grouping; quantities also accept decimal dots.
  // With both separators, the rightmost separator is the decimal mark.
  if (text.includes(',') && text.includes('.')) {
    text = text.lastIndexOf(',') > text.lastIndexOf('.')
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '');
  } else if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '');
  } else {
    text = text.replace(',', '.');
  }
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(text)) throw new Error(`Angka tidak valid: "${value}".`);
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) throw new Error(`Angka tidak valid: ${value}`);
  return parsed;
}
function unit(value: string) {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, string> = { g: 'gram', gr: 'gram', kilogram: 'kg', l: 'liter', lt: 'liter', litre: 'liter', mililiter: 'ml', pc: 'pcs', buah: 'pcs', pak: 'pack' };
  return aliases[normalized] ?? normalized;
}
export function importHppCsv(text: string, mode: 'materials' | 'products', materials: Material[], products: Product[]) {
  const rows = parseCSV(text).map((cells, index) => ({ cells, line: index + 1 })).filter(row => row.cells.some(cell => cell.trim()));
  const headers = mode === 'materials' ? MATERIAL_HEADER : PRODUCT_HEADER;
  if (rows.length < 2 || headers.some((h, index) => rows[0].cells[index]?.trim().toLowerCase() !== h.toLowerCase())) throw new Error('Kolom CSV tidak sesuai template atau file kosong.');
  const newMaterials = [...materials]; const newProducts = [...products];
  const productMap = new Map<string, Product>();
  let count = 0;
  for (const { cells: row, line } of rows.slice(1)) {
    try {
      if (row.length !== headers.length) throw new Error(`Jumlah kolom harus ${headers.length}; ditemukan ${row.length}. Angka yang mengandung koma harus diapit tanda petik jika pemisah CSV adalah koma.`);
      const name = row[0]?.trim();
      if (!name) throw new Error('Nama wajib diisi.');
      if (mode === 'materials') {
        if (!row[2]?.trim() || !row[4]?.trim()) throw new Error('Harga dan jumlah pembelian wajib diisi.');
        const buyPrice = number(row[2]); const buyQty = number(row[4]); const buyUnit = unit(row[3]);
        if (buyPrice < 0) throw new Error(`Harga Beli tidak boleh negatif (terbaca: ${buyPrice}).`);
        if (buyQty <= 0) throw new Error(`Jumlah Pembelian harus lebih dari 0 (terbaca: ${buyQty}).`);
        if (!['kg', 'gram', 'liter', 'ml', 'pcs', 'pack'].includes(buyUnit)) throw new Error(`Satuan Beli "${row[3]}" tidak dikenali. Gunakan kg, gram, liter, ml, pcs, atau pack.`);
        const existingIndex = newMaterials.findIndex(m => m.name.toLowerCase() === name.toLowerCase());
        const info = baseUnitInfo(buyUnit, buyPrice, buyQty);
        const existing = newMaterials[existingIndex];
        if (existing && existing.baseUnit !== info.baseUnit && products.some(p => p.ingredients.some(i => i.materialId === existing.id))) throw new Error('Satuan bahan yang dipakai resep tidak boleh berubah jenis.');
        const material = { id: existing?.id ?? crypto.randomUUID(), name, category: row[1].trim() || 'Bahan Utama', buyPrice, buyQty, buyUnit, ...info };
        if (existingIndex >= 0) newMaterials[existingIndex] = material; else newMaterials.push(material);
        count++;
      } else {
        const key = name.toLowerCase();
        const config = { category: row[1].trim() || 'Makanan Utama', targetMargin: row[2]?.trim() ? number(row[2]) : 60, customSellingPrice: number(row[3] || ''), overheadCostPerUnit: number(row[4] || '') };
        let product = productMap.get(key);
        if (!product) {
          product = { id: products.find(p => p.name.toLowerCase() === key)?.id ?? crypto.randomUUID(), name, ...config, ingredients: [] };
          productMap.set(key, product);
        } else if (Object.entries(config).some(([field, value]) => product?.[field as keyof Product] !== value)) throw new Error('Kategori, margin, harga, dan operasional untuk menu yang sama harus konsisten.');
        const material = newMaterials.find(m => m.name.toLowerCase() === row[5]?.trim().toLowerCase());
        if (!material) throw new Error(`Bahan "${row[5] || ''}" belum ada; impor harga bahan terlebih dahulu.`);
        const qty = number(row[6] || '');
        if (qty <= 0) throw new Error(`Jumlah Bahan harus lebih dari 0 (terbaca: ${qty}).`);
        const ingredient = { materialId: material.id, qty, unit: unit(row[7] || '') || material.baseUnit };
        validateProduct({ ...product, ingredients: [ingredient] }, newMaterials);
        product.ingredients.push(ingredient);
      }
    } catch (error) { throw new Error(`Baris ${line}: ${error instanceof Error ? error.message : 'Data tidak valid.'}`); }
  }
  for (const product of productMap.values()) {
    validateProduct(product, newMaterials);
    const idx = newProducts.findIndex(p => p.id === product.id);
    if (idx >= 0) newProducts[idx] = product; else newProducts.push(product);
    count++;
  }
  return { materials: newMaterials, products: newProducts, count };
}
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}