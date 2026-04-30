import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, FileText, PackagePlus, Save, ShoppingCart, Trash2 } from 'lucide-react';

import AppLayout from '@/components/AppLayout';
import OutletSelector from '@/components/OutletSelector';
import { CsvImportButton } from '@/components/CsvImportButton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useOutlets } from '@/hooks/useOutlets';
import { useTabParam } from '@/hooks/useTabParam';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface StockRow {
  item_name: string;
  unit: string;
  starting_stock: string;
  incoming_stock: string;
  ending_stock: string;
  minimum_threshold: string;
}

interface InventoryRecord {
  id: string;
  item_name: string;
  starting_stock: number;
  incoming_stock: number;
  ending_stock: number;
  minimum_threshold: number;
  record_date: string;
  outlet_id: string | null;
}

interface OutletMaterial {
  id: string;
  outlet_id: string;
  name: string;
  unit: string;
  minimum_threshold: number;
}

const defaultMaterialForm = {
  name: '',
  unit: 'pcs',
  minimum_threshold: '5',
};

export default function InventoryPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlets();
  const [activeTab, setActiveTab] = useTabParam('stock', 'inventoryTab');
  const [submitting, setSubmitting] = useState(false);
  const [materialsSubmitting, setMaterialsSubmitting] = useState(false);
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [materials, setMaterials] = useState<OutletMaterial[]>([]);
  const [materialForm, setMaterialForm] = useState(defaultMaterialForm);
  const [toBuyList, setToBuyList] = useState<InventoryRecord[]>([]);
  const [history, setHistory] = useState<InventoryRecord[]>([]);

  const canManage = role === 'management';
  const canEditMaterials = role === 'management' || role === 'pic' || role === 'stockman';
  const canViewAll = role === 'management' || role === 'pic' || role === 'stockman';

  const materialNameMap = useMemo(
    () => new Map(materials.map((material) => [material.name.trim().toLowerCase(), material])),
    [materials],
  );

  const outletMap = useMemo(() => new Map(outlets.map((outlet) => [outlet.id, outlet.name])), [outlets]);

  const updateRow = (idx: number, field: keyof StockRow, value: string) => {
    setRows((prev) => prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, [field]: value } : row)));
  };

  const updateMaterialDraft = (idx: number, field: keyof OutletMaterial, value: string | number) => {
    setMaterials((prev) => prev.map((material, materialIdx) => (
      materialIdx === idx ? { ...material, [field]: value } : material
    )));
  };

  const buildRowsFromMaterials = (nextMaterials: OutletMaterial[], inventoryData: InventoryRecord[]) => {
    const latestByItem = new Map<string, InventoryRecord>();
    const currentDateByItem = new Map<string, InventoryRecord>();

    inventoryData.forEach((row) => {
      if (!latestByItem.has(row.item_name)) latestByItem.set(row.item_name, row);
      if (row.record_date === recordDate && !currentDateByItem.has(row.item_name)) currentDateByItem.set(row.item_name, row);
    });

    const nextRows: StockRow[] = nextMaterials.map((material) => {
      const currentRecord = currentDateByItem.get(material.name);
      const latestRecord = latestByItem.get(material.name);

      return {
        item_name: material.name,
        unit: material.unit || 'pcs',
        starting_stock: String(currentRecord?.starting_stock ?? latestRecord?.ending_stock ?? ''),
        incoming_stock: String(currentRecord?.incoming_stock ?? ''),
        ending_stock: String(currentRecord?.ending_stock ?? ''),
        minimum_threshold: String(material.minimum_threshold ?? 0),
      };
    });

    const lowStockItems = nextMaterials
      .map((material) => {
        const latestRecord = latestByItem.get(material.name);
        return {
          id: latestRecord?.id ?? material.id,
          item_name: material.name,
          starting_stock: latestRecord?.starting_stock ?? 0,
          incoming_stock: latestRecord?.incoming_stock ?? 0,
          ending_stock: latestRecord?.ending_stock ?? 0,
          minimum_threshold: material.minimum_threshold ?? 0,
          record_date: latestRecord?.record_date ?? recordDate,
          outlet_id: material.outlet_id,
        } satisfies InventoryRecord;
      })
      .filter((item) => item.ending_stock <= item.minimum_threshold);

    setRows(nextRows);
    setToBuyList(lowStockItems);
    if (canViewAll) setHistory(inventoryData.slice(0, 100));
  };

  const fetchInventory = async () => {
    if (!user || !selectedOutlet) {
      setRows([]);
      setMaterials([]);
      setToBuyList([]);
      setHistory([]);
      return;
    }

    const [{ data: materialData, error: materialError }, { data: inventoryData, error: inventoryError }] = await Promise.all([
      supabase
        .from('outlet_materials' as never)
        .select('id, outlet_id, name, unit, minimum_threshold')
        .eq('outlet_id', selectedOutlet)
        .order('name'),
      supabase
        .from('inventory')
        .select('*')
        .eq('outlet_id', selectedOutlet)
        .order('record_date', { ascending: false }),
    ]);

    if (materialError) {
      toast({ title: 'Gagal memuat bahan', description: materialError.message, variant: 'destructive' });
      return;
    }

    if (inventoryError) {
      toast({ title: 'Gagal memuat stok', description: inventoryError.message, variant: 'destructive' });
      return;
    }

    const nextMaterials = ((materialData as unknown as OutletMaterial[]) || []).sort((a, b) => a.name.localeCompare(b.name));
    const nextInventory = ((inventoryData as InventoryRecord[] | null) || []);

    setMaterials(nextMaterials);
    buildRowsFromMaterials(nextMaterials, nextInventory);
  };

  useEffect(() => {
    fetchInventory();
  }, [user, selectedOutlet, recordDate, role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedOutlet) return;

    if (materials.length === 0) {
      toast({ title: 'Belum ada bahan', description: 'Tambahkan bahan baku terlebih dahulu di tab Kelola Bahan.', variant: 'destructive' });
      setActiveTab('materials');
      return;
    }

    setSubmitting(true);
    const payload = rows.map((row) => ({
      user_id: user.id,
      outlet_id: selectedOutlet,
      record_date: recordDate,
      item_name: row.item_name,
      starting_stock: Number(row.starting_stock) || 0,
      incoming_stock: Number(row.incoming_stock) || 0,
      ending_stock: Number(row.ending_stock) || 0,
      minimum_threshold: Number(row.minimum_threshold) || 0,
    }));

    const { error } = await supabase.from('inventory').insert(payload);

    if (error) {
      toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil!', description: 'Data stok tersimpan.' });
      await fetchInventory();
    }

    setSubmitting(false);
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutlet || !materialForm.name.trim()) return;

    setMaterialsSubmitting(true);
    const { error } = await supabase.from('outlet_materials' as never).insert({
      outlet_id: selectedOutlet,
      name: materialForm.name.trim(),
      unit: materialForm.unit.trim() || 'pcs',
      minimum_threshold: Number(materialForm.minimum_threshold) || 0,
      created_by: user?.id ?? null,
    } as never);

    if (error) {
      toast({ title: 'Gagal menambah bahan', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Bahan ditambahkan' });
      setMaterialForm(defaultMaterialForm);
      await fetchInventory();
    }

    setMaterialsSubmitting(false);
  };

  const handleUpdateMaterial = async (material: OutletMaterial) => {
    setMaterialsSubmitting(true);
    const { error } = await supabase
      .from('outlet_materials' as never)
      .update({
        name: material.name.trim(),
        unit: material.unit.trim() || 'pcs',
        minimum_threshold: Number(material.minimum_threshold) || 0,
      } as never)
      .eq('id', material.id);

    if (error) {
      toast({ title: 'Gagal menyimpan bahan', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Bahan diperbarui' });
      await fetchInventory();
    }

    setMaterialsSubmitting(false);
  };

  const handleDeleteMaterial = async (materialId: string) => {
    setMaterialsSubmitting(true);
    const { error } = await supabase.from('outlet_materials' as never).delete().eq('id', materialId);

    if (error) {
      toast({ title: 'Gagal menghapus bahan', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Bahan dihapus' });
      await fetchInventory();
    }

    setMaterialsSubmitting(false);
  };

  const handleDeleteInventory = async (id: string) => {
    const { error } = await supabase.from('inventory').delete().eq('id', id);
    if (error) {
      toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Data inventaris dihapus.' });
      fetchInventory();
    }
  };

  const handleExportCSV = async () => {
    const { data } = await supabase.from('inventory').select('*').order('record_date', { ascending: false });
    if (!data || data.length === 0) {
      toast({ title: 'Tidak ada data', variant: 'destructive' });
      return;
    }

    const headers = ['Tanggal', 'Cabang', 'Nama Item', 'Stok Awal', 'Masuk', 'Stok Akhir', 'Min Threshold'];
    const csvRows = [headers.join(',')];
    data.forEach((row) => {
      csvRows.push([
        row.record_date,
        `"${outletMap.get(row.outlet_id ?? '') || '-'}"`,
        `"${row.item_name}"`,
        row.starting_stock,
        row.incoming_stock,
        row.ending_stock,
        row.minimum_threshold,
      ].join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventaris-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = async () => {
    const { data } = await supabase.from('inventory').select('*').order('record_date', { ascending: false });
    if (!data || data.length === 0) {
      toast({ title: 'Tidak ada data', variant: 'destructive' });
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Laporan Inventaris - Dua Legenda', 14, 20);
    doc.setFontSize(10);
    doc.text(`Dicetak: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);
    autoTable(doc, {
      startY: 35,
      head: [['Tanggal', 'Cabang', 'Item', 'Stok Awal', 'Masuk', 'Stok Akhir', 'Threshold']],
      body: data.map((row) => [
        row.record_date,
        outletMap.get(row.outlet_id ?? '') || '-',
        row.item_name,
        row.starting_stock,
        row.incoming_stock,
        row.ending_stock,
        row.minimum_threshold,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 30, 30] },
    });
    doc.save(`inventaris-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-sans">Stok & Inventaris</h1>
            <p className="text-muted-foreground mt-1">Input stok bahan baku harian berdasarkan master bahan tiap cabang.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canManage && (
              <>
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="w-4 h-4 mr-1" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF}>
                  <FileText className="w-4 h-4 mr-1" /> PDF
                </Button>
              </>
            )}
          </div>
        </div>

        {toBuyList.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-warning" />
                Daftar Belanja (Stok Rendah)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {toBuyList.map((item) => (
                  <Badge key={item.item_name} variant="outline" className="border-warning text-warning">
                    {item.item_name} — sisa: {item.ending_stock}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="stock">Input Stok Harian</TabsTrigger>
            <TabsTrigger value="materials">Kelola Bahan</TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Card className="glass-card">
                <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="space-y-3">
                    <CardTitle className="text-lg">Input Stok Harian</CardTitle>
                    <OutletSelector outlets={outlets} selectedOutlet={selectedOutlet} onSelect={setSelectedOutlet} />
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Tanggal:</Label>
                      <Input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} className="w-40 h-8 text-sm" />
                    </div>
                  </div>

                  <div className="w-full md:w-auto">
                    <CsvImportButton
                      entityLabel="Stok Harian"
                      headers={['record_date', 'item_name', 'starting_stock', 'incoming_stock', 'ending_stock']}
                      templateFilename="template-stok-harian"
                      sampleRows={materials.slice(0, 3).map((material) => [recordDate, material.name, 0, 0, 0])}
                      parseRow={(row) => {
                        const date = (row.record_date || '').trim();
                        const name = (row.item_name || '').trim();
                        const material = materialNameMap.get(name.toLowerCase());
                        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('record_date harus YYYY-MM-DD');
                        if (!material) throw new Error('item_name harus sesuai daftar bahan pada cabang terpilih');
                        return {
                          record_date: date,
                          item_name: material.name,
                          starting_stock: Number(row.starting_stock) || 0,
                          incoming_stock: Number(row.incoming_stock) || 0,
                          ending_stock: Number(row.ending_stock) || 0,
                          minimum_threshold: material.minimum_threshold,
                        };
                      }}
                      onImport={async (importRows) => {
                        if (!user || !selectedOutlet) return { success: 0, failed: importRows.length, message: 'Pilih outlet terlebih dahulu' };
                        if (materials.length === 0) return { success: 0, failed: importRows.length, message: 'Belum ada bahan baku pada cabang ini' };
                        const payload = importRows.map((row) => ({ ...row, user_id: user.id, outlet_id: selectedOutlet }));
                        const { error } = await supabase.from('inventory').insert(payload);
                        if (error) return { success: 0, failed: importRows.length, message: error.message };
                        return { success: importRows.length, failed: 0 };
                      }}
                      onImported={fetchInventory}
                      helperText="Nama item harus mengikuti master bahan pada cabang yang sedang dipilih. Minimum threshold otomatis mengikuti master bahan."
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {materials.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Belum ada master bahan untuk cabang ini. Tambahkan dulu di tab Kelola Bahan.
                    </div>
                  ) : (
                    <>
                      <div className="hidden md:grid grid-cols-[2fr_120px_1fr_1fr_1fr] gap-3 px-1 text-xs font-medium text-muted-foreground">
                        <span>Nama Item</span>
                        <span>Satuan</span>
                        <span>Stok Awal</span>
                        <span>Masuk</span>
                        <span>Stok Akhir</span>
                      </div>
                       {rows.map((row, idx) => (
                         <div key={`${row.item_name}-${idx}`} className="grid grid-cols-1 md:grid-cols-[2fr_120px_1fr_1fr_1fr] gap-3 items-start rounded-lg border border-border/60 bg-muted/20 p-3">
                           <div className="space-y-1">
                             <Label className="text-xs md:hidden">Nama Item</Label>
                             <div className="flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm font-medium">
                               {row.item_name}
                             </div>
                             <p className="text-xs text-muted-foreground">Min. threshold: {row.minimum_threshold}</p>
                           </div>
                          <div className="space-y-1">
                            <Label className="text-xs md:hidden">Satuan</Label>
                            <div className="flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm">
                              {row.unit}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs md:hidden">Stok Awal</Label>
                            <Input type="number" placeholder="0" value={row.starting_stock} onChange={(e) => updateRow(idx, 'starting_stock', e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs md:hidden">Masuk</Label>
                            <Input type="number" placeholder="0" value={row.incoming_stock} onChange={(e) => updateRow(idx, 'incoming_stock', e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs md:hidden">Stok Akhir</Label>
                            <Input type="number" placeholder="0" value={row.ending_stock} onChange={(e) => updateRow(idx, 'ending_stock', e.target.value)} />
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
              <Button type="submit" className="w-full" disabled={submitting || materials.length === 0}>
                <Save className="w-4 h-4 mr-2" />
                {submitting ? 'Menyimpan...' : 'Simpan Stok'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="materials" className="space-y-4">
            <Card className="glass-card">
              <CardHeader className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="space-y-3">
                  <CardTitle className="text-lg">Kelola Bahan per Cabang</CardTitle>
                  <OutletSelector outlets={outlets} selectedOutlet={selectedOutlet} onSelect={setSelectedOutlet} />
                </div>
                <div className="w-full md:w-auto">
                  <CsvImportButton
                    entityLabel="Bahan"
                    headers={['name', 'unit', 'minimum_threshold']}
                    templateFilename="template-bahan-baku"
                    sampleRows={[
                      ['Kopi Arabika', 'gram', 500],
                      ['Susu UHT', 'ml', 2000],
                    ]}
                    parseRow={(row) => {
                      const name = (row.name || '').trim();
                      if (!name) throw new Error('Kolom "name" wajib diisi');
                      const rawUnit = (row.unit || '').trim();
                      const rawThr = (row.minimum_threshold || '').toString().trim().replace(/\./g, '').replace(',', '.');
                      const thr = rawThr === '' ? 0 : Number(rawThr);
                      if (Number.isNaN(thr)) throw new Error(`minimum_threshold "${row.minimum_threshold}" bukan angka valid`);
                      return {
                        name,
                        unit: rawUnit || 'pcs',
                        minimum_threshold: thr,
                      };
                    }}
                    onImport={async (importRows) => {
                      if (!selectedOutlet) return { success: 0, failed: importRows.length, message: 'Pilih outlet terlebih dahulu' };

                      const dedupedRows = Array.from(new Map(importRows.map((row) => [row.name.toLowerCase(), row])).values());
                      let failed = 0;
                      const errors: string[] = [];

                      for (const row of dedupedRows) {
                        const existing = materialNameMap.get(row.name.toLowerCase());
                        if (existing) {
                          const { error } = await supabase
                            .from('outlet_materials' as never)
                            .update({
                              name: row.name,
                              unit: row.unit,
                              minimum_threshold: row.minimum_threshold,
                            } as never)
                            .eq('id', existing.id);
                          if (error) {
                            failed += 1;
                            errors.push(`${row.name}: ${error.message}`);
                          }
                          continue;
                        }

                        const { error } = await supabase.from('outlet_materials' as never).insert({
                          outlet_id: selectedOutlet,
                          name: row.name,
                          unit: row.unit,
                          minimum_threshold: row.minimum_threshold,
                          created_by: user?.id ?? null,
                        } as never);
                        if (error) {
                          failed += 1;
                          errors.push(`${row.name}: ${error.message}`);
                        }
                      }

                      await fetchInventory();
                      return {
                        success: dedupedRows.length - failed,
                        failed,
                        message: failed > 0 ? `Sebagian gagal: ${errors.slice(0, 3).join(' | ')}` : 'Bahan berhasil diimpor.',
                      };
                    }}
                    onImported={fetchInventory}
                    helperText="CSV bahan akan menambah bahan baru atau memperbarui threshold dan satuan bahan yang sudah ada pada cabang terpilih."
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleAddMaterial} className="grid grid-cols-1 md:grid-cols-[2fr_120px_160px_auto] gap-3 items-end">
                  <div className="space-y-2">
                    <Label>Nama Bahan</Label>
                    <Input
                      value={materialForm.name}
                      onChange={(e) => setMaterialForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Contoh: Gula Aren"
                      required
                      disabled={!canEditMaterials}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Satuan</Label>
                    <Input
                      value={materialForm.unit}
                      onChange={(e) => setMaterialForm((prev) => ({ ...prev, unit: e.target.value }))}
                      placeholder="pcs"
                      disabled={!canEditMaterials}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Min. Threshold</Label>
                    <Input
                      type="number"
                      value={materialForm.minimum_threshold}
                      onChange={(e) => setMaterialForm((prev) => ({ ...prev, minimum_threshold: e.target.value }))}
                      placeholder="0"
                      disabled={!canEditMaterials}
                    />
                  </div>
                  <Button type="submit" disabled={materialsSubmitting || !canEditMaterials}>
                    <PackagePlus className="w-4 h-4 mr-2" /> Tambah Bahan
                  </Button>
                </form>

                {materials.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Belum ada bahan baku pada cabang ini.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {materials.map((material, idx) => (
                      <div key={material.id} className="grid grid-cols-1 md:grid-cols-[2fr_120px_160px_auto_auto] gap-3 items-end rounded-lg border border-border/60 bg-muted/20 p-3">
                        <div className="space-y-2">
                          <Label>Nama Bahan</Label>
                          <Input value={material.name} onChange={(e) => updateMaterialDraft(idx, 'name', e.target.value)} disabled={!canEditMaterials} />
                        </div>
                        <div className="space-y-2">
                          <Label>Satuan</Label>
                          <Input value={material.unit} onChange={(e) => updateMaterialDraft(idx, 'unit', e.target.value)} disabled={!canEditMaterials} />
                        </div>
                        <div className="space-y-2">
                          <Label>Min. Threshold</Label>
                          <Input type="number" value={material.minimum_threshold} onChange={(e) => updateMaterialDraft(idx, 'minimum_threshold', Number(e.target.value) || 0)} disabled={!canEditMaterials} />
                        </div>
                        <Button type="button" variant="outline" onClick={() => handleUpdateMaterial(material)} disabled={!canEditMaterials || materialsSubmitting}>
                          <Save className="w-4 h-4 mr-2" /> Simpan
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={!canEditMaterials || materialsSubmitting}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus bahan</AlertDialogTitle>
                              <AlertDialogDescription>Yakin ingin menghapus bahan {material.name} dari cabang ini?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteMaterial(material.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Hapus
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {canViewAll && history.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Riwayat Inventaris</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="p-3 font-medium">Tanggal</th>
                      <th className="p-3 font-medium">Cabang</th>
                      <th className="p-3 font-medium">Item</th>
                      <th className="p-3 font-medium">Stok Akhir</th>
                      {canManage && <th className="p-3 font-medium">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3">{row.record_date}</td>
                        <td className="p-3">{outletMap.get(row.outlet_id ?? '') || '-'}</td>
                        <td className="p-3">{row.item_name}</td>
                        <td className="p-3">{row.ending_stock}</td>
                        {canManage && (
                          <td className="p-3">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Data</AlertDialogTitle>
                                  <AlertDialogDescription>Yakin ingin menghapus data {row.item_name} tanggal {row.record_date}?</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteInventory(row.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Hapus
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
