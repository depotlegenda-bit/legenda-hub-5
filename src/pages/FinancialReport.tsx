import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { useOutlets } from '@/hooks/useOutlets';
import { useTabParam } from '@/hooks/useTabParam';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CollapsibleSection } from '@/components/CollapsibleSection';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, Camera, X, FileSpreadsheet, Printer, FileText, Image as ImageIcon, Eraser, History, FolderOpen, BarChart3, ListChecks, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import OutletReportRecap from '@/components/finance/OutletReportRecap';
import { usePersistentDraft } from '@/hooks/usePersistentDraft';

interface ExpenseRow {
  id: string;
  description: string;
  category: string;
  unit_price: number;
  qty: number;
  receipt_url: string | null;
}

interface ReportRecord {
  id: string;
  report_date: string;
  outlet_id: string | null;
  reporter_name: string | null;
  shift: string | null;
  starting_cash: number | null;
  dine_in_omzet: number | null;
  daily_offline_income: number | null;
  ending_physical_cash: number | null;
  ending_qris_cash: number | null;
  shopeefood_sales: number | null;
  gofood_sales: number | null;
  grabfood_sales: number | null;
  notes: string | null;
  created_at: string | null;
}

const SHIFTS = ['Shift 1', 'Shift 2', 'Full Day'];
const DEFAULT_CATEGORIES = ['Operasional', 'Bahan Baku', 'Gaji', 'Listrik/Air', 'Lain-lain'];

const formatRp = (v: number) => `Rp ${(v || 0).toLocaleString('id-ID')}`;
const parseNum = (v: string | number) => {
  if (typeof v === 'number') return v;
  const n = Number(String(v || '').replace(/\D/g, ''));
  return isNaN(n) ? 0 : n;
};

const createFinancialReportDraft = () => ({
  selectedOutlet: '',
  form: {
    report_date: new Date().toISOString().split('T')[0],
    reporter_name: '',
    shift: 'Full Day',
    starting_cash: 0,
    dine_in_omzet: 0,
    ending_physical_cash: 0,
    ending_qris_cash: 0,
    shopeefood_sales: 0,
    gofood_sales: 0,
    grabfood_sales: 0,
    notes: '',
  },
  expenses: [{ id: '', description: '', category: DEFAULT_CATEGORIES[0], unit_price: 0, qty: 1, receipt_url: null as string | null }],
});

export default function FinancialReport() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [mainTab, setMainTab] = useTabParam('input');
  const { outlets, selectedOutlet, setSelectedOutlet } = useOutlets();
  const reportDraft = usePersistentDraft('draft:financial-report-v1', createFinancialReportDraft());
  const [submitting, setSubmitting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState(reportDraft.value.form);

  const newExp = (): ExpenseRow => ({
    id: `${Date.now()}-${Math.random()}`,
    description: '',
    category: DEFAULT_CATEGORIES[0],
    unit_price: 0,
    qty: 1,
    receipt_url: null,
  });

  const [expenses, setExpenses] = useState<ExpenseRow[]>(
    reportDraft.value.expenses.length
      ? reportDraft.value.expenses.map((expense) => ({ ...expense, id: expense.id || `${Date.now()}-${Math.random()}` }))
      : [newExp()]
  );
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newCat, setNewCat] = useState('');
  const [reports, setReports] = useState<ReportRecord[]>([]);

  const canManage = role === 'management';
  const canViewAll = role === 'management' || role === 'pic';

  // Load categories from DB
  useEffect(() => {
    if (!user) return;
    supabase.from('expense_categories').select('name').eq('user_id', user.id).then(({ data }) => {
      if (data && data.length > 0) {
        setCategories(data.map((c) => c.name));
      }
    });
  }, [user]);

  const fetchReports = async () => {
    if (!canViewAll) return;
    const { data } = await supabase.from('financial_reports').select('*').order('report_date', { ascending: false }).limit(100);
    if (data) setReports(data as ReportRecord[]);
  };

  useEffect(() => { fetchReports(); }, [role]);
  useEffect(() => {
    reportDraft.setValue({ selectedOutlet, form, expenses });
  }, [expenses, form, reportDraft, selectedOutlet]);

  // Totals
  const totalExpense = useMemo(() => expenses.reduce((s, e) => s + e.unit_price * e.qty, 0), [expenses]);
  const totalCash = form.ending_physical_cash + form.ending_qris_cash;
  const totalIncome = totalCash - form.starting_cash;
  const grossProfit = form.dine_in_omzet - totalExpense;
  const gap = totalIncome - grossProfit;

  // Outlet name for preview
  const branchName = outlets.find((o) => o.id === selectedOutlet)?.name || 'Pilih Cabang';

  const updateExpense = (id: string, field: keyof ExpenseRow, value: any) => {
    setExpenses((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, [field]: value } : e));
      // Auto-add baris baru jika baris terakhir mulai diisi
      const last = next[next.length - 1];
      if (last && last.id === id) {
        const hasContent =
          (field === 'description' ? String(value).trim() : last.description.trim()) !== ''
          || (field === 'unit_price' ? Number(value) : last.unit_price) > 0
          || (field === 'qty' ? Number(value) : last.qty) > 0;
        if (hasContent) next.push(newExp());
      }
      return next;
    });
  };

  const addExpenseRow = () => setExpenses((prev) => [...prev, newExp()]);
  const removeExpenseRow = (id: string) => setExpenses((prev) => prev.filter((e) => e.id !== id));

  const handleImageUpload = async (id: string, file: File) => {
    if (!user) return;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('expense-receipts').upload(path, file, { upsert: false });
    if (error) {
      toast({ title: 'Gagal upload', description: error.message, variant: 'destructive' });
      return;
    }
    const { data } = supabase.storage.from('expense-receipts').getPublicUrl(path);
    updateExpense(id, 'receipt_url', data.publicUrl);
  };

  const addCategory = async () => {
    const v = newCat.trim();
    if (!v || categories.includes(v) || !user) return;
    setCategories((prev) => [...prev, v]);
    setNewCat('');
    await supabase.from('expense_categories').insert({ user_id: user.id, name: v });
  };

  const removeCategory = async (name: string) => {
    if (categories.length <= 1 || !user) return;
    setCategories((prev) => prev.filter((c) => c !== name));
    await supabase.from('expense_categories').delete().eq('user_id', user.id).eq('name', name);
  };

  const resetForm = () => {
    if (!confirm('Bersihkan formulir?')) return;
    reportDraft.clear(createFinancialReportDraft());
    resetFormSilent();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedOutlet) {
      toast({ title: 'Pilih cabang dulu', variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    const { data: report, error } = await supabase.from('financial_reports').insert({
      user_id: user.id,
      outlet_id: selectedOutlet,
      report_date: form.report_date,
      reporter_name: form.reporter_name,
      shift: form.shift,
      starting_cash: form.starting_cash,
      dine_in_omzet: form.dine_in_omzet,
      daily_offline_income: form.dine_in_omzet, // legacy compat
      ending_physical_cash: form.ending_physical_cash,
      ending_qris_cash: form.ending_qris_cash,
      shopeefood_sales: form.shopeefood_sales,
      gofood_sales: form.gofood_sales,
      grabfood_sales: form.grabfood_sales,
      online_delivery_sales: form.shopeefood_sales + form.gofood_sales + form.grabfood_sales,
      notes: form.notes,
    }).select('id').single();

    if (error || !report) {
      toast({ title: 'Gagal simpan', description: error?.message, variant: 'destructive' });
      setSubmitting(false);
      return;
    }

    const valid = expenses.filter((e) => e.description.trim() && e.unit_price > 0);
    if (valid.length > 0) {
      await supabase.from('expense_items').insert(
        valid.map((e) => ({
          report_id: report.id,
          description: e.description,
          category: e.category,
          unit_price: e.unit_price,
          qty: e.qty,
          amount: e.unit_price * e.qty,
          receipt_url: e.receipt_url,
        }))
      );
    }

    toast({ title: 'Berhasil!', description: 'Laporan tersimpan ke database.' });
    resetFormSilent();
    setSubmitting(false);
    fetchReports();
  };

  const resetFormSilent = () => {
    setForm(createFinancialReportDraft().form);
    setExpenses([newExp()]);
  };

  const handleDeleteReport = async (id: string) => {
    await supabase.from('expense_items').delete().eq('report_id', id);
    const { error } = await supabase.from('financial_reports').delete().eq('id', id);
    if (error) {
      toast({ title: 'Gagal hapus', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Dihapus' });
      fetchReports();
    }
  };

  const handleExportExcel = () => {
    const outletName = branchName;
    const sheet: any[][] = [
      [`LAPORAN CLOSING ${outletName.toUpperCase()}`],
      ['Pelapor', form.reporter_name || '-'],
      ['Tanggal', form.report_date],
      ['Shift', form.shift],
      [],
      ['RINGKASAN KAS'],
      ['Cash Fisik', form.ending_physical_cash],
      ['QRIS', form.ending_qris_cash],
      ['Modal Awal', form.starting_cash],
      ['Total Didapat', totalIncome],
      [],
      ['PENJUALAN'],
      ['Omzet Dine In', form.dine_in_omzet],
      [],
      ['HASIL AKHIR'],
      ['Total Pengeluaran', totalExpense],
      ['Laba Kotor', grossProfit],
      ['Selisih', gap],
      [],
      ['ONLINE FOOD'],
      ['ShopeeFood', form.shopeefood_sales],
      ['GoFood', form.gofood_sales],
      ['GrabFood', form.grabfood_sales],
      [],
      ['PENGELUARAN'],
      ['Deskripsi', 'Kategori', 'Harga', 'Qty', 'Total'],
    ];
    expenses.forEach((e) => sheet.push([e.description, e.category, e.unit_price, e.qty, e.unit_price * e.qty]));

    const ws = XLSX.utils.aoa_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Closing');
    XLSX.writeFile(wb, `Closing_${outletName.replace(/\s/g, '_')}_${form.report_date}.xlsx`);
  };

  // Print helpers
  const buildReceiptHtml = () => `
    <div style="font-family:'Courier Prime',monospace;max-width:380px;margin:auto;padding:15px;color:#000;font-size:13px;">
      <div style="text-align:center;margin-bottom:8px;">
        <div style="font-weight:bold;font-size:18px;text-transform:uppercase;">${branchName}</div>
        <div style="font-size:10px;font-style:italic;">Unit of Dua Legenda Grup</div>
        <div style="border-top:1px dashed #000;margin:8px 0;"></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;">
          <span>Tgl: ${form.report_date}</span><span>${form.shift}</span>
        </div>
        <div style="text-align:left;font-size:11px;font-weight:bold;">Kasir: ${form.reporter_name || '-'}</div>
      </div>
      <div style="font-weight:bold;text-transform:uppercase;border-bottom:1px solid #000;display:inline-block;margin-bottom:4px;">Penjualan</div>
      <div style="display:flex;justify-content:space-between;"><span>Omzet (Dine In):</span><span>${formatRp(form.dine_in_omzet)}</span></div>
      <div style="border-top:1px dashed #000;margin:8px 0;"></div>
      <div style="font-weight:bold;text-transform:uppercase;border-bottom:1px solid #000;display:inline-block;margin-bottom:4px;">Kas Masuk</div>
      <div style="display:flex;justify-content:space-between;"><span>Total Cash:</span><span>${formatRp(form.ending_physical_cash)}</span></div>
      <div style="display:flex;justify-content:space-between;"><span>Total QRIS:</span><span>${formatRp(form.ending_qris_cash)}</span></div>
      <div style="display:flex;justify-content:space-between;font-style:italic;color:#555;"><span>Modal Awal (-):</span><span>${formatRp(form.starting_cash)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;border-top:1px solid #000;padding-top:4px;"><span>TOTAL DIDAPAT:</span><span>${formatRp(totalIncome)}</span></div>
      <div style="border-top:1px dashed #000;margin:8px 0;"></div>
      <div style="font-weight:bold;text-transform:uppercase;margin-bottom:4px;">Pengeluaran:</div>
      ${expenses.map((e) => `<div style="display:flex;justify-content:space-between;font-size:11px;"><span>${e.qty}x ${e.description || '...'}</span><span>${formatRp(e.unit_price * e.qty)}</span></div>`).join('')}
      <div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:8px;color:#b91c1c;"><span>TOTAL KELUAR:</span><span>${formatRp(totalExpense)}</span></div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin-top:8px;"><span>LABA KOTOR:</span><span>${formatRp(grossProfit)}</span></div>
      <div style="border-top:1px dashed #000;margin:8px 0;"></div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;color:${gap < 0 ? '#dc2626' : gap > 0 ? '#16a34a' : '#000'};"><span>SELISIH:</span><span>${formatRp(gap)}</span></div>
      <div style="margin-top:16px;padding-top:8px;border-top:1px dotted #999;">
        <div style="font-weight:bold;font-size:11px;text-transform:uppercase;color:#ea580c;margin-bottom:4px;">Online Food (Arsip):</div>
        <div style="display:flex;justify-content:space-between;font-size:11px;"><span>ShopeeFood:</span><span>${formatRp(form.shopeefood_sales)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;"><span>GoFood:</span><span>${formatRp(form.gofood_sales)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:11px;"><span>GrabFood:</span><span>${formatRp(form.grabfood_sales)}</span></div>
      </div>
      <div style="font-size:9px;margin-top:24px;text-align:center;font-style:italic;opacity:0.6;">
        Dicetak: ${new Date().toLocaleString('id-ID')}<br>Copyright Dua Legenda Grup 2026
      </div>
    </div>
  `;

  const buildA4Html = () => `
    <div style="padding:32px;background:#fff;font-family:sans-serif;font-size:14px;color:#000;">
      <div style="display:flex;justify-content:space-between;border-bottom:4px solid #000;padding-bottom:16px;margin-bottom:24px;">
        <div>
          <h1 style="font-size:28px;font-weight:900;text-transform:uppercase;margin:0;">Dua Legenda Grup</h1>
          <p style="font-size:18px;font-weight:bold;color:#666;margin:4px 0 0;">${branchName.toUpperCase()}</p>
        </div>
        <div style="text-align:right;text-transform:uppercase;">
          <h2 style="font-size:20px;font-weight:bold;margin:0;">Laporan Closing</h2>
          <p style="color:#666;margin:4px 0 0;">${form.report_date} | ${form.shift}</p>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:24px;">
        <div>
          <h3 style="font-size:16px;font-weight:bold;border-bottom:1px solid #ccc;text-transform:uppercase;color:#1e40af;">Ringkasan Kas</h3>
          <div style="display:flex;justify-content:space-between;margin:4px 0;"><span>Pelapor:</span><b>${form.reporter_name || '-'}</b></div>
          <div style="display:flex;justify-content:space-between;margin:4px 0;"><span>Cash Fisik:</span><span>${formatRp(form.ending_physical_cash)}</span></div>
          <div style="display:flex;justify-content:space-between;margin:4px 0;"><span>QRIS:</span><span>${formatRp(form.ending_qris_cash)}</span></div>
          <div style="display:flex;justify-content:space-between;margin:4px 0;"><span>Modal Awal (-):</span><span>${formatRp(form.starting_cash)}</span></div>
          <div style="display:flex;justify-content:space-between;border-top:2px solid #000;padding-top:8px;font-weight:900;font-size:20px;"><span>Total Didapat:</span><span>${formatRp(totalIncome)}</span></div>
        </div>
        <div>
          <h3 style="font-size:16px;font-weight:bold;border-bottom:1px solid #ccc;text-transform:uppercase;color:#3730a3;">Penjualan</h3>
          <div style="display:flex;justify-content:space-between;margin:4px 0;"><span>Omzet Dine In:</span><span>${formatRp(form.dine_in_omzet)}</span></div>
          <h3 style="font-size:16px;font-weight:bold;border-bottom:1px solid #ccc;text-transform:uppercase;color:#3730a3;margin-top:16px;">Hasil Akhir</h3>
          <div style="display:flex;justify-content:space-between;margin:4px 0;"><span>Total Pengeluaran:</span><span style="color:#dc2626;">${formatRp(totalExpense)}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;margin-top:8px;"><span>LABA KOTOR:</span><span>${formatRp(grossProfit)}</span></div>
          <div style="padding:12px;background:#f3f4f6;border-radius:8px;display:flex;justify-content:space-between;font-size:22px;font-weight:900;margin-top:8px;"><span>SELISIH:</span><span>${formatRp(gap)}</span></div>
        </div>
      </div>
      <div style="margin-bottom:24px;padding:16px;background:#fff7ed;border-radius:12px;border:1px solid #fed7aa;">
        <h3 style="font-size:11px;font-weight:900;color:#9a3412;text-transform:uppercase;text-align:center;margin:0 0 8px;">Data Online Food</h3>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;text-align:center;">
          <div><p style="font-size:10px;color:#666;text-transform:uppercase;margin:0;">Shopee</p><b>${formatRp(form.shopeefood_sales)}</b></div>
          <div><p style="font-size:10px;color:#666;text-transform:uppercase;margin:0;">GoFood</p><b>${formatRp(form.gofood_sales)}</b></div>
          <div><p style="font-size:10px;color:#666;text-transform:uppercase;margin:0;">GrabFood</p><b>${formatRp(form.grabfood_sales)}</b></div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:32px;font-size:12px;">
        <thead><tr style="background:#f3f4f6;"><th style="border:1px solid #ccc;padding:8px;text-align:left;">Deskripsi</th><th style="border:1px solid #ccc;padding:8px;">Kategori</th><th style="border:1px solid #ccc;padding:8px;text-align:center;">Qty</th><th style="border:1px solid #ccc;padding:8px;text-align:right;">Subtotal</th></tr></thead>
        <tbody>${expenses.map((e) => `<tr><td style="border:1px solid #ccc;padding:8px;">${e.description || '-'}</td><td style="border:1px solid #ccc;padding:8px;">${e.category}</td><td style="border:1px solid #ccc;padding:8px;text-align:center;">${e.qty}</td><td style="border:1px solid #ccc;padding:8px;text-align:right;font-weight:bold;">${formatRp(e.unit_price * e.qty)}</td></tr>`).join('')}</tbody>
      </table>
      <div style="margin-top:80px;display:flex;justify-content:flex-end;gap:80px;text-align:center;">
        <div style="width:192px;border-top:1px solid #000;padding-top:8px;font-weight:bold;">${form.reporter_name || '(Pelapor)'}</div>
        <div style="width:192px;border-top:1px solid #000;padding-top:8px;">( Manager )</div>
      </div>
    </div>
  `;

  const buildNotaHtml = () => {
    const withImg = expenses.filter((e) => e.receipt_url);
    return `
      <div style="padding:32px;background:#fff;min-height:100vh;">
        <h1 style="font-size:24px;font-weight:900;text-align:center;border-bottom:2px solid #000;padding-bottom:16px;text-transform:uppercase;">Lampiran Nota Pengeluaran</h1>
        <div style="display:flex;justify-content:space-between;margin:16px 0;font-size:12px;font-weight:bold;text-transform:uppercase;">
          <span>Unit: ${branchName}</span><span>Tgl: ${form.report_date}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:24px;">
          ${withImg.length ? withImg.map((e) => `
            <div style="border:1px solid #e5e7eb;padding:16px;border-radius:16px;background:#f9fafb;display:flex;flex-direction:column;align-items:center;page-break-inside:avoid;">
              <img src="${e.receipt_url}" style="max-width:100%;max-height:380px;object-fit:contain;margin-bottom:12px;" />
              <div style="text-align:center;width:100%;border-top:1px solid #e5e7eb;padding-top:8px;">
                <p style="font-weight:bold;text-transform:uppercase;font-size:10px;margin:0;">${e.description || 'Nota'}</p>
                <p style="font-size:9px;color:#999;margin:0;">${formatRp(e.unit_price * e.qty)}</p>
              </div>
            </div>
          `).join('') : '<p style="grid-column:span 2;text-align:center;padding:80px 0;font-style:italic;font-weight:bold;border:2px dashed #e5e7eb;border-radius:16px;">Tidak ada foto nota diunggah.</p>'}
        </div>
      </div>
    `;
  };

  const handlePrint = (type: 'receipt' | 'pdf' | 'attachment') => {
    let content = '';
    if (type === 'receipt') content = buildReceiptHtml();
    else if (type === 'pdf') content = buildA4Html() + '<div style="page-break-before:always;"></div>' + buildNotaHtml();
    else content = buildNotaHtml();

    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Cetak Laporan</title><link href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet"><style>@page{margin:1cm;}body{margin:0;}</style></head><body>${content}</body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Laporan Harian Outlet</h1>
            <p className="text-muted-foreground mt-1">Sistem laporan closing harian Dua Legenda Grup</p>
          </div>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList>
            <TabsTrigger value="input"><FileText className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Input Laporan</span><span className="sm:hidden ml-1">Input</span></TabsTrigger>
            <TabsTrigger value="log"><ListChecks className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Rekap Log</span><span className="sm:hidden ml-1">Rekap</span></TabsTrigger>
            <TabsTrigger value="stats"><BarChart3 className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Statistik per Outlet</span><span className="sm:hidden ml-1">Statistik</span></TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="mt-4 space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={resetForm}>
                <Eraser className="w-4 h-4 mr-1" /> Reset Form
              </Button>
            </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* LEFT: Form */}
          <div className="xl:col-span-2 space-y-6">
            {/* Data Penjualan */}
            <CollapsibleSection
              title="Data Penjualan"
              icon={<FileText className="w-4 h-4 text-primary shrink-0" />}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs uppercase">Nama Kasir / Pelapor</Label>
                  <Input value={form.reporter_name} onChange={(e) => setForm({ ...form, reporter_name: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs uppercase">Cabang</Label>
                  <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                    <SelectTrigger><SelectValue placeholder="Pilih cabang" /></SelectTrigger>
                    <SelectContent>
                      {outlets.map((o) => (<SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase">Tanggal</Label>
                  <Input type="date" value={form.report_date} onChange={(e) => setForm({ ...form, report_date: e.target.value })} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase">Shift</Label>
                  <Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SHIFTS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase">Modal Awal</Label>
                  <Input inputMode="numeric" placeholder="Rp 0" value={form.starting_cash ? formatRp(form.starting_cash) : ''} onChange={(e) => setForm({ ...form, starting_cash: parseNum(e.target.value) })} className="bg-primary/5 font-bold" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase">Omzet Dine In</Label>
                  <Input inputMode="numeric" placeholder="Rp 0" value={form.dine_in_omzet ? formatRp(form.dine_in_omzet) : ''} onChange={(e) => setForm({ ...form, dine_in_omzet: parseNum(e.target.value) })} className="font-bold text-primary" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-success">Cash Fisik</Label>
                  <Input inputMode="numeric" placeholder="Rp 0" value={form.ending_physical_cash ? formatRp(form.ending_physical_cash) : ''} onChange={(e) => setForm({ ...form, ending_physical_cash: parseNum(e.target.value) })} className="font-bold" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-secondary-foreground">QRIS / Transfer</Label>
                  <Input inputMode="numeric" placeholder="Rp 0" value={form.ending_qris_cash ? formatRp(form.ending_qris_cash) : ''} onChange={(e) => setForm({ ...form, ending_qris_cash: parseNum(e.target.value) })} className="font-bold" />
                </div>
              </div>
            </CollapsibleSection>

            {/* Online */}
            <CollapsibleSection
              title="Penjualan Online"
              icon={<FileSpreadsheet className="w-4 h-4 text-accent shrink-0" />}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { key: 'shopeefood_sales', label: 'ShopeeFood' },
                  { key: 'gofood_sales', label: 'GoFood' },
                  { key: 'grabfood_sales', label: 'GrabFood' },
                ].map((p) => (
                  <div key={p.key} className="bg-muted/40 p-3 rounded-xl border text-center space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">{p.label}</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="Rp 0"
                      value={(form as any)[p.key] ? formatRp((form as any)[p.key]) : ''}
                      onChange={(e) => setForm({ ...form, [p.key]: parseNum(e.target.value) } as any)}
                      className="border-none bg-transparent text-center text-lg font-black focus-visible:ring-0"
                    />
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* Pengeluaran */}
            <CollapsibleSection
              title={<span className="text-destructive">Rincian Pengeluaran</span>}
              icon={<Trash2 className="w-4 h-4 text-destructive shrink-0" />}
              rightSlot={
                <Button type="button" size="sm" onClick={(e) => { e.stopPropagation(); addExpenseRow(); }}>
                  <Plus className="w-4 h-4 mr-1" /> Tambah
                </Button>
              }
            >
              <div className="space-y-4">
                {/* Kelola Kategori */}
                <div className="p-3 bg-secondary/10 rounded-xl border border-secondary/30 space-y-2">
                  <Label className="text-xs uppercase tracking-wider font-black text-secondary-foreground">Kelola Kategori</Label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((c) => (
                      <div key={c} className="flex items-center bg-card px-3 py-1 rounded-full text-xs font-bold border">
                        <span>{c}</span>
                        <button type="button" onClick={() => removeCategory(c)} className="ml-2 text-destructive hover:text-destructive/70 font-bold">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Nama kategori baru..." value={newCat} onChange={(e) => setNewCat(e.target.value)} className="text-sm" />
                    <Button type="button" onClick={addCategory} variant="secondary">Simpan</Button>
                  </div>
                </div>

                {expenses.map((exp, idx) => {
                  const subtotal = (exp.unit_price || 0) * (exp.qty || 0);
                  return (
                  <div key={exp.id} className="relative p-4 pr-10 bg-card rounded-xl border shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Item #{idx + 1}</span>
                      <span className="text-sm font-bold text-primary">{formatRp(subtotal)}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-xs uppercase">Deskripsi</Label>
                        <Textarea placeholder="cth: Beli galon, gas, sayur..." value={exp.description} onChange={(e) => updateExpense(exp.id, 'description', e.target.value)} className="min-h-[60px] resize-y w-full" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs uppercase">Kategori</Label>
                        <Select value={exp.category} onValueChange={(v) => updateExpense(exp.id, 'category', v)}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>{categories.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs uppercase">Harga Satuan</Label>
                          <Input inputMode="numeric" placeholder="0" value={exp.unit_price ? formatRp(exp.unit_price) : ''} onChange={(e) => updateExpense(exp.id, 'unit_price', parseNum(e.target.value))} className="text-right font-medium w-full" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs uppercase">Qty</Label>
                          <Input type="number" min="0" value={exp.qty} onChange={(e) => updateExpense(exp.id, 'qty', parseFloat(e.target.value) || 0)} className="text-center w-full" />
                        </div>
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <Label className="text-xs uppercase">Nota / Bukti</Label>
                        <div className="flex items-center gap-3">
                          <label className="cursor-pointer bg-primary/5 border-2 border-dashed border-primary/30 rounded-xl px-4 py-2 flex items-center gap-2 hover:bg-primary/10 transition flex-1 min-h-[44px]">
                            <Camera className="w-4 h-4 text-primary shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{exp.receipt_url ? 'Ganti foto nota' : 'Upload / Foto nota'}</span>
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleImageUpload(exp.id, e.target.files[0])} />
                          </label>
                          {exp.receipt_url && <img src={exp.receipt_url} alt="nota" className="w-11 h-11 object-cover rounded border shrink-0" />}
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={() => removeExpenseRow(exp.id)} className="absolute top-2 right-2 bg-destructive text-destructive-foreground w-7 h-7 rounded-full flex items-center justify-center hover:opacity-80">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  );
                })}
              </div>
            </CollapsibleSection>

            {/* Catatan + Action */}
            <Card className="glass-card">
              <CardContent className="space-y-3 pt-6">
                <div className="space-y-1">
                  <Label className="text-xs uppercase">Catatan</Label>
                  <Textarea placeholder="Catatan tambahan..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <Button type="submit" disabled={submitting} className="w-full">
                  <Save className="w-4 h-4 mr-1" /> {submitting ? 'Menyimpan...' : 'Simpan Laporan'}
                </Button>
                <Collapsible open={exportOpen} onOpenChange={setExportOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between">
                      <span className="flex items-center">
                        <FolderOpen className="w-4 h-4 mr-2" /> Ekspor Laporan
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleExportExcel} className="justify-start">
                        <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handlePrint('receipt')} className="justify-start">
                        <Printer className="w-4 h-4 mr-2" /> Struk
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handlePrint('pdf')} className="justify-start">
                        <FileText className="w-4 h-4 mr-2" /> Arsip + Nota
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => handlePrint('attachment')} className="justify-start">
                        <ImageIcon className="w-4 h-4 mr-2" /> Lampiran Nota
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Live Preview */}
          <aside className="xl:col-span-1">
            <div className="sticky top-4 space-y-3">
              <h2 className="text-center font-bold text-muted-foreground uppercase tracking-widest text-xs">Live Preview Struk</h2>
              <Card className="bg-card shadow-2xl border" style={{ fontFamily: "'Courier Prime', monospace" }}>
                <CardContent className="p-4 text-[13px] text-foreground">
                  <div className="text-center mb-2">
                    <div className="font-bold text-lg uppercase">{branchName}</div>
                    <div className="text-[10px] italic">Unit of Dua Legenda Grup</div>
                    <div className="border-t border-dashed border-foreground my-2" />
                    <div className="flex justify-between text-[11px]">
                      <span>Tgl: {form.report_date}</span>
                      <span className="uppercase">{form.shift}</span>
                    </div>
                    <div className="text-left text-[11px] font-bold">Kasir: {form.reporter_name || '-'}</div>
                  </div>
                  <div className="font-bold uppercase border-b border-foreground inline-block mb-1">Penjualan</div>
                  <div className="flex justify-between"><span>Omzet (Dine In):</span><span>{formatRp(form.dine_in_omzet)}</span></div>
                  <div className="border-t border-dashed border-foreground my-2" />
                  <div className="font-bold uppercase mb-1">Pengeluaran:</div>
                  {expenses.length > 0 ? expenses.map((e) => (
                    <div key={e.id} className="flex justify-between text-[11px]">
                      <span>{e.qty}x {e.description || '...'}</span>
                      <span>{formatRp(e.unit_price * e.qty)}</span>
                    </div>
                  )) : <div className="text-center italic opacity-40 py-2">Belum ada pengeluaran</div>}
                  <div className="flex justify-between font-bold mt-2 text-destructive"><span>TOTAL KELUAR:</span><span>{formatRp(totalExpense)}</span></div>
                  <div className="flex justify-between font-bold text-[13px] mt-1"><span>PENJUALAN BERSIH:</span><span>{formatRp(grossProfit)}</span></div>
                  <div className="text-[10px] italic text-muted-foreground">(Omzet Dine In - Pengeluaran)</div>
                  <div className="border-t border-dashed border-foreground my-2" />
                  <div className="font-bold uppercase border-b border-foreground inline-block mb-1">Pendapatan (Kas Didapat)</div>
                  <div className="flex justify-between"><span>Total Cash:</span><span>{formatRp(form.ending_physical_cash)}</span></div>
                  <div className="flex justify-between"><span>Total QRIS:</span><span>{formatRp(form.ending_qris_cash)}</span></div>
                  <div className="flex justify-between italic text-muted-foreground"><span>Modal Awal (-):</span><span>{formatRp(form.starting_cash)}</span></div>
                  <div className="flex justify-between font-bold border-t border-foreground pt-1 mt-1"><span>TOTAL DIDAPAT:</span><span>{formatRp(totalIncome)}</span></div>
                  <div className="border-t border-dashed border-foreground my-2" />
                  <div className={`flex justify-between font-bold ${gap < 0 ? 'text-destructive' : gap > 0 ? 'text-success' : ''}`}>
                    <span>SELISIH:</span><span>{formatRp(gap)}</span>
                  </div>
                  <div className="text-[10px] italic text-muted-foreground">(Pendapatan - Penjualan Bersih)</div>
                  <div className="mt-3 pt-2 border-t border-dotted border-muted-foreground">
                    <div className="font-bold text-[11px] uppercase mb-1 text-accent">Online Food:</div>
                    <div className="flex justify-between text-[11px]"><span>ShopeeFood:</span><span>{formatRp(form.shopeefood_sales)}</span></div>
                    <div className="flex justify-between text-[11px]"><span>GoFood:</span><span>{formatRp(form.gofood_sales)}</span></div>
                    <div className="flex justify-between text-[11px]"><span>GrabFood:</span><span>{formatRp(form.grabfood_sales)}</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </aside>
        </form>

        {/* History */}
        {canViewAll && reports.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4 text-primary" /> Riwayat Laporan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground text-xs uppercase">
                      <th className="p-3">Tanggal / Shift</th>
                      <th className="p-3">Cabang</th>
                      <th className="p-3">Pelapor</th>
                      <th className="p-3">Total Didapat</th>
                      {canManage && <th className="p-3 text-center">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => {
                      const inc = (r.ending_physical_cash || 0) + (r.ending_qris_cash || 0) - (r.starting_cash || 0);
                      const outletName = outlets.find((o) => o.id === r.outlet_id)?.name || '-';
                      return (
                        <tr key={r.id} className="border-b hover:bg-muted/30">
                          <td className="p-3"><div className="font-bold">{r.report_date}</div><div className="text-xs text-muted-foreground">{r.shift}</div></td>
                          <td className="p-3">{outletName}</td>
                          <td className="p-3">{r.reporter_name || '-'}</td>
                          <td className="p-3 font-bold text-primary">{formatRp(inc)}</td>
                          {canManage && (
                            <td className="p-3 text-center">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus Laporan</AlertDialogTitle>
                                    <AlertDialogDescription>Yakin hapus laporan {r.report_date}?</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteReport(r.id)} className="bg-destructive text-destructive-foreground">Hapus</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
          </TabsContent>

          <TabsContent value="log" className="mt-4">
            <OutletReportRecap mode="log" />
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            <OutletReportRecap mode="stats" />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
