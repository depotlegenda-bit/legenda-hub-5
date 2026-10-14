import { useState, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import HppTemplateDownload from './HppTemplateDownload';
import { baseUnitInfo, compatibleUnits, calculateHpp, validateProduct, rupiah, UNITS, type Material, type Product } from '@/lib/hpp/calculations';

export function Field({ title, children }: { title: string; children: ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">{title}{children}</label>;
}
export const selectClass = 'h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring';
export function SelectOptions({ options }: { options: string[] | readonly string[] }) { return <>{options.map(o => <option key={o} value={o}>{o}</option>)}</>; }

export function MaterialEditor({ material, materials, products, onSave, onClose, saving }: { material?: Material; materials: Material[]; products: Product[]; onSave: (m: Material) => Promise<boolean>; onClose: () => void; saving: boolean }) {
  const [form, setForm] = useState(material ?? { id: crypto.randomUUID(), name: '', category: 'Bahan Utama', buyUnit: 'kg', buyPrice: 0, buyQty: 1, baseUnit: 'gram', costPerBaseUnit: 0 });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>{material ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}</DialogTitle><DialogDescription>Harga bahan HPP</DialogDescription></DialogHeader>
    <HppTemplateDownload mode="materials" />
    <form className="space-y-4" onSubmit={async e => { e.preventDefault(); try {
      if (!form.name.trim()) throw new Error('Nama bahan wajib diisi.');
      if (materials.some(m => m.id !== form.id && m.name.toLowerCase() === form.name.trim().toLowerCase())) throw new Error('Nama bahan sudah ada.');
      const info = baseUnitInfo(form.buyUnit, form.buyPrice, form.buyQty);
      if (material && material.baseUnit !== info.baseUnit && products.some(p => p.ingredients.some(i => i.materialId === material.id))) throw new Error('Jenis satuan bahan yang dipakai resep tidak boleh berubah.');
      if (await onSave({ ...form, name: form.name.trim(), ...info })) onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menyimpan.'); } }}>
      <Field title="Nama Bahan Baku *"><Input autoFocus required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field>
      <Field title="Kategori"><select className={selectClass} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><SelectOptions options={['Bahan Utama', 'Bumbu & Rasa', 'Kemasan', 'Operasional', 'Lainnya']} /></select></Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field title="Harga Beli Total (Rp) *"><Input type="number" min="0" step="any" required value={form.buyPrice} onChange={e => setForm({ ...form, buyPrice: Number(e.target.value) })} /></Field><Field title="Satuan Beli"><select className={selectClass} value={form.buyUnit} onChange={e => setForm({ ...form, buyUnit: e.target.value })}><SelectOptions options={UNITS} /></select></Field></div>
      <Field title="Jumlah Pembelian *"><Input type="number" min="0.001" step="any" required value={form.buyQty} onChange={e => setForm({ ...form, buyQty: Number(e.target.value) })} /></Field>
      {form.buyQty > 0 && <p className="text-sm text-primary">Modal: {rupiah(baseUnitInfo(form.buyUnit, form.buyPrice >= 0 ? form.buyPrice : 0, form.buyQty).costPerBaseUnit)} / {form.buyUnit === 'kg' ? 'gram' : form.buyUnit === 'liter' ? 'ml' : form.buyUnit}</p>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Bahan'}</Button></div>
    </form></DialogContent></Dialog>;
}

export function ProductEditor({ product, products, materials, onSave, onClose, saving }: { product?: Product; products: Product[]; materials: Material[]; onSave: (p: Product) => Promise<boolean>; onClose: () => void; saving: boolean }) {
  const [form, setForm] = useState<Product>(product ? { ...product, ingredients: product.ingredients.map(i => ({ ...i })) } : { id: crypto.randomUUID(), name: '', category: 'Makanan Utama', targetMargin: 60, customSellingPrice: 0, overheadCostPerUnit: 0, ingredients: [] });
  const update = (index: number, values: Partial<Product['ingredients'][number]>) => setForm({ ...form, ingredients: form.ingredients.map((i, idx) => idx === index ? { ...i, ...values } : i) });
  let total = 0;
  try { total = calculateHpp(form, materials).totalHPP; } catch { /* Incomplete ingredient rows */ }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{product ? 'Edit Resep & HPP Menu' : 'Buat Resep Menu Baru'}</DialogTitle><DialogDescription>Komposisi per porsi</DialogDescription></DialogHeader>
    <HppTemplateDownload mode="products" />
    <form className="space-y-5" onSubmit={async e => { e.preventDefault(); try {
      validateProduct(form, materials);
      if (products.some(p => p.id !== form.id && p.name.toLowerCase() === form.name.trim().toLowerCase())) throw new Error('Nama menu sudah ada.');
      if (await onSave({ ...form, name: form.name.trim() })) onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Gagal menyimpan.'); } }}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Field title="Nama Menu Produk *"><Input autoFocus required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field><Field title="Kategori Menu"><select className={selectClass} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><SelectOptions options={['Makanan Utama', 'Minuman', 'Cemilan / Dessert', 'Paket']} /></select></Field></div>
      <section className="space-y-3 border-y py-4"><div className="flex items-center justify-between gap-3"><h3 className="text-base font-semibold">Komposisi Resep</h3><Button type="button" size="sm" variant="secondary" disabled={!materials.length} onClick={() => { const first = materials[0]; if (first) setForm({ ...form, ingredients: [...form.ingredients, { materialId: first.id, qty: 1, unit: first.baseUnit }] }); }}><Plus />Tambah Bahan</Button></div>
      {!form.ingredients.length && <p className="py-4 text-center text-sm text-muted-foreground">Belum ada bahan</p>}
      {form.ingredients.map((ingredient, index) => { const material = materials.find(m => m.id === ingredient.materialId); return <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_90px_90px_36px]">
        <Field title={`Bahan ${index + 1}`}><select aria-label={`Bahan ${index + 1}`} className={selectClass} value={ingredient.materialId} onChange={e => { const selected = materials.find(m => m.id === e.target.value); if (selected) update(index, { materialId: selected.id, unit: selected.baseUnit }); }}><>{materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</></select></Field>
        <Field title="Takaran"><Input aria-label={`Takaran ${index + 1}`} required type="number" min="0.001" step="any" value={ingredient.qty} onChange={e => update(index, { qty: Number(e.target.value) })} /></Field>
        <Field title="Satuan"><select aria-label={`Satuan ${index + 1}`} className={selectClass} value={ingredient.unit} onChange={e => update(index, { unit: e.target.value })}><SelectOptions options={compatibleUnits(material?.baseUnit ?? 'gram')} /></select></Field>
        <Button aria-label={`Hapus bahan ${index + 1}`} title="Hapus bahan" type="button" size="icon" variant="ghost" onClick={() => setForm({ ...form, ingredients: form.ingredients.filter((_, i) => i !== index) })}><Trash2 className="text-destructive" /></Button>
      </div>; })}</section>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field title="Operasional per Porsi (Rp)"><Input type="number" min="0" step="any" value={form.overheadCostPerUnit} onChange={e => setForm({ ...form, overheadCostPerUnit: Number(e.target.value) })} /></Field>
        <Field title="Target Margin (%)"><Input required type="number" min="0" max="99.99" step="any" value={form.targetMargin} onChange={e => setForm({ ...form, targetMargin: Number(e.target.value) })} /></Field>
        <Field title="Harga Jual Aktual (Rp)"><Input type="number" min="0" step="any" value={form.customSellingPrice} onChange={e => setForm({ ...form, customSellingPrice: Number(e.target.value) })} /></Field>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><span className="font-semibold">HPP / porsi: <span className="text-primary">{rupiah(total)}</span></span><div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan Resep'}</Button></div></div>
    </form></DialogContent></Dialog>;
}