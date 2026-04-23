import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { useOutlets } from '@/hooks/useOutlets';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Plus, Save, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  DEFAULT_CONFIG,
  evalSelisih,
  type OutletFinanceConfig,
} from '@/lib/financeConfig';
import FinanceStatsRecap from '@/components/finance/FinanceStatsRecap';
import { useTabParam } from '@/hooks/useTabParam';
import { MoneyInput } from '@/components/MoneyInput';
import { usePersistentDraft } from '@/hooks/usePersistentDraft';

type PaymentType = 'cash' | 'transfer';

interface ExpenseLine {
  id: string;
  payment_type: PaymentType;
  item_name: string;
  unit_price: number;
  qty: number;
}

const newLine = (payment_type: PaymentType): ExpenseLine => ({
  id: crypto.randomUUID(),
  payment_type,
  item_name: '',
  unit_price: 0,
  qty: 0,
});

const formatRp = (v: number) => `Rp ${(v || 0).toLocaleString('id-ID')}`;
const createIncomeValuesFromConfig = (config: OutletFinanceConfig) => {
  const init: Record<string, number> = {};
  config.income_fields.forEach((field) => {
    init[field.key] = 0;
  });
  (config.pair_groups || []).forEach((group) => {
    group.platforms.forEach((platform) => {
      init[`${group.left_prefix}_${platform.key}`] = 0;
      init[`${group.right_prefix}_${platform.key}`] = 0;
    });
  });
  return init;
};

const createDailyRecapDraft = () => ({
  activeOutlet: '',
  reportDate: new Date().toISOString().split('T')[0],
  reporterName: '',
  incomeValues: {} as Record<string, number>,
  notes: '',
  lines: [newLine('cash')],
  expenseTab: 'cash' as PaymentType,
});

export default function DailyRecapPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { outlets, loading: outletsLoading } = useOutlets();
  const [mainTab, setMainTab] = useTabParam('input');
  const [submitting, setSubmitting] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [configs, setConfigs] = useState<Record<string, OutletFinanceConfig>>({});

  const canManage = role === 'admin' || role === 'management' || role === 'pic';

  // form state
  const dailyDraft = usePersistentDraft('draft:daily-recap-v1', createDailyRecapDraft());
  const [activeOutlet, setActiveOutlet] = useState<string>(dailyDraft.value.activeOutlet);
  const [reportDate, setReportDate] = useState(dailyDraft.value.reportDate);
  const [reporterName, setReporterName] = useState(dailyDraft.value.reporterName);
  const [incomeValues, setIncomeValues] = useState<Record<string, number>>(dailyDraft.value.incomeValues);
  const [notes, setNotes] = useState(dailyDraft.value.notes);
  const [lines, setLines] = useState<ExpenseLine[]>(dailyDraft.value.lines.length ? dailyDraft.value.lines : [newLine('cash')]);
  const [expenseTab, setExpenseTab] = useState<PaymentType>(dailyDraft.value.expenseTab);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const initialDraftRef = useRef(dailyDraft.value);
  const hadStoredDraftRef = useRef(dailyDraft.hasStoredValue);
  const restoredIncomeOutletRef = useRef<string | null>(null);
  const previousOutletRef = useRef(dailyDraft.value.activeOutlet);

  // Resolve current outlet config (fallback to default)
  const activeConfig: OutletFinanceConfig = useMemo(() => {
    const c = configs[activeOutlet];
    return c ?? { outlet_id: activeOutlet, ...DEFAULT_CONFIG };
  }, [configs, activeOutlet]);

  // Load all configs once outlets known
  useEffect(() => {
    if (outlets.length === 0) return;
    supabase
      .from('outlet_finance_configs')
      .select('*')
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, OutletFinanceConfig> = {};
        data.forEach((row: any) => {
          map[row.outlet_id] = {
            outlet_id: row.outlet_id,
            income_fields: row.income_fields || [],
            pair_groups: row.pair_groups || [],
            summary_groups: row.summary_groups || [],
            selisih_formula: row.selisih_formula || '',
            selisih_inline_label: row.selisih_inline_label || '',
          };
        });
        setConfigs(map);
      });
  }, [outlets]);

  useEffect(() => {
    if (!activeOutlet && outlets.length > 0) setActiveOutlet(outlets[0].id);
  }, [outlets, activeOutlet]);

  // Reset income values when outlet (config) changes
  useEffect(() => {
    if (!activeOutlet) return;

    const init = createIncomeValuesFromConfig(activeConfig);
    const outletChanged = previousOutletRef.current !== activeOutlet;
    const shouldRestoreStoredIncome =
      hadStoredDraftRef.current &&
      activeOutlet === initialDraftRef.current.activeOutlet &&
      restoredIncomeOutletRef.current !== activeOutlet;

    setIncomeValues((prev) => {
      if (shouldRestoreStoredIncome) {
        restoredIncomeOutletRef.current = activeOutlet;
        return { ...init, ...initialDraftRef.current.incomeValues };
      }

      if (outletChanged) {
        return init;
      }

      return { ...init, ...prev };
    });

    previousOutletRef.current = activeOutlet;
  }, [activeOutlet, activeConfig]);

  const fetchReports = async () => {
    if (!activeOutlet) return;
    const { data } = await supabase
      .from('finance_daily_reports')
      .select('*, finance_expense_items(*)')
      .eq('outlet_id', activeOutlet)
      .order('report_date', { ascending: false })
      .limit(100);
    if (data) setReports(data);
  };

  useEffect(() => { fetchReports(); }, [activeOutlet]);
  useEffect(() => {
    dailyDraft.setValue({ activeOutlet, reportDate, reporterName, incomeValues, notes, lines, expenseTab });
  }, [activeOutlet, expenseTab, incomeValues, lines, notes, reportDate, reporterName]);

  // computed
  const cashLines = lines.filter((l) => l.payment_type === 'cash');
  const transferLines = lines.filter((l) => l.payment_type === 'transfer');
  const totalCashExpense = cashLines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const totalTransferExpense = transferLines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const totalExpense = totalCashExpense + totalTransferExpense;

  const selisih = useMemo(() => {
    return evalSelisih(activeConfig.selisih_formula, {
      ...incomeValues,
      total_expense: totalExpense,
      total_cash_expense: totalCashExpense,
      total_transfer_expense: totalTransferExpense,
    });
  }, [activeConfig.selisih_formula, incomeValues, totalExpense, totalCashExpense, totalTransferExpense]);

  const sumGroup = (fieldKeys: string[] = []) =>
    fieldKeys.reduce((s, k) => s + (incomeValues[k] || 0), 0);

  const activeOutletName = useMemo(
    () => outlets.find((o) => o.id === activeOutlet)?.name || '',
    [outlets, activeOutlet]
  );

  const updateLine = (id: string, patch: Partial<ExpenseLine>) => {
    setLines((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l));
      // Auto-add baris baru jika baris terakhir di tab aktif sudah mulai diisi
      const lastInTab = [...next].reverse().find((l) => l.payment_type === expenseTab);
      if (lastInTab && lastInTab.id === id) {
        const hasContent = (patch.item_name?.trim() ?? lastInTab.item_name.trim()) !== ''
          || (patch.unit_price ?? lastInTab.unit_price) > 0
          || (patch.qty ?? lastInTab.qty) > 0;
        if (hasContent) next.push(newLine(expenseTab));
      }
      return next;
    });
  };
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));
  const addLine = () => setLines((prev) => [...prev, newLine(expenseTab)]);

  const resetForm = () => {
    setReportDate(new Date().toISOString().split('T')[0]);
    setReporterName('');
    setIncomeValues(createIncomeValuesFromConfig(activeConfig));
    setNotes('');
    setLines([newLine('cash')]);
    setExpenseTab('cash');
    hadStoredDraftRef.current = false;
    restoredIncomeOutletRef.current = null;
    previousOutletRef.current = activeOutlet;
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!activeOutlet) {
      toast({ title: 'Pilih cabang dulu', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    const { data: report, error } = await supabase
      .from('finance_daily_reports')
      .insert({
        user_id: user.id,
        outlet_id: activeOutlet,
        report_date: reportDate,
        reporter_name: reporterName,
        starting_cash: incomeValues['cash_start'] || 0,
        cash_on_hand_added: incomeValues['cash_added'] || 0,
        notes,
        extra_fields: incomeValues,
      })
      .select('id')
      .single();

    if (error || !report) {
      setSubmitting(false);
      toast({ title: 'Gagal simpan', description: error?.message, variant: 'destructive' });
      return;
    }

    const itemsToInsert = lines
      .filter((l) => l.item_name.trim() !== '' || l.unit_price > 0)
      .map((l) => ({
        report_id: report.id,
        payment_type: l.payment_type,
        item_name: l.item_name,
        unit_price: l.unit_price,
        qty: l.qty,
        subtotal: l.unit_price * l.qty,
      }));

    if (itemsToInsert.length > 0) {
      const { error: itemErr } = await supabase.from('finance_expense_items').insert(itemsToInsert);
      if (itemErr) {
        await supabase.from('finance_daily_reports').delete().eq('id', report.id);
        setSubmitting(false);
        toast({ title: 'Item pengeluaran gagal disimpan', description: itemErr.message, variant: 'destructive' });
        return;
      }
    }

    setSubmitting(false);
    toast({ title: 'Tersimpan', description: 'Laporan harian finance ditambahkan.' });
    dailyDraft.clear(createDailyRecapDraft());
    resetForm();
    fetchReports();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus laporan ini?')) return;
    const { error } = await supabase.from('finance_daily_reports').delete().eq('id', id);
    if (error) {
      toast({ title: 'Gagal hapus', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Dihapus' });
    fetchReports();
  };

  const visibleLines = lines.filter((l) => l.payment_type === expenseTab);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans">Laporan Harian</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {format(new Date(), 'EEEE, d MMMM yyyy', { locale: idLocale })}
          </p>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList>
            <TabsTrigger value="input">Input Laporan</TabsTrigger>
            <TabsTrigger value="recap">Rekap Laporan</TabsTrigger>
            <TabsTrigger value="stats">Statistik</TabsTrigger>
          </TabsList>

          {/* INPUT TAB */}
          <TabsContent value="input" className="mt-4 space-y-4">
            {/* Outlet tabs */}
            <OutletTabs
              outlets={outlets}
              loading={outletsLoading}
              active={activeOutlet}
              onChange={setActiveOutlet}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Form */}
              <Card className="glass-card lg:col-span-2">
                <CardContent className="p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h2 className="text-lg font-semibold">{activeOutletName || 'Pilih cabang'}</h2>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="report-date" className="text-sm text-muted-foreground whitespace-nowrap">Tanggal</Label>
                      <Input
                        id="report-date"
                        type="date"
                        value={reportDate}
                        onChange={(e) => setReportDate(e.target.value)}
                        className="w-auto"
                      />
                    </div>
                  </div>

                  {/* Dynamic income fields (+ optional inline read-only selisih field) */}
                  {(() => {
                    const totalCells = activeConfig.income_fields.length + (activeConfig.selisih_inline_label ? 1 : 0);
                    if (totalCells === 0) return null;
                    return (
                      <div className={cn(
                        'grid grid-cols-1 gap-4',
                        totalCells === 2 && 'md:grid-cols-2',
                        totalCells >= 3 && 'md:grid-cols-3',
                      )}>
                        {activeConfig.income_fields.map((f) => (
                          <div key={f.key}>
                            <Label>{f.label}</Label>
                            <MoneyInput
                              value={incomeValues[f.key]}
                              onChange={(v) =>
                                setIncomeValues((prev) => ({ ...prev, [f.key]: v }))
                              }
                              placeholder="Rp 0"
                            />
                          </div>
                        ))}
                        {activeConfig.selisih_inline_label && (
                          <div>
                            <Label>{activeConfig.selisih_inline_label}</Label>
                            <div className="h-10 flex items-center px-3 rounded-md border border-input bg-muted/40 text-sm font-semibold">
                              {formatRp(selisih)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Dynamic pair groups (parallel columns: e.g. Penjualan vs Pendapatan Online) */}
                  {(activeConfig.pair_groups || []).map((pg) => {
                    const leftTotal = pg.platforms.reduce(
                      (s, p) => s + (incomeValues[`${pg.left_prefix}_${p.key}`] || 0), 0,
                    );
                    const rightTotal = pg.platforms.reduce(
                      (s, p) => s + (incomeValues[`${pg.right_prefix}_${p.key}`] || 0), 0,
                    );
                    return (
                      <div key={pg.key} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {([
                          { label: pg.left_label, prefix: pg.left_prefix, total: leftTotal },
                          { label: pg.right_label, prefix: pg.right_prefix, total: rightTotal },
                        ]).map((col) => (
                          <div key={col.prefix} className="space-y-3">
                            <h4 className="font-semibold text-sm">{col.label}</h4>
                            {pg.platforms.map((p) => {
                              const k = `${col.prefix}_${p.key}`;
                              return (
                                <div key={k}>
                                  <Label className="text-xs text-muted-foreground">{p.label}</Label>
                                  <MoneyInput
                                    value={incomeValues[k]}
                                    onChange={(v) =>
                                      setIncomeValues((prev) => ({ ...prev, [k]: v }))
                                    }
                                    placeholder="Rp 0"
                                  />
                                </div>
                              );
                            })}
                            <div className="bg-muted/40 border border-border rounded-md px-3 py-2 text-sm">
                              Total: <span className="font-semibold">{formatRp(col.total)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}

                  <div>
                    <div className="mb-3">
                      <h3 className="font-semibold">Pengeluaran</h3>
                    </div>

                    <Tabs value={expenseTab} onValueChange={(v) => setExpenseTab(v as PaymentType)}>
                      <TabsList>
                        <TabsTrigger value="cash">Cash</TabsTrigger>
                        <TabsTrigger value="transfer">Transfer</TabsTrigger>
                      </TabsList>

                      <TabsContent value={expenseTab} className="mt-3 space-y-2">
                        <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
                          <div className="col-span-5">Nama Item</div>
                          <div className="col-span-3">Harga</div>
                          <div className="col-span-2">Qty</div>
                          <div className="col-span-2 text-right">Subtotal</div>
                        </div>

                        {visibleLines.length === 0 && (
                          <p className="text-sm text-muted-foreground py-4 text-center">
                            Belum ada item. Klik <span className="font-medium">+ Tambah</span> untuk menambah.
                          </p>
                        )}

                        {visibleLines.map((l) => {
                          const subtotal = l.unit_price * l.qty;
                          return (
                            <div key={l.id} className="grid grid-cols-12 gap-2 items-center rounded-lg border border-border/60 bg-background/50 p-2 md:border-0 md:bg-transparent md:p-0">
                              <Input
                                className="col-span-12 md:col-span-6"
                                placeholder="Nama Item"
                                value={l.item_name}
                                onChange={(e) => updateLine(l.id, { item_name: e.target.value })}
                              />
                              <MoneyInput
                                className="col-span-7 md:col-span-3"
                                placeholder="Rp 0"
                                value={l.unit_price}
                                onChange={(v) => updateLine(l.id, { unit_price: v })}
                              />
                              <Input
                                className="col-span-3 md:col-span-1"
                                type="number"
                                inputMode="numeric"
                                value={l.qty || ''}
                                onChange={(e) => updateLine(l.id, { qty: Number(e.target.value) })}
                              />
                              <div className="col-span-2 md:col-span-1 text-right font-medium text-sm whitespace-nowrap">
                                {formatRp(subtotal)}
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="col-span-12 md:col-span-1 h-9 w-full md:w-9 text-destructive justify-self-end"
                                onClick={() => removeLine(l.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </TabsContent>
                    </Tabs>

                    <div className="mt-6 rounded-lg border border-border bg-muted/20 p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold">Total Cash</span>
                          <span className="font-semibold">{formatRp(totalCashExpense)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-b border-border pb-3">
                          <span className="font-semibold">Total Transfer</span>
                          <span className="font-semibold">{formatRp(totalTransferExpense)}</span>
                        </div>
                        <div className="flex justify-between text-base">
                          <span className="font-bold">Total Pengeluaran</span>
                          <span className="font-bold">{formatRp(totalExpense)}</span>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Button type="button" variant="outline" onClick={addLine} className="w-full sm:w-[220px]">
                          <Plus className="w-4 h-4 mr-1" /> Tambah Pengeluaran
                        </Button>

                        <Button onClick={handleSubmit} disabled={submitting || !canManage} className="w-full sm:w-[220px]">
                          <Save className="w-4 h-4 mr-2" /> {submitting ? 'Menyimpan…' : 'Simpan Laporan'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ringkasan Sidebar (config-driven) */}
              <Card className="glass-card h-fit">
                <CardContent className="p-0">
                  <div className="px-5 py-3 border-b border-border bg-muted/30">
                    <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                      Ringkasan Laporan Harian
                    </h3>
                  </div>
                  <div className="divide-y divide-border">
                    {activeConfig.summary_groups.map((g) => {
                      // Compute group total
                      let groupTotal = 0;
                      if (g.is_selisih) groupTotal = selisih;
                      else if (g.includes_expense) {
                        groupTotal =
                          g.expense_type === 'cash' ? totalCashExpense
                          : g.expense_type === 'transfer' ? totalTransferExpense
                          : totalExpense;
                      }
                      else groupTotal = sumGroup(g.fields);

                      const fieldRows = (g.fields || [])
                        .map((k) => activeConfig.income_fields.find((f) => f.key === k))
                        .filter(Boolean) as { key: string; label: string }[];

                      return (
                        <div key={g.code} className={cn(g.is_selisih && 'bg-muted/60')}>
                          <div className="flex items-center justify-between px-5 py-3">
                            <span className="text-sm font-semibold">{g.code}. {g.label}</span>
                            <span className="text-sm font-semibold">{formatRp(groupTotal)}</span>
                          </div>
                          {/* sub-rows: income fields */}
                          {fieldRows.map((f) => (
                            <div key={f.key} className="flex items-center justify-between px-8 pb-2 -mt-1">
                              <span className="text-xs text-muted-foreground">{f.label}</span>
                              <span className="text-xs">{formatRp(incomeValues[f.key] || 0)}</span>
                            </div>
                          ))}
                          {/* sub-rows: expense breakdown */}
                          {g.expense_breakdown?.map((t) => (
                            <div key={t} className="flex items-center justify-between px-8 pb-2 -mt-1">
                              <span className="text-xs text-muted-foreground capitalize">{t}</span>
                              <span className="text-xs">
                                {formatRp(t === 'cash' ? totalCashExpense : totalTransferExpense)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* REKAP TAB */}
          <TabsContent value="recap" className="mt-4">
            <OutletTabs
              outlets={outlets}
              loading={outletsLoading}
              active={activeOutlet}
              onChange={setActiveOutlet}
              className="mb-4"
            />

            <Card className="glass-card">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground bg-muted/30">
                        <th className="p-3 font-medium text-left uppercase text-xs tracking-wider">Tanggal</th>
                        <th className="p-3 font-medium text-center uppercase text-xs tracking-wider">Pengeluaran Cash</th>
                        <th className="p-3 font-medium text-center uppercase text-xs tracking-wider">Pengeluaran Transfer</th>
                        <th className="p-3 font-medium text-center uppercase text-xs tracking-wider">Total Pengeluaran</th>
                        <th className="p-3 font-medium text-center uppercase text-xs tracking-wider">Selisih</th>
                        <th className="p-3 font-medium w-12" />
                        {role === 'admin' && <th className="p-3 font-medium w-12" />}
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r: any) => {
                        const items = (r.finance_expense_items || []) as any[];
                        const tCash = items.filter((i) => i.payment_type === 'cash').reduce((s, i) => s + Number(i.subtotal || 0), 0);
                        const tTransfer = items.filter((i) => i.payment_type === 'transfer').reduce((s, i) => s + Number(i.subtotal || 0), 0);
                        const tTotal = tCash + tTransfer;
                        const extra = (r.extra_fields || {}) as Record<string, number>;
                        const rowSelisih = evalSelisih(activeConfig.selisih_formula, {
                          ...extra,
                          total_expense: tTotal,
                          total_cash_expense: tCash,
                          total_transfer_expense: tTransfer,
                        });
                        const isExpanded = !!expandedRows[r.id];
                        const colSpan = role === 'admin' ? 7 : 6;
                        return (
                          <Fragment key={r.id}>
                            <tr
                              className="border-b border-border/50 hover:bg-muted/30 cursor-pointer"
                              onClick={() => setExpandedRows((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                            >
                              <td className="p-3 text-left">{r.report_date}</td>
                              <td className="p-3 text-center">{formatRp(tCash)}</td>
                              <td className="p-3 text-center">{formatRp(tTransfer)}</td>
                              <td className="p-3 text-center">{formatRp(tTotal)}</td>
                              <td className={cn(
                                'p-3 text-center font-semibold',
                                rowSelisih > 0 && 'text-success',
                                rowSelisih < 0 && 'text-destructive',
                              )}>
                                {rowSelisih > 0 && '+'}{formatRp(rowSelisih)}
                              </td>
                              <td className="p-3 text-center">
                                <ChevronDown
                                  className={cn('w-4 h-4 inline-block transition-transform text-muted-foreground', isExpanded && 'rotate-180')}
                                />
                              </td>
                              {role === 'admin' && (
                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                            {isExpanded && (
                              <tr className="bg-muted/20 border-b border-border/50">
                                <td colSpan={colSpan} className="p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                    {items.length > 0 ? (
                                      <div>
                                        <div className="font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Rincian Pengeluaran</div>
                                        <div className="space-y-1">
                                          {items.map((it) => (
                                            <div key={it.id} className="flex justify-between gap-3">
                                              <span className="capitalize text-muted-foreground">[{it.payment_type}]</span>
                                              <span className="flex-1">{it.item_name || '-'}</span>
                                              <span>{it.qty} × {formatRp(Number(it.unit_price))}</span>
                                              <span className="font-medium">{formatRp(Number(it.subtotal))}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-muted-foreground">Tidak ada item pengeluaran.</div>
                                    )}
                                    {Object.keys(extra).length > 0 && (
                                      <div>
                                        <div className="font-semibold mb-2 uppercase tracking-wider text-muted-foreground">Pendapatan</div>
                                        <div className="space-y-1">
                                          {activeConfig.income_fields.map((f) => (
                                            <div key={f.key} className="flex justify-between">
                                              <span className="text-muted-foreground">{f.label}</span>
                                              <span>{formatRp(Number(extra[f.key] || 0))}</span>
                                            </div>
                                          ))}
                                          {(activeConfig.pair_groups || []).flatMap((pg) =>
                                            pg.platforms.flatMap((p) => [
                                              { k: `${pg.left_prefix}_${p.key}`, lbl: `${pg.left_label} - ${p.label}` },
                                              { k: `${pg.right_prefix}_${p.key}`, lbl: `${pg.right_label} - ${p.label}` },
                                            ])
                                          ).map(({ k, lbl }) => (
                                            <div key={k} className="flex justify-between">
                                              <span className="text-muted-foreground">{lbl}</span>
                                              <span>{formatRp(Number(extra[k] || 0))}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {reports.length === 0 && (
                        <tr>
                          <td colSpan={role === 'admin' ? 7 : 6} className="p-8 text-center text-muted-foreground">
                            Belum ada laporan untuk cabang ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STATS TAB */}
          <TabsContent value="stats" className="mt-4">
            <FinanceStatsRecap />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function OutletTabs({
  outlets, loading, active, onChange, className,
}: {
  outlets: { id: string; name: string }[];
  loading: boolean;
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-2 flex-wrap border-b border-border pb-3', className)}>
      {loading && <span className="text-sm text-muted-foreground">Memuat cabang…</span>}
      {outlets.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium border transition-colors',
            active === o.id
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-foreground border-border hover:bg-muted'
          )}
        >
          {o.name}
        </button>
      ))}
    </div>
  );
}
