import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import OutletSelector from '@/components/OutletSelector';
import { useOutlets } from '@/hooks/useOutlets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Beaker, Plus, Trash2 } from 'lucide-react';
import { CsvImportButton } from '@/components/CsvImportButton';
import { ExportButtons } from '@/components/ExportButtons';

interface IngredientRow {
  name: string;
  qty: string;
  unit: string;
}

interface OutletMaterial {
  id: string;
  outlet_id: string;
  name: string;
  unit: string;
  minimum_threshold: number;
}

interface InventoryRecord {
  id: string;
  item_name: string;
  starting_stock: number;
  incoming_stock: number;
  ending_stock: number;
  record_date: string;
  outlet_id: string | null;
}

const today = () => new Date().toISOString().split('T')[0];

export default function MaterialControlPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlets();
  const canEdit = role === 'admin' || role === 'management' || role === 'pic' || role === 'stockman';

  const [recipes, setRecipes] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [materials, setMaterials] = useState<OutletMaterial[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);

  // Recipe form
  const [menuItem, setMenuItem] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ name: '', qty: '', unit: 'gram' }]);
  const [portions, setPortions] = useState('1');

  // Sales form
  const [saleItem, setSaleItem] = useState('');
  const [qtySold, setQtySold] = useState('');
  const [saleDate, setSaleDate] = useState(today());
  const [submitting, setSubmitting] = useState(false);

  // Usage control filter
  const firstOfMonth = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  };
  const [usageStart, setUsageStart] = useState(firstOfMonth());
  const [usageEnd, setUsageEnd] = useState(today());

  const fetchData = async () => {
    const [{ data: r }, { data: s }, { data: m }, { data: inv }] = await Promise.all([
      supabase.from('recipes').select('*').order('menu_item_name'),
      supabase.from('daily_sales').select('*').order('sale_date', { ascending: false }).limit(500),
      selectedOutlet
        ? supabase.from('outlet_materials' as never).select('id, outlet_id, name, unit, minimum_threshold').eq('outlet_id', selectedOutlet).order('name')
        : Promise.resolve({ data: [] as any }),
      selectedOutlet
        ? supabase.from('inventory').select('*').eq('outlet_id', selectedOutlet).order('record_date', { ascending: false }).limit(2000)
        : Promise.resolve({ data: [] as any }),
    ]);
    if (r) setRecipes(r);
    if (s) setSales(s);
    setMaterials(((m as unknown as OutletMaterial[]) || []));
    setInventory(((inv as InventoryRecord[]) || []));
  };

  useEffect(() => { fetchData(); }, [selectedOutlet]);

  const materialNames = useMemo(() => Array.from(new Set(materials.map((m) => m.name))), [materials]);
  const materialUnitMap = useMemo(() => new Map(materials.map((m) => [m.name.toLowerCase(), m.unit])), [materials]);

  const handleRecipeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const ingredientsData = ingredients.filter(i => i.name.trim()).map(i => ({ name: i.name.trim(), qty: parseFloat(i.qty) || 0, unit: i.unit }));
    const { error } = await supabase.from('recipes').insert({
      menu_item_name: menuItem,
      outlet_id: selectedOutlet,
      ingredients: ingredientsData,
      portions: parseInt(portions) || 1,
    });
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Resep tersimpan.' });
      setMenuItem(''); setIngredients([{ name: '', qty: '', unit: 'gram' }]); setPortions('1');
      fetchData();
    }
    setSubmitting(false);
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from('daily_sales').insert({
      menu_item_name: saleItem,
      qty_sold: parseInt(qtySold) || 0,
      sale_date: saleDate,
      outlet_id: selectedOutlet,
      recorded_by: user.id,
    });
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Penjualan tercatat.' });
      setSaleItem(''); setQtySold('');
      fetchData();
    }
    setSubmitting(false);
  };

  const addIngredient = () => setIngredients([...ingredients, { name: '', qty: '', unit: 'gram' }]);
  const removeIngredient = (idx: number) => setIngredients(ingredients.filter((_, i) => i !== idx));
  const updateIngredient = (idx: number, field: keyof IngredientRow, value: string) => {
    const updated = [...ingredients];
    updated[idx][field] = value;
    // Auto-fill unit if name matches a known material
    if (field === 'name') {
      const u = materialUnitMap.get(value.trim().toLowerCase());
      if (u) updated[idx].unit = u;
    }
    setIngredients(updated);
  };

  const handleDeleteRecipe = async (id: string) => {
    const { error } = await supabase.from('recipes').delete().eq('id', id);
    if (error) toast({ title: 'Gagal hapus', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Resep dihapus' }); fetchData(); }
  };

  const handleDeleteSale = async (id: string) => {
    const { error } = await supabase.from('daily_sales').delete().eq('id', id);
    if (error) toast({ title: 'Gagal hapus', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Penjualan dihapus' }); fetchData(); }
  };

  // Calculate material usage: Estimasi (resep × penjualan) vs Aktual (awal+masuk-akhir) per material
  const calcUsage = () => {
    const recipeMap = new Map(recipes.map(r => [r.menu_item_name, r]));
    const result: Record<string, { estimasi: number; aktual: number; unit: string }> = {};

    // 1. Estimasi dari penjualan × resep (filter rentang tanggal & outlet)
    const filteredSales = sales.filter((s) => {
      if (selectedOutlet && s.outlet_id !== selectedOutlet) return false;
      return s.sale_date >= usageStart && s.sale_date <= usageEnd;
    });

    filteredSales.forEach(sale => {
      const recipe = recipeMap.get(sale.menu_item_name);
      if (!recipe) return;
      const ings = recipe.ingredients as { name: string; qty: number; unit: string }[];
      ings?.forEach(ing => {
        if (!result[ing.name]) result[ing.name] = { estimasi: 0, aktual: 0, unit: ing.unit };
        result[ing.name].estimasi += (ing.qty / (recipe.portions || 1)) * sale.qty_sold;
      });
    });

    // 2. Aktual dari inventory: jumlahkan (starting + incoming - ending) per item dalam rentang
    const filteredInv = inventory.filter((i) => i.record_date >= usageStart && i.record_date <= usageEnd);
    filteredInv.forEach((inv) => {
      const consumed = (Number(inv.starting_stock) || 0) + (Number(inv.incoming_stock) || 0) - (Number(inv.ending_stock) || 0);
      if (!result[inv.item_name]) {
        const u = materialUnitMap.get(inv.item_name.toLowerCase()) || '';
        result[inv.item_name] = { estimasi: 0, aktual: 0, unit: u };
      }
      result[inv.item_name].aktual += consumed;
    });

    // Pastikan semua bahan master tampil meski 0
    materials.forEach((m) => {
      if (!result[m.name]) result[m.name] = { estimasi: 0, aktual: 0, unit: m.unit };
    });

    return result;
  };

  const usage = calcUsage();

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
            <Beaker className="w-7 h-7" /> Kontrol Bahan Baku
          </h1>
          <OutletSelector outlets={outlets} selectedOutlet={selectedOutlet} onSelect={setSelectedOutlet} />
        </div>

        {!canEdit && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Mode lihat saja. Hanya admin, management, PIC, dan stockman yang dapat menambah resep / penjualan.
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="usage">
          <TabsList>
            <TabsTrigger value="usage">Kontrol Penggunaan</TabsTrigger>
            <TabsTrigger value="recipes">Resep</TabsTrigger>
            <TabsTrigger value="sales">Penjualan Harian</TabsTrigger>
          </TabsList>

          <TabsContent value="usage">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Estimasi vs Aktual Penggunaan Bahan</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Estimasi = (qty resep ÷ porsi) × jumlah menu terjual. Aktual = (Stok awal + Stok masuk) − Stok akhir. Selisih = Aktual − Estimasi (positif = waste / kebocoran).
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Dari Tanggal</Label>
                    <Input type="date" value={usageStart} onChange={(e) => setUsageStart(e.target.value)} className="w-40 h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sampai Tanggal</Label>
                    <Input type="date" value={usageEnd} onChange={(e) => setUsageEnd(e.target.value)} className="w-40 h-9" />
                  </div>
                </div>

                {Object.keys(usage).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada data. Pastikan ada bahan baku di Stok & Inventaris, resep, dan penjualan.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-muted-foreground">
                          <th className="p-3 font-medium">Bahan</th>
                          <th className="p-3 font-medium text-right">Estimasi</th>
                          <th className="p-3 font-medium text-right">Aktual</th>
                          <th className="p-3 font-medium text-right">Selisih</th>
                          <th className="p-3 font-medium">Satuan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(usage)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([name, data]) => {
                            const selisih = data.aktual - data.estimasi;
                            const selisihColor = Math.abs(selisih) < 0.01
                              ? 'text-muted-foreground'
                              : selisih > 0
                                ? 'text-destructive'
                                : 'text-success';
                            return (
                              <tr key={name} className="border-b border-border/50 hover:bg-muted/30">
                                <td className="p-3 font-medium">{name}</td>
                                <td className="p-3 text-right">{data.estimasi.toFixed(2)}</td>
                                <td className="p-3 text-right">{data.aktual.toFixed(2)}</td>
                                <td className={`p-3 text-right font-bold ${selisihColor}`}>
                                  {selisih > 0 ? '+' : ''}{selisih.toFixed(2)}
                                </td>
                                <td className="p-3">{data.unit}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recipes">
            {canEdit && (
              <Card className="glass-card mb-4">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-lg">Input Resep</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <CsvImportButton
                      entityLabel="Resep"
                      headers={['menu_item_name', 'portions', 'ingredient_name', 'qty', 'unit']}
                      templateFilename="template-resep"
                      sampleRows={[
                        ['Es Kopi Susu', 1, 'Kopi', 18, 'gram'],
                        ['Es Kopi Susu', 1, 'Susu', 150, 'ml'],
                        ['Es Kopi Susu', 1, 'Gula Aren', 30, 'ml'],
                        ['Nasi Goreng', 1, 'Beras', 200, 'gram'],
                        ['Nasi Goreng', 1, 'Telur', 1, 'butir'],
                      ]}
                      parseRow={(r) => {
                        const menu = (r.menu_item_name || '').trim();
                        const ingName = (r.ingredient_name || '').trim();
                        if (!menu) throw new Error('menu_item_name wajib diisi');
                        if (!ingName) throw new Error('ingredient_name wajib diisi');
                        const qty = Number(r.qty);
                        if (isNaN(qty) || qty <= 0) throw new Error('qty harus angka > 0');
                        const portions = Number(r.portions) || 1;
                        return { menu, portions, ingredient: { name: ingName, qty, unit: (r.unit || 'gram').trim() } };
                      }}
                      onImport={async (rows) => {
                        const grouped = new Map<string, { portions: number; ingredients: any[] }>();
                        rows.forEach((r) => {
                          if (!grouped.has(r.menu)) grouped.set(r.menu, { portions: r.portions, ingredients: [] });
                          grouped.get(r.menu)!.ingredients.push(r.ingredient);
                        });
                        const payload = Array.from(grouped.entries()).map(([menu, v]) => ({
                          menu_item_name: menu,
                          portions: v.portions,
                          ingredients: v.ingredients,
                          outlet_id: selectedOutlet,
                        }));
                        const { error } = await supabase.from('recipes').insert(payload);
                        if (error) return { success: 0, failed: payload.length, message: error.message };
                        return { success: payload.length, failed: 0, message: `${payload.length} resep dari ${rows.length} baris` };
                      }}
                      onImported={fetchData}
                      helperText="Format: 1 baris per ingredient. Baris dengan menu_item_name sama akan dijadikan 1 resep."
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {materials.length === 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-muted-foreground">
                      Belum ada master bahan baku untuk cabang ini. Tambahkan dulu di menu <strong>Stok & Inventaris → Kelola Bahan</strong> agar dropdown bahan terisi.
                    </div>
                  )}
                  <form onSubmit={handleRecipeSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nama Menu</Label>
                        <Input value={menuItem} onChange={(e) => setMenuItem(e.target.value)} placeholder="Contoh: Es Kopi Susu" required />
                      </div>
                      <div className="space-y-2">
                        <Label>Porsi per Resep</Label>
                        <Input type="number" value={portions} onChange={(e) => setPortions(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Bahan-bahan</Label>
                        <Button type="button" variant="outline" size="sm" onClick={addIngredient}><Plus className="w-3 h-3 mr-1" /> Bahan</Button>
                      </div>
                      <datalist id="material-name-list">
                        {materialNames.map((n) => <option key={n} value={n} />)}
                      </datalist>
                      {ingredients.map((ing, idx) => (
                        <div key={idx} className="flex gap-2 items-end">
                          <Input
                            list="material-name-list"
                            className="flex-1"
                            placeholder="Nama bahan (pilih dari master atau ketik manual)"
                            value={ing.name}
                            onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                          />
                          <Input className="w-24" type="number" step="0.01" placeholder="Qty" value={ing.qty} onChange={(e) => updateIngredient(idx, 'qty', e.target.value)} />
                          <Input className="w-24" placeholder="Satuan" value={ing.unit} onChange={(e) => updateIngredient(idx, 'unit', e.target.value)} />
                          {ingredients.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(idx)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button type="submit" disabled={submitting} className="w-full">Simpan Resep</Button>
                  </form>
                </CardContent>
              </Card>
            )}
            <Card className="glass-card">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg min-w-0 break-words">Daftar Resep ({recipes.length})</CardTitle>
                <ExportButtons
                  filename="daftar-resep"
                  title="Daftar Resep"
                  orientation="landscape"
                  columns={[
                    { header: 'Menu', accessor: 'menu_item_name' },
                    { header: 'Porsi', accessor: 'portions' },
                    { header: 'Bahan', accessor: (r: any) => (r.ingredients as any[] || []).map((i: any) => `${i.name} ${i.qty}${i.unit}`).join('; ') },
                  ]}
                  rows={recipes}
                />
              </CardHeader>
              <CardContent className="space-y-3">
                {recipes.map((r) => (
                  <div key={r.id} className="p-3 bg-muted/50 rounded-lg flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{r.menu_item_name} <span className="text-xs text-muted-foreground">({r.portions} porsi)</span></p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(r.ingredients as any[])?.map((ing: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{ing.name}: {ing.qty} {ing.unit}</Badge>
                        ))}
                      </div>
                    </div>
                    {canEdit && (
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteRecipe(r.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
                {recipes.length === 0 && <p className="text-sm text-muted-foreground">Belum ada resep.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sales">
            {canEdit && (
              <Card className="glass-card mb-4">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-lg">Input Penjualan Harian</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <CsvImportButton
                      entityLabel="Penjualan"
                      headers={['sale_date', 'menu_item_name', 'qty_sold']}
                      templateFilename="template-penjualan-harian"
                      sampleRows={[
                        [today(), 'Es Kopi Susu', 25],
                        [today(), 'Nasi Goreng', 12],
                      ]}
                      parseRow={(r) => {
                        const date = (r.sale_date || '').trim();
                        const menu = (r.menu_item_name || '').trim();
                        const qty = Number(r.qty_sold);
                        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('sale_date harus YYYY-MM-DD');
                        if (!menu) throw new Error('menu_item_name wajib diisi');
                        if (isNaN(qty) || qty <= 0) throw new Error('qty_sold harus angka > 0');
                        return { sale_date: date, menu_item_name: menu, qty_sold: qty };
                      }}
                      onImport={async (rows) => {
                        if (!user) return { success: 0, failed: rows.length, message: 'User tidak terautentikasi' };
                        const payload = rows.map((r) => ({ ...r, recorded_by: user.id, outlet_id: selectedOutlet }));
                        const { error } = await supabase.from('daily_sales').insert(payload);
                        if (error) return { success: 0, failed: rows.length, message: error.message };
                        return { success: rows.length, failed: 0 };
                      }}
                      onImported={fetchData}
                      helperText="Format: sale_date (YYYY-MM-DD), menu_item_name, qty_sold"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaleSubmit} className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                      <Label>Menu Item</Label>
                      {recipes.length > 0 ? (
                        <>
                          <Input
                            list="recipe-menu-list"
                            value={saleItem}
                            onChange={(e) => setSaleItem(e.target.value)}
                            placeholder="Pilih menu dari resep atau ketik manual"
                            required
                          />
                          <datalist id="recipe-menu-list">
                            {Array.from(new Set(recipes.map((r) => r.menu_item_name))).map((name) => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                          <p className="text-xs text-muted-foreground">
                            {recipes.length} resep tersedia. Pilih untuk sinkronisasi otomatis dengan estimasi bahan.
                          </p>
                        </>
                      ) : (
                        <Input value={saleItem} onChange={(e) => setSaleItem(e.target.value)} placeholder="Nama menu" required />
                      )}
                    </div>
                    <div className="w-24 space-y-2">
                      <Label>Jumlah</Label>
                      <Input type="number" value={qtySold} onChange={(e) => setQtySold(e.target.value)} required />
                    </div>
                    <div className="w-36 space-y-2">
                      <Label>Tanggal</Label>
                      <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" disabled={submitting}>Simpan</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
            <Card className="glass-card">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg min-w-0 break-words">Riwayat Penjualan</CardTitle>
                <ExportButtons
                  filename="riwayat-penjualan-menu"
                  title="Riwayat Penjualan Menu"
                  columns={[
                    { header: 'Tanggal', accessor: 'sale_date' },
                    { header: 'Menu', accessor: 'menu_item_name' },
                    { header: 'Terjual', accessor: 'qty_sold' },
                  ]}
                  rows={sales}
                />
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="p-3 font-medium">Tanggal</th>
                        <th className="p-3 font-medium">Menu</th>
                        <th className="p-3 font-medium">Terjual</th>
                        {canEdit && <th className="p-3 font-medium w-12"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map((s) => (
                        <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-3">{s.sale_date}</td>
                          <td className="p-3">{s.menu_item_name}</td>
                          <td className="p-3 font-bold">{s.qty_sold}</td>
                          {canEdit && (
                            <td className="p-3">
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteSale(s.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {sales.length === 0 && (
                        <tr><td colSpan={canEdit ? 4 : 3} className="p-8 text-center text-muted-foreground">Belum ada data penjualan.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
