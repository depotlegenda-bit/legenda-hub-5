import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { baseUnitInfo, validateProduct, type Material, type Product } from '@/lib/hpp/calculations';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export function useHppData(outletId: string) {
  const [data, setData] = useState<{ materials: Material[]; products: Product[]; fixedCost: number }>({ materials: [], products: [], fixedCost: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const version = useRef<number | null>(null);
  const busy = useRef(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    version.current = null;
    setLoading(true);
    setError('');
    supabase.from('hpp_outlet_workspaces').select('*').eq('outlet_id', outletId).single().then(({ data: row, error: fetchError }) => {
      if (!active) return;
      try {
        if (fetchError || !row) throw new Error('Data HPP cabang tidak dapat dimuat.');
        const materials = row.materials as unknown as Material[];
        const products = row.products as unknown as Product[];
        if (!Array.isArray(materials) || !Array.isArray(products)) throw new Error('Data HPP tidak valid.');
        materials.forEach(m => baseUnitInfo(m.buyUnit, m.buyPrice, m.buyQty));
        products.forEach(p => validateProduct(p, materials));
        version.current = row.version;
        setData({ materials, products, fixedCost: Number(row.fixed_cost) });
      } catch (e) { setError(e instanceof Error ? e.message : 'Data tidak dapat dimuat.'); }
      setLoading(false);
    });
    return () => { active = false; };
  }, [outletId, reload]);
  const save = async (next: typeof data) => {
    if (loading || error || busy.current || version.current === null) return false;
    busy.current = true;
    setSaving(true);
    try {
      const { data: row, error: saveError } = await supabase.from('hpp_outlet_workspaces').update({
        materials: next.materials as unknown as Json, products: next.products as unknown as Json, fixed_cost: next.fixedCost,
      }).eq('outlet_id', outletId).eq('version', version.current).select('version').maybeSingle();
      if (saveError) throw saveError;
      if (!row) {
        toast.error('Data cabang telah berubah. Data terbaru dimuat; ulangi perubahan Anda.');
        setReload(n => n + 1);
        return false;
      }
      version.current = row.version;
      setData(next);
      return true;
    } catch { toast.error('Data HPP tidak tersimpan. Periksa koneksi atau izin Anda.'); return false; }
    finally { busy.current = false; setSaving(false); }
  };
  return { data, save, loading, saving, error, retry: () => setReload(n => n + 1) };
}