import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import OutletSelector from '@/components/OutletSelector';
import { useOutlets } from '@/hooks/useOutlets';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ShoppingCart, Settings2, ChevronDown } from 'lucide-react';
import { ExportButtons } from '@/components/ExportButtons';
import { toast } from '@/hooks/use-toast';

interface ShoppingItem {
  item_name: string;
  ending_stock: number;
  minimum_threshold: number;
  needed: number;
}

const DEFAULT_BUFFER_PERCENT = 30;

export default function ShoppingListPage() {
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlets();
  const { role } = useAuth();
  const isAdmin = role === 'admin' || role === 'management';
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [bufferPercent, setBufferPercent] = useState<number>(DEFAULT_BUFFER_PERCENT);
  const [bufferInput, setBufferInput] = useState<string>(String(DEFAULT_BUFFER_PERCENT));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingBuffer, setSavingBuffer] = useState(false);
  const [loadingBuffer, setLoadingBuffer] = useState(false);

  const selectedOutletName = outlets.find((o) => o.id === selectedOutlet)?.name ?? 'Semua Cabang';

  // Load buffer percent for current outlet (or global if none selected)
  const fetchBuffer = async () => {
    setLoadingBuffer(true);
    let query = supabase
      .from('shopping_buffer_settings' as any)
      .select('buffer_percent');
    query = selectedOutlet
      ? query.eq('outlet_id', selectedOutlet)
      : query.is('outlet_id', null);
    const { data } = await query.maybeSingle();
    const value = (data as any)?.buffer_percent;
    const n = value != null ? Number(value) : DEFAULT_BUFFER_PERCENT;
    const safe = Number.isFinite(n) && n >= 0 ? n : DEFAULT_BUFFER_PERCENT;
    setBufferPercent(safe);
    setBufferInput(String(safe));
    setLoadingBuffer(false);
  };

  const fetchData = async (percent: number) => {
    let query = supabase.from('inventory').select('*').order('record_date', { ascending: false });
    if (selectedOutlet) query = query.eq('outlet_id', selectedOutlet);
    const { data } = await query;
    if (!data) return;

    const latestByItem = new Map<string, any>();
    data.forEach((row) => {
      if (!latestByItem.has(row.item_name)) latestByItem.set(row.item_name, row);
    });

    const multiplier = 1 + percent / 100;
    const needToBuy = Array.from(latestByItem.values())
      .filter((item) => (item.ending_stock ?? 0) <= (item.minimum_threshold ?? 5))
      .map((item) => {
        const minimum = item.minimum_threshold ?? 5;
        const ending = item.ending_stock ?? 0;
        const idealTarget = Math.ceil(minimum * multiplier);
        return {
          item_name: item.item_name,
          ending_stock: ending,
          minimum_threshold: minimum,
          needed: Math.max(idealTarget - ending, 0),
        };
      });

    setItems(needToBuy);
  };

  useEffect(() => {
    fetchBuffer();
  }, [selectedOutlet]);

  useEffect(() => {
    fetchData(bufferPercent);
  }, [selectedOutlet, bufferPercent]);

  const handleSaveBuffer = async () => {
    const n = Number(bufferInput);
    if (!Number.isFinite(n) || n < 0 || n > 500) {
      toast({ title: 'Nilai tidak valid', description: 'Persentase harus antara 0 dan 500.', variant: 'destructive' });
      return;
    }
    setSavingBuffer(true);

    // Check if a row exists for this outlet (or global)
    let existQ = supabase.from('shopping_buffer_settings' as any).select('id');
    existQ = selectedOutlet ? existQ.eq('outlet_id', selectedOutlet) : existQ.is('outlet_id', null);
    const { data: existing } = await existQ.maybeSingle();

    let error: any = null;
    if ((existing as any)?.id) {
      const res = await supabase
        .from('shopping_buffer_settings' as any)
        .update({ buffer_percent: n })
        .eq('id', (existing as any).id);
      error = res.error;
    } else {
      const res = await supabase
        .from('shopping_buffer_settings' as any)
        .insert({ outlet_id: selectedOutlet ?? null, buffer_percent: n });
      error = res.error;
    }

    setSavingBuffer(false);
    if (error) {
      toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
      return;
    }
    setBufferPercent(n);
    toast({
      title: 'Tersimpan',
      description: `Target stok ideal untuk ${selectedOutletName} kini ${n}% di atas stok minimum.`,
    });
  };

  const handleResetBuffer = () => {
    setBufferInput(String(DEFAULT_BUFFER_PERCENT));
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
            <ShoppingCart className="w-7 h-7" /> Rekomendasi Belanja
          </h1>
          <div className="flex gap-2 items-center flex-wrap">
            <OutletSelector outlets={outlets} selectedOutlet={selectedOutlet} onSelect={setSelectedOutlet} />
            <ExportButtons
              filename="daftar-belanja"
              title="Daftar Belanja"
              columns={[
                { header: 'Bahan', accessor: 'item_name' },
                { header: 'Stok Sisa', accessor: 'ending_stock' },
                { header: 'Min. Threshold', accessor: 'minimum_threshold' },
                { header: 'Rekomendasi Beli', accessor: 'needed' },
              ]}
              rows={items}
            />
          </div>
        </div>

        {isAdmin && (
          <Card className="glass-card border-primary/30">
            <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors rounded-t-xl"
                >
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    <span className="font-semibold text-base">Pengaturan Admin — Target Stok Ideal</span>
                    <Badge variant="secondary" className="ml-2">{bufferPercent}%</Badge>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  <p className="text-sm text-muted-foreground">
                    Atur persentase batas atas di atas stok minimum untuk cabang{' '}
                    <strong>{selectedOutletName}</strong>. Rumus:{' '}
                    <strong>target ideal = stok minimum × (1 + persentase/100)</strong>.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                    <div className="flex-1">
                      <Label htmlFor="buffer-percent" className="text-xs">
                        Persentase di atas minimum (%) untuk {selectedOutletName}
                      </Label>
                      <Input
                        id="buffer-percent"
                        type="number"
                        min={0}
                        max={500}
                        step={1}
                        value={bufferInput}
                        onChange={(e) => setBufferInput(e.target.value)}
                        disabled={loadingBuffer || savingBuffer}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveBuffer} disabled={savingBuffer || loadingBuffer}>
                        {savingBuffer ? 'Menyimpan...' : 'Simpan'}
                      </Button>
                      <Button variant="outline" onClick={handleResetBuffer} disabled={savingBuffer}>
                        Reset
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pengaturan disimpan per cabang dan berlaku untuk seluruh pengguna. Pilih cabang lain di atas
                    untuk mengatur nilai berbeda.
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        )}

        {items.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Semua stok mencukupi! Tidak ada yang perlu dibeli.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Daftar Belanja Besok</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="p-3 font-medium">Bahan</th>
                      <th className="p-3 font-medium">Stok Sisa</th>
                      <th className="p-3 font-medium">Min. Threshold</th>
                      <th className="p-3 font-medium">Rekomendasi Beli</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.item_name} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3 font-medium">{item.item_name}</td>
                        <td className="p-3"><Badge variant="destructive">{item.ending_stock}</Badge></td>
                        <td className="p-3">{item.minimum_threshold}</td>
                        <td className="p-3 font-bold text-primary">{item.needed}</td>
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
