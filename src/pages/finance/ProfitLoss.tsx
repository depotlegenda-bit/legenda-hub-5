import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import OutletSelector from '@/components/OutletSelector';
import { useOutlets } from '@/hooks/useOutlets';
import { useTabParam } from '@/hooks/useTabParam';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Download, Save, Plus, X, ChevronDown, ChevronRight } from 'lucide-react';
import { format, endOfMonth, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ReportSection from '@/components/finance/ReportSection';
import { ExportButtons } from '@/components/ExportButtons';
import { CsvImportButton } from '@/components/CsvImportButton';
import { exportToCSV, formatRpExport } from '@/lib/exportUtils';
import { useAuth } from '@/hooks/useAuth';

interface ExpenseRow {
  id: string;
  description: string;
  amount: number;
  qty: number;
  unit_price: number;
  category: string | null;
  report_id: string;
}

interface ReportGroup {
  report_id: string;
  report_date: string;
  outlet_id: string | null;
  outlet_name: string;
  created_at: string;
  expenses: ExpenseRow[];
  income: number;
}

interface PLCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

export default function ProfitLossPage() {
  const { toast } = useToast();
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlets();
  const [mainTab, setMainTab] = useTabParam('input');
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [incomeData, setIncomeData] = useState({ offline: 0, online: 0 });
  const [reportGroups, setReportGroups] = useState<ReportGroup[]>([]);
  const [categories, setCategories] = useState<PLCategory[]>([]);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [inputOutletFilter, setInputOutletFilter] = useState<string>('all');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [balancingRows, setBalancingRows] = useState<{ id: string; label: string; amount: number }[]>([
    { id: '1', label: 'Kas Tunai Aktual', amount: 0 },
    { id: '2', label: 'Transfer Aktual', amount: 0 },
  ]);

  const fetchCategories = async () => {
    const { data } = await supabase.from('profit_loss_categories').select('*').order('type').order('name');
    setCategories((data as PLCategory[]) || []);
  };

  // Sum all numeric values from extra_fields jsonb (income fields stored per finance daily report)
  const sumIncome = (r: any): number => {
    let sum = (r.starting_cash || 0) + (r.cash_on_hand_added || 0);
    const extra = (r.extra_fields || {}) as Record<string, any>;
    Object.values(extra).forEach((v) => {
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n)) sum += n;
    });
    return sum;
  };

  const fetchData = async () => {
    const startDate = `${month}-01`;
    const endDate = format(endOfMonth(new Date(startDate)), 'yyyy-MM-dd');

    // Pull ALL finance daily reports for the month (used for both tabs)
    const { data: allReports } = await supabase
      .from('finance_daily_reports')
      .select('id, report_date, outlet_id, created_at, starting_cash, cash_on_hand_added, extra_fields')
      .gte('report_date', startDate)
      .lte('report_date', endDate)
      .order('report_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Income totals for L/R tab — only selected outlet
    let offline = 0, online = 0;
    (allReports || [])
      .filter((r: any) => !selectedOutlet || r.outlet_id === selectedOutlet)
      .forEach((r: any) => {
        const extra = (r.extra_fields || {}) as Record<string, any>;
        Object.entries(extra).forEach(([k, v]) => {
          const n = typeof v === 'number' ? v : Number(v);
          if (!Number.isFinite(n)) return;
          // Heuristic: keys containing "online" go to Online Food bucket, rest to Offline/Dine-in
          if (/online|grab|gofood|shopee/i.test(k)) online += n;
          else offline += n;
        });
      });
    setIncomeData({ offline, online });

    const outletMap = Object.fromEntries(outlets.map((o) => [o.id, o.name]));
    const groups: ReportGroup[] = (allReports || []).map((r: any) => ({
      report_id: r.id,
      report_date: r.report_date,
      outlet_id: r.outlet_id,
      outlet_name: r.outlet_id ? (outletMap[r.outlet_id] || 'Tanpa Outlet') : 'Tanpa Outlet',
      created_at: r.created_at,
      income: sumIncome(r),
      expenses: [],
    }));

    const reportIds = groups.map((g) => g.report_id);
    if (reportIds.length > 0) {
      const { data: expenses } = await supabase
        .from('finance_expense_items')
        .select('id, item_name, subtotal, qty, unit_price, category, report_id, payment_type')
        .in('report_id', reportIds);
      const expByReport: Record<string, ExpenseRow[]> = {};
      (expenses || []).forEach((e: any) => {
        const row: ExpenseRow = {
          id: e.id,
          description: e.item_name + (e.payment_type === 'transfer' ? ' (Transfer)' : ''),
          amount: e.subtotal || 0,
          qty: e.qty || 1,
          unit_price: e.unit_price || 0,
          category: e.category,
          report_id: e.report_id,
        };
        (expByReport[e.report_id] ||= []).push(row);
      });
      groups.forEach((g) => { g.expenses = expByReport[g.report_id] || []; });
    }
    setReportGroups(groups);
    setPendingChanges({});
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchData(); }, [month, selectedOutlet, outlets]);

  const handleCategoryChange = (id: string, category: string) => {
    setPendingChanges((prev) => ({ ...prev, [id]: category }));
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(pendingChanges);
    if (entries.length === 0) {
      toast({ title: 'Tidak ada perubahan' });
      return;
    }
    setSaving(true);
    try {
      for (const [id, category] of entries) {
        await supabase.from('finance_expense_items').update({ category }).eq('id', id);
      }
      toast({ title: 'Berhasil disimpan', description: `${entries.length} item diperbarui.` });
      await fetchData();
    } catch (e: any) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const { error } = await supabase
      .from('profit_loss_categories')
      .insert({ name: newCategoryName.trim(), type: 'expense' });
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Akun ditambahkan' });
      setNewCategoryName('');
      fetchCategories();
    }
  };

  // L/R tab uses its own outlet chip filter (independent from the L/R Card balancing)
  const [lrOutletFilter, setLrOutletFilter] = useState<string>('all');

  // Aggregations for LR tab — filtered by chip ('all' = all outlets)
  const lrGroups = useMemo(
    () => reportGroups.filter((g) => lrOutletFilter === 'all' || g.outlet_id === lrOutletFilter),
    [reportGroups, lrOutletFilter],
  );
  const lrExpenseRows = useMemo(() => lrGroups.flatMap((g) => g.expenses), [lrGroups]);
  const lrTotalIncome = useMemo(() => lrGroups.reduce((s, g) => s + g.income, 0), [lrGroups]);

  const totalIncome = lrTotalIncome;
  const expensesByCategory: Record<string, number> = {};
  let totalExpenses = 0;
  lrExpenseRows.forEach((row) => {
    const effective = pendingChanges[row.id] ?? row.category ?? 'Belum Dikategorikan';
    expensesByCategory[effective] = (expensesByCategory[effective] || 0) + row.amount;
    totalExpenses += row.amount;
  });
  const netProfit = totalIncome - totalExpenses;
  const formatRp = (v: number) => `Rp ${(v || 0).toLocaleString('id-ID')}`;
  const expenseCategories = categories.filter((c) => c.type === 'expense');

  // Filter groups for Input Akun tab by chip
  const filteredGroups = useMemo(
    () => reportGroups.filter((g) => inputOutletFilter === 'all' || g.outlet_id === inputOutletFilter),
    [reportGroups, inputOutletFilter],
  );

  const isRowAssigned = (row: ExpenseRow) => {
    const eff = pendingChanges[row.id] ?? row.category;
    return !!(eff && eff !== 'Lain-lain');
  };
  const isGroupFullyAssigned = (g: ReportGroup) =>
    g.expenses.length > 0 && g.expenses.every(isRowAssigned);

  const assignedGroups = filteredGroups.filter((g) => g.expenses.length > 0 && isGroupFullyAssigned(g));
  const unassignedGroups = filteredGroups.filter((g) => g.expenses.length === 0 || !isGroupFullyAssigned(g));
  const uncategorizedCount = reportGroups.flatMap((g) => g.expenses).filter((r) => !isRowAssigned(r)).length;

  const toggleGroup = (id: string) => setOpenGroups((p) => ({ ...p, [id]: !p[id] }));

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Laporan Laba Rugi - ${month}`, 14, 20);
    doc.setFontSize(10);
    doc.text(`Dicetak: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 28);

    autoTable(doc, {
      startY: 35,
      head: [['Kategori', 'Jumlah']],
      body: [
        ['PENDAPATAN USAHA', ''],
        ['  Penjualan Dine In / Offline', formatRp(incomeData.offline)],
        ['  Penjualan Online Food', formatRp(incomeData.online)],
        ['Total Pendapatan', formatRp(totalIncome)],
        ['', ''],
        ['BIAYA / PENGELUARAN', ''],
        ...Object.entries(expensesByCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([cat, amt]) => [`  ${cat}`, formatRp(amt)]),
        ['Total Pengeluaran', formatRp(totalExpenses)],
        ['', ''],
        ['LABA / RUGI BERSIH', formatRp(netProfit)],
      ],
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 30, 30] },
    });
    doc.save(`laba-rugi-${month}.pdf`);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
            <TrendingUp className="w-7 h-7" /> Laporan Laba Rugi
          </h1>
          <div className="flex flex-wrap gap-2 items-center">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
            <OutletSelector outlets={outlets} selectedOutlet={selectedOutlet} onSelect={setSelectedOutlet} />
            <ExportButtons
              filename={`laba-rugi-${month}`}
              title={`Laporan Laba Rugi - ${month}`}
              columns={[
                { header: 'Kategori', accessor: (r: any) => r.kategori },
                { header: 'Jumlah', accessor: (r: any) => r.jumlah },
              ]}
              rows={[
                { kategori: 'PENDAPATAN — Offline', jumlah: formatRpExport(incomeData.offline) },
                { kategori: 'PENDAPATAN — Online', jumlah: formatRpExport(incomeData.online) },
                { kategori: 'TOTAL PENDAPATAN', jumlah: formatRpExport(totalIncome) },
                ...Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => ({
                  kategori: `Pengeluaran — ${cat}`, jumlah: formatRpExport(amt),
                })),
                { kategori: 'TOTAL PENGELUARAN', jumlah: formatRpExport(totalExpenses) },
                { kategori: 'LABA / RUGI BERSIH', jumlah: formatRpExport(netProfit) },
              ]}
            />
            <ExportButtons
              filename={`laba-rugi-detail-${month}`}
              title={`Detail Pengeluaran Laba Rugi - ${month}`}
              subtitle={`${lrExpenseRows.length} item pengeluaran`}
              orientation="landscape"
              columns={[
                { header: 'Tanggal', accessor: (r: any) => r.tanggal },
                { header: 'Outlet', accessor: (r: any) => r.outlet },
                { header: 'Kategori', accessor: (r: any) => r.kategori },
                { header: 'Deskripsi', accessor: (r: any) => r.deskripsi },
                { header: 'Qty', accessor: (r: any) => r.qty },
                { header: 'Harga Satuan', accessor: (r: any) => r.harga },
                { header: 'Subtotal', accessor: (r: any) => r.subtotal },
              ]}
              rows={lrGroups.flatMap((g) =>
                g.expenses.map((row) => ({
                  tanggal: g.report_date,
                  outlet: g.outlet_name,
                  kategori: pendingChanges[row.id] ?? row.category ?? 'Belum Dikategorikan',
                  deskripsi: row.description,
                  qty: row.qty,
                  harga: formatRpExport(row.unit_price),
                  subtotal: formatRpExport(row.amount),
                }))
              )}
            />
          </div>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList className="grid w-full md:w-auto grid-cols-2">
            <TabsTrigger value="input">Input Akun {uncategorizedCount > 0 && `(${uncategorizedCount})`}</TabsTrigger>
            <TabsTrigger value="lr">Laporan L/R</TabsTrigger>
          </TabsList>

          {/* TAB 1: INPUT AKUN */}
          <TabsContent value="input" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base">Tambah Akun / Kategori Baru</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Input
                  placeholder="Nama akun (cth: Biaya Bahan Baku Ayam)"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Button onClick={handleAddCategory}>Tambah Akun</Button>
              </CardContent>
            </Card>

            {/* Outlet filter chips */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={inputOutletFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setInputOutletFilter('all')}
              >
                Semua
              </Button>
              {outlets.map((o) => (
                <Button
                  key={o.id}
                  size="sm"
                  variant={inputOutletFilter === o.id ? 'default' : 'outline'}
                  onClick={() => setInputOutletFilter(o.id)}
                >
                  {o.name}
                </Button>
              ))}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveAll} disabled={saving || Object.keys(pendingChanges).length === 0}>
                <Save className="w-4 h-4 mr-1" />
                {saving ? 'Menyimpan...' : `Simpan Perubahan (${Object.keys(pendingChanges).length})`}
              </Button>
            </div>

            {/* Section: Belum Diassign */}
            <ReportSection
              title="Belum Diassign"
              accent="warning"
              groups={unassignedGroups}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
              expenseCategories={expenseCategories}
              pendingChanges={pendingChanges}
              onCategoryChange={handleCategoryChange}
              formatRp={formatRp}
              defaultOpen
            />

            {/* Section: Akun Terisi */}
            <ReportSection
              title="Akun Terisi"
              accent="success"
              groups={assignedGroups}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
              expenseCategories={expenseCategories}
              pendingChanges={pendingChanges}
              onCategoryChange={handleCategoryChange}
              formatRp={formatRp}
            />

            {filteredGroups.length === 0 && (
              <Card className="glass-card">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  Belum ada laporan harian pada periode & cabang ini.
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* TAB 2: LAPORAN L/R */}
          <TabsContent value="lr" className="space-y-4">
            {/* Outlet filter chips — same style as Input Akun tab */}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={lrOutletFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setLrOutletFilter('all')}
              >
                Semua
              </Button>
              {outlets.map((o) => (
                <Button
                  key={o.id}
                  size="sm"
                  variant={lrOutletFilter === o.id ? 'default' : 'outline'}
                  onClick={() => setLrOutletFilter(o.id)}
                >
                  {o.name}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
              {/* Tabel Laba Rugi */}
              <Card className="overflow-hidden glass-card border-0 p-0">
                <div className="bg-destructive text-destructive-foreground py-4 text-center">
                  <h2 className="text-lg font-bold">Laporan Laba Rugi</h2>
                  <p className="text-xs opacity-90">
                    Per {format(new Date(`${month}-01`), 'MMMM yyyy', { locale: localeId })}
                  </p>
                </div>
                <div className="divide-y">
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-primary">
                    <span>Total Pendapatan</span>
                    <span>{formatRp(totalIncome)}</span>
                  </div>
                  {Object.entries(expensesByCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amt]) => {
                      const pct = totalIncome > 0 ? (amt / totalIncome) * 100 : 0;
                      const isUncategorized = cat === 'Belum Dikategorikan';
                      return (
                        <div
                          key={cat}
                          className={`grid grid-cols-[1fr_auto_60px] items-center px-4 py-2.5 gap-3 ${
                            isUncategorized ? 'bg-yellow-500/10' : ''
                          }`}
                        >
                          <span className="text-sm text-destructive/90">{cat}</span>
                          <span className="text-sm text-destructive/90 text-right">{formatRp(amt)}</span>
                          <span className="text-xs text-muted-foreground text-right">
                            {pct.toFixed(2).replace('.', ',')}%
                          </span>
                        </div>
                      );
                    })}
                  <div className="grid grid-cols-[1fr_auto_60px] items-center px-4 py-2.5 gap-3 text-sm font-semibold text-destructive">
                    <span>Total Pengeluaran</span>
                    <span className="text-right">{formatRp(totalExpenses)}</span>
                    <span className="text-xs text-right">
                      {(totalIncome > 0 ? (totalExpenses / totalIncome) * 100 : 0).toFixed(2).replace('.', ',')}%
                    </span>
                  </div>
                  <div
                    className={`grid grid-cols-[1fr_auto_60px] items-center px-4 py-3 gap-3 text-sm font-bold ${
                      netProfit >= 0 ? 'bg-green-500/30 text-foreground' : 'bg-destructive/20 text-destructive'
                    }`}
                  >
                    <span>Laba Bersih</span>
                    <span className="text-right">{formatRp(netProfit)}</span>
                    <span className="text-xs text-right">
                      {(totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0).toFixed(2).replace('.', ',')}%
                    </span>
                  </div>
                </div>
              </Card>

              {/* Panel Balancing */}
              <Card className="glass-card h-fit">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">BALANCING</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <span className="text-sm text-muted-foreground">Laba Bersih Sistem</span>
                    <span className="font-semibold text-primary">{formatRp(netProfit)}</span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_24px] gap-2 text-xs uppercase text-muted-foreground">
                    <span>Keterangan</span>
                    <span className="text-right pr-1">Nominal</span>
                    <span></span>
                  </div>
                  {balancingRows.map((row, idx) => (
                    <div key={row.id} className="grid grid-cols-[1fr_auto_24px] gap-2 items-center">
                      <Input
                        value={row.label}
                        onChange={(e) => {
                          const next = [...balancingRows];
                          next[idx] = { ...row, label: e.target.value };
                          setBalancingRows(next);
                        }}
                        className="h-9 text-sm"
                      />
                      <Input
                        type="number"
                        value={row.amount || ''}
                        onChange={(e) => {
                          const next = [...balancingRows];
                          next[idx] = { ...row, amount: Number(e.target.value) || 0 };
                          setBalancingRows(next);
                        }}
                        className="h-9 text-sm w-32 text-right"
                        placeholder="Rp"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setBalancingRows(balancingRows.filter((r) => r.id !== row.id))}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-dashed"
                    onClick={() =>
                      setBalancingRows([
                        ...balancingRows,
                        { id: Date.now().toString(), label: '', amount: 0 },
                      ])
                    }
                  >
                    <Plus className="w-4 h-4 mr-1" /> Tambah baris
                  </Button>

                  {(() => {
                    const totalActual = balancingRows.reduce((s, r) => s + (r.amount || 0), 0);
                    const selisih = totalActual - netProfit;
                    return (
                      <>
                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-sm font-semibold">Total Aktual</span>
                          <span className="font-bold">{formatRp(totalActual)}</span>
                        </div>
                        <div
                          className={`flex justify-between items-center p-3 rounded-md ${
                            selisih === 0
                              ? 'bg-primary/10 text-primary'
                              : 'bg-destructive/10 text-destructive'
                          }`}
                        >
                          <span className="text-sm font-semibold">Selisih</span>
                          <span className="font-bold">{formatRp(selisih)}</span>
                        </div>
                        {selisih !== 0 && (
                          <p className="text-xs text-muted-foreground text-center">
                            {selisih > 0
                              ? 'Kas aktual LEBIH dari laba sistem'
                              : 'Kas aktual KURANG dari laba sistem'}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
