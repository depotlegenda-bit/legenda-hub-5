import { useState } from 'react';
import { toast } from 'sonner';
import { SAMPLE_MATERIALS, SAMPLE_PRODUCTS } from '@/lib/hpp/sampleData';
import { baseUnitInfo, validateProduct, type Material, type Product } from '@/lib/hpp/calculations';

export function useHppData(userId: string) {
  const key = `hpp_workspace_v1_${userId}`;
  const [data, setData] = useState<{ materials: Material[]; products: Product[]; fixedCost: number }>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed.materials) || !Array.isArray(parsed.products)) throw new Error('Invalid data');
        parsed.materials.forEach((m: Material) => baseUnitInfo(m.buyUnit, m.buyPrice, m.buyQty));
        parsed.products.forEach((p: Product) => validateProduct(p, parsed.materials));
        return parsed;
      }
    } catch { toast.error('Data HPP lokal tidak dapat dibaca. Data contoh dimuat tanpa menimpa penyimpanan.'); }
    return { materials: SAMPLE_MATERIALS, products: SAMPLE_PRODUCTS, fixedCost: 8000000 };
  });
  const save = (next: typeof data) => {
    try { localStorage.setItem(key, JSON.stringify(next)); setData(next); return true; }
    catch { toast.error('Data tidak tersimpan. Penyimpanan perangkat penuh atau tidak tersedia.'); return false; }
  };
  return { data, save };
}