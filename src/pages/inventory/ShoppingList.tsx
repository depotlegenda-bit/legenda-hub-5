import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import OutletSelector from '@/components/OutletSelector';
import { useOutlets } from '@/hooks/useOutlets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart } from 'lucide-react';
import { ExportButtons } from '@/components/ExportButtons';

interface ShoppingItem {
  item_name: string;
  ending_stock: number;
  minimum_threshold: number;
  needed: number;
}

export default function ShoppingListPage() {
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlets();
  const [items, setItems] = useState<ShoppingItem[]>([]);

  const fetchData = async () => {
    let query = supabase.from('inventory').select('*').order('record_date', { ascending: false });
    if (selectedOutlet) query = query.eq('outlet_id', selectedOutlet);
    const { data } = await query;
    if (!data) return;

    const latestByItem = new Map<string, any>();
    data.forEach((row) => {
      if (!latestByItem.has(row.item_name)) latestByItem.set(row.item_name, row);
    });

    const needToBuy = Array.from(latestByItem.values())
      .filter((item) => (item.ending_stock ?? 0) <= (item.minimum_threshold ?? 5))
      .map((item) => {
        const minimum = item.minimum_threshold ?? 5;
        const ending = item.ending_stock ?? 0;
        const idealTarget = Math.ceil(minimum * 1.3);
        return {
          item_name: item.item_name,
          ending_stock: ending,
          minimum_threshold: minimum,
          needed: Math.max(idealTarget - ending, 0),
        };
      });

    setItems(needToBuy);
  };

  useEffect(() => { fetchData(); }, [selectedOutlet]);

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
