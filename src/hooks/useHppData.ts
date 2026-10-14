import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { baseUnitInfo, validateProduct, type Material, type Product } from '@/lib/hpp/calculations';

export interface HppData { materials: Material[]; products: Product[]; fixedCost: number }
export function validateWorkspace(data: HppData): HppData {
  if (!Array.isArray(data.materials) || !Array.isArray(data.products) || !Number.isFinite(data.fixedCost) || data.fixedCost < 0) throw new Error('Data HPP tidak valid.');
  const materials = data.materials.map(m => ({ ...m, ...baseUnitInfo(m.buyUnit, m.buyPrice, m.buyQty) }));
  data.products.forEach(p => validateProduct(p, materials));
  return { ...data, materials };
}

export function useHppData(_userId: string) {
  const [data, setData] = useState<HppData>({ materials: [], products: [], fixedCost: 8000000 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const version = useRef<number | null>(null);
  const busy = useRef(false);
  const fetchId = useRef(0);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    const requestId = ++fetchId.current;
    try {
      const { data: row, error: failure } = await supabase.from('hpp_workspaces').select('*').eq('id', 1).single();
      if (requestId !== fetchId.current || busy.current) return;
      if (failure || !row) throw new Error('Data HPP bersama tidak dapat dimuat. Coba lagi.');
      const parsed = validateWorkspace({ materials: row.materials as unknown as Material[], products: row.products as unknown as Product[], fixedCost: Number(row.fixed_cost) });
      version.current = row.version;
      setData(parsed);
      setError('');
    } catch (e) { if (requestId === fetchId.current) setError(e instanceof Error ? e.message : 'Data HPP tidak dapat dimuat.'); }
    finally { if (requestId === fetchId.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000);
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); fetchId.current++; };
  }, [refresh]);
  const save = async (next: HppData) => {
    if (busy.current || version.current === null) return false;
    busy.current = true;
    fetchId.current++;
    setSaving(true);
    let conflict = false;
    try {
      const parsed = validateWorkspace(next);
      const { data: row, error: failure } = await supabase.from('hpp_workspaces').update({
        materials: JSON.parse(JSON.stringify(parsed.materials)), products: JSON.parse(JSON.stringify(parsed.products)), fixed_cost: parsed.fixedCost,
      }).eq('id', 1).eq('version', version.current).select('*').maybeSingle();
      if (failure) throw failure;
      if (!row) { conflict = true; throw new Error('Data berubah oleh akun lain. Data terbaru dimuat; ulangi perubahan Anda.'); }
      version.current = row.version;
      setData(parsed);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Data HPP gagal disimpan. Periksa koneksi dan izin akun.');
      return false;
    } finally {
      busy.current = false;
      setSaving(false);
      if (conflict) void refresh();
    }
  };
  return { data, save, loading, saving, error, refresh };
}