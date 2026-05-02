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
import { ShoppingCart, Settings2 } from 'lucide-react';
import { ExportButtons } from '@/components/ExportButtons';
import { toast } from '@/hooks/use-toast';

interface ShoppingItem {
  item_name: string;
  ending_stock: number;
  minimum_threshold: number;
  needed: number;
}

const BUFFER_STORAGE_KEY = 'dl-shopping-buffer-percent-v1';
const DEFAULT_BUFFER_PERCENT = 30;

function loadBufferPercent(): number {
  if (typeof window === 'undefined') return DEFAULT_BUFFER_PERCENT;
  const raw = localStorage.getItem(BUFFER_STORAGE_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_BUFFER_PERCENT;
}

export default function ShoppingListPage() {
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlets();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [bufferPercent, setBufferPercent] = useState<number>(loadBufferPercent);
  const [bufferInput, setBufferInput] = useState<string>(String(loadBufferPercent()));

  const fetchData = async () => {
    let query = supabase.from('inventory').select('*').order('record_date', { ascending: false });
    if (selectedOutlet) query = query.eq('outlet_id', selectedOutlet);
    const { data } = await query;
    if (!data) return;

    const latestByItem = new Map<string, any>();
    data.forEach((row) => {
      if (!latestByItem.has(row.item_name)) latestByItem.set(row.item_name, row);
    });

    const multiplier = 1 + bufferPercent / 100;
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

  useEffect(() => { fetchData(); }, [selectedOutlet, bufferPercent]);

  const handleSaveBuffer = () => {
    const n = Number(bufferInput);
    if (!Number.isFinite(n) || n < 0 || n > 500) {
      toast({ title: 'Nilai tidak valid', description: 'Persentase harus antara 0 dan 500.', variant: 'destructive' });
      return;
    }
    localStorage.setItem(BUFFER_STORAGE_KEY, String(n));
    setBufferPercent(n);
    toast({ title: 'Tersimpan', description: `Target stok ideal kini ${n}% di atas stok minimum.` });
  };

  const handleResetBuffer = () => {
    localStorage.setItem(BUFFER_STORAGE_KEY, String(DEFAULT_BUFFER_PERCENT));
    setBufferPercent(DEFAULT_BUFFER_PERCENT);
    setBufferInput(String(DEFAULT_BUFFER_PERCENT));
    toast({ title: 'Direset', description: `Kembali ke default ${DEFAULT_BUFFER_PERCENT}%.` });
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
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="w-4 h-4" /> Pengaturan Admin — Target Stok Ideal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Atur persentase batas atas di atas stok minimum. Rumus: <strong>target ideal = stok minimum × (1 + persentase/100)</strong>.
                Saat ini: <strong>{bufferPercent}%</strong>.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <Label htmlFor="buffer-percent" className="text-xs">Persentase di atas minimum (%)</Label>
                  <Input
                    id="buffer-percent"
                    type="number"
                    min={0}
                    max={500}
                    step={1}
                    value={bufferInput}
                    onChange={(e) => setBufferInput(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveBuffer}>Simpan</Button>
                  <Button variant="outline" onClick={handleResetBuffer}>Reset</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Catatan: pengaturan ini disimpan lokal pada perangkat ini.
              </p>
            </CardContent>
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
