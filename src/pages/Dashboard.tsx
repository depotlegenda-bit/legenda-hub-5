import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Users,
  Calendar as CalendarLucide,
  Check,
  X,
  Clock,
  Wallet,
  MapPin,
} from 'lucide-react';
import { format } from 'date-fns';

interface FinancialSummary {
  report_date: string;
  income: number;
  expenses: number;
}

interface LeaveReq {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  profile_name?: string;
}

interface CashbonReq {
  id: string;
  user_id: string;
  amount: number;
  request_date: string;
  notes: string | null;
  status: string;
  profile_name?: string;
}

interface LowStockItem {
  item_name: string;
  ending_stock: number;
  minimum_threshold: number;
}

interface StaffOverview {
  user_id: string;
  full_name: string;
  discipline_points: number;
  warning_letter_status: string;
  outlet_id: string | null;
}

interface AttendanceLogRow {
  id: string;
  user_id: string;
  log_type: string;
  created_at: string;
  out_of_radius: boolean;
  outlet_id: string | null;
  profile_name?: string;
}

interface Outlet {
  id: string;
  name: string;
}

const ALL = '__all__';

type PeriodPreset = 'today' | '7d' | '30d' | 'this_month' | 'this_year' | 'all' | 'custom';

const PERIOD_LABELS: Record<PeriodPreset, string> = {
  today: 'Hari Ini',
  '7d': '7 Hari Terakhir',
  '30d': '30 Hari Terakhir',
  this_month: 'Bulan Ini',
  this_year: 'Tahun Ini',
  all: 'Semua Waktu',
  custom: 'Rentang Kustom',
};

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};
const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const computeRange = (
  preset: PeriodPreset,
  customFrom?: Date,
  customTo?: Date,
): { from: Date | null; to: Date | null } => {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case '7d': {
      const f = startOfDay(now);
      f.setDate(f.getDate() - 6);
      return { from: f, to: endOfDay(now) };
    }
    case '30d': {
      const f = startOfDay(now);
      f.setDate(f.getDate() - 29);
      return { from: f, to: endOfDay(now) };
    }
    case 'this_month':
      return {
        from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: endOfDay(now),
      };
    case 'this_year':
      return {
        from: startOfDay(new Date(now.getFullYear(), 0, 1)),
        to: endOfDay(now),
      };
    case 'custom':
      return {
        from: customFrom ? startOfDay(customFrom) : null,
        to: customTo ? endOfDay(customTo) : null,
      };
    case 'all':
    default:
      return { from: null, to: null };
  }
};

export default function DashboardPage() {
  const { toast } = useToast();
  const { role } = useAuth();
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<string>(ALL);
  const [period, setPeriod] = useState<PeriodPreset>('today');
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);

  const [financials, setFinancials] = useState<FinancialSummary[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveReq[]>([]);
  const [cashbonRequests, setCashbonRequests] = useState<CashbonReq[]>([]);
  const [lowStock, setLowStock] = useState<LowStockItem[]>([]);
  const [staff, setStaff] = useState<StaffOverview[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLogRow[]>([]);
  const [totals, setTotals] = useState({ totalIncome: 0, totalExpenses: 0 });

  const range = useMemo(
    () => computeRange(period, customFrom, customTo),
    [period, customFrom, customTo],
  );

  // Load outlets once
  useEffect(() => {
    supabase
      .from('outlets')
      .select('id, name')
      .neq('name', 'Manajemen')
      .order('name')
      .then(({ data }) => {
        if (data) setOutlets(data);
      });
  }, []);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOutlet, period, customFrom, customTo]);

  const applyOutletFilter = <T extends { outlet_id?: string | null }>(q: any) => {
    if (selectedOutlet !== ALL) {
      return q.eq('outlet_id', selectedOutlet);
    }
    return q;
  };

  const fetchAll = async () => {
    // Financial data
    let reportsQuery = supabase
      .from('financial_reports')
      .select('id, report_date, daily_offline_income, online_delivery_sales, outlet_id')
      .order('report_date', { ascending: true })
      .limit(366);
    if (selectedOutlet !== ALL) reportsQuery = reportsQuery.eq('outlet_id', selectedOutlet);
    if (range.from) reportsQuery = reportsQuery.gte('report_date', toDateStr(range.from));
    if (range.to) reportsQuery = reportsQuery.lte('report_date', toDateStr(range.to));
    const { data: reports } = await reportsQuery;

    if (reports) {
      const reportIds = reports.map((r) => r.id);
      const { data: expenseData } = await supabase
        .from('expense_items')
        .select('report_id, amount')
        .in('report_id', reportIds.length > 0 ? reportIds : ['none']);

      const expenseByReport = new Map<string, number>();
      expenseData?.forEach((e) => {
        expenseByReport.set(e.report_id, (expenseByReport.get(e.report_id) || 0) + (e.amount || 0));
      });

      const summaries = reports.map((r) => ({
        report_date: r.report_date,
        income: (r.daily_offline_income || 0) + (r.online_delivery_sales || 0),
        expenses: expenseByReport.get(r.id) || 0,
      }));
      setFinancials(summaries);

      const totalIncome = summaries.reduce((s, r) => s + r.income, 0);
      const totalExpenses = summaries.reduce((s, r) => s + r.expenses, 0);
      setTotals({ totalIncome, totalExpenses });
    }

    // Profiles map (for names + outlet filtering of person-based tables)
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, discipline_points, warning_letter_status, outlet_id')
      .order('discipline_points', { ascending: false });

    const profileMap = new Map<string, StaffOverview>();
    allProfiles?.forEach((p) => profileMap.set(p.user_id, p as StaffOverview));

    const filteredStaff = (allProfiles || []).filter((p) =>
      selectedOutlet === ALL ? true : p.outlet_id === selectedOutlet,
    );
    setStaff(filteredStaff as StaffOverview[]);

    const userIdsInOutlet = filteredStaff.map((p) => p.user_id);

    // Leave requests
    let leavesQuery = supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (selectedOutlet !== ALL) {
      leavesQuery = leavesQuery.in('user_id', userIdsInOutlet.length ? userIdsInOutlet : ['none']);
    }
    const { data: leaves } = await leavesQuery;
    if (leaves) {
      setLeaveRequests(
        leaves.map((l) => ({
          ...l,
          profile_name: profileMap.get(l.user_id)?.full_name || 'Unknown',
        })),
      );
    }

    // Cashbon requests
    let cashbonQuery = supabase
      .from('cashbon')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (selectedOutlet !== ALL) {
      cashbonQuery = cashbonQuery.in(
        'user_id',
        userIdsInOutlet.length ? userIdsInOutlet : ['none'],
      );
    }
    const { data: cashbons } = await cashbonQuery;
    if (cashbons) {
      setCashbonRequests(
        cashbons.map((c) => ({
          ...c,
          profile_name: profileMap.get(c.user_id)?.full_name || 'Unknown',
        })),
      );
    }

    // Low stock
    let invQuery = supabase
      .from('inventory')
      .select('*')
      .order('record_date', { ascending: false });
    if (selectedOutlet !== ALL) invQuery = invQuery.eq('outlet_id', selectedOutlet);
    const { data: inventory } = await invQuery;

    if (inventory) {
      const latestByItem = new Map<string, any>();
      inventory.forEach((row) => {
        if (!latestByItem.has(row.item_name)) latestByItem.set(row.item_name, row);
      });
      setLowStock(
        Array.from(latestByItem.values()).filter(
          (item) => (item.ending_stock ?? 0) <= (item.minimum_threshold ?? 5),
        ),
      );
    }

    // Attendance logs (recent 20)
    let logsQuery = supabase
      .from('attendance_logs')
      .select('id, user_id, log_type, created_at, out_of_radius, outlet_id')
      .order('created_at', { ascending: false })
      .limit(50);
    if (selectedOutlet !== ALL) logsQuery = logsQuery.eq('outlet_id', selectedOutlet);
    if (range.from) logsQuery = logsQuery.gte('created_at', range.from.toISOString());
    if (range.to) logsQuery = logsQuery.lte('created_at', range.to.toISOString());
    const { data: logs } = await logsQuery;
    if (logs) {
      setAttendanceLogs(
        logs.map((l) => ({
          ...l,
          profile_name: profileMap.get(l.user_id)?.full_name || 'Unknown',
        })),
      );
    }
  };

  const handleLeaveAction = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('leave_requests').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Berhasil',
        description: `Cuti ${status === 'approved' ? 'disetujui' : 'ditolak'}.`,
      });
      setLeaveRequests((prev) => prev.filter((l) => l.id !== id));
    }
  };

  const handleCashbonAction = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('cashbon').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Berhasil',
        description: `Cashbon ${status === 'approved' ? 'disetujui' : 'ditolak'}.`,
      });
      setCashbonRequests((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const formatRp = (val: number) => `Rp ${val.toLocaleString('id-ID')}`;

  const chartData = financials.map((f) => ({
    date: format(new Date(f.report_date), 'dd/MM'),
    Pendapatan: f.income,
    Pengeluaran: f.expenses,
  }));

  const outletName =
    selectedOutlet === ALL
      ? 'Semua Cabang'
      : outlets.find((o) => o.id === selectedOutlet)?.name || 'Cabang';

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold">Dashboard Management</h1>
            <p className="text-muted-foreground mt-1">
              Ringkasan operasional Dua Legenda Grup — {outletName}
            </p>
          </div>

          {/* Period selector */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodPreset)}>
              <SelectTrigger className="w-[180px]">
                <CalendarLucide className="w-4 h-4 mr-2 opacity-70" />
                <SelectValue placeholder="Pilih periode" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {PERIOD_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {period === 'custom' && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-[150px] justify-start text-left font-normal',
                        !customFrom && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customFrom ? format(customFrom, 'dd MMM yyyy') : 'Dari'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customFrom}
                      onSelect={setCustomFrom}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-[150px] justify-start text-left font-normal',
                        !customTo && 'text-muted-foreground',
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customTo ? format(customTo, 'dd MMM yyyy') : 'Sampai'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={customTo}
                      onSelect={setCustomTo}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>

        {/* Period summary line */}
        <p className="text-xs text-muted-foreground -mt-2">
          Periode: <span className="font-medium text-foreground">{PERIOD_LABELS[period]}</span>
          {range.from && range.to && (
            <>
              {' '}
              ({format(range.from, 'dd MMM yyyy')} — {format(range.to, 'dd MMM yyyy')})
            </>
          )}
        </p>

        {/* Outlet Tabs */}
        {outlets.length > 0 && (
          <Tabs value={selectedOutlet} onValueChange={setSelectedOutlet} className="w-full">
            <TabsList className="flex flex-wrap gap-1 h-auto justify-start w-full">
              <TabsTrigger value={ALL} className="flex-none whitespace-normal text-left h-auto py-1.5">Semua Cabang</TabsTrigger>
              {outlets.map((o) => (
                <TabsTrigger key={o.id} value={o.id} className="flex-none whitespace-normal text-left h-auto py-1.5">
                  {o.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Pendapatan</p>
                  <p className="font-heading text-xl font-bold text-primary">
                    {formatRp(totals.totalIncome)}
                  </p>
                </div>
                <div className="p-2 rounded-full bg-primary/10">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
                  <p className="font-heading text-xl font-bold text-destructive">
                    {formatRp(totals.totalExpenses)}
                  </p>
                </div>
                <div className="p-2 rounded-full bg-destructive/10">
                  <TrendingDown className="w-5 h-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Stok Rendah</p>
                  <p className="font-heading text-xl font-bold text-warning">
                    {lowStock.length} item
                  </p>
                </div>
                <div className="p-2 rounded-full bg-warning/10">
                  <ShoppingCart className="w-5 h-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pending (Cuti + Cashbon)</p>
                  <p className="font-heading text-xl font-bold text-secondary">
                    {leaveRequests.length + cashbonRequests.length}
                  </p>
                </div>
                <div className="p-2 rounded-full bg-secondary/10">
                  <CalendarLucide className="w-5 h-5 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart */}
        {chartData.length > 0 && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Tren Pendapatan vs Pengeluaran</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="Pendapatan" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar
                      dataKey="Pengeluaran"
                      fill="hsl(var(--destructive))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending requests row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leave Requests */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarLucide className="w-5 h-5" />
                Pengajuan Cuti Pending
                {leaveRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {leaveRequests.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leaveRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada pengajuan pending.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {leaveRequests.map((lr) => (
                    <div key={lr.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{lr.profile_name}</span>
                        <Badge variant="outline">Pending</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(lr.start_date), 'dd MMM yyyy')} —{' '}
                        {format(new Date(lr.end_date), 'dd MMM yyyy')}
                      </p>
                      <p className="text-sm">{lr.reason}</p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleLeaveAction(lr.id, 'approved')}>
                          <Check className="w-3 h-3 mr-1" /> Setujui
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLeaveAction(lr.id, 'rejected')}
                        >
                          <X className="w-3 h-3 mr-1" /> Tolak
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cashbon Requests */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                Pengajuan Cashbon Pending
                {cashbonRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {cashbonRequests.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cashbonRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada pengajuan cashbon.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {cashbonRequests.map((cb) => (
                    <div key={cb.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{cb.profile_name}</span>
                        <Badge variant="outline">{formatRp(cb.amount)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(cb.request_date), 'dd MMM yyyy')}
                      </p>
                      {cb.notes && <p className="text-sm">{cb.notes}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleCashbonAction(cb.id, 'approved')}>
                          <Check className="w-3 h-3 mr-1" /> Setujui
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCashbonAction(cb.id, 'rejected')}
                        >
                          <X className="w-3 h-3 mr-1" /> Tolak
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Attendance log + Low stock */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Log Recap */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Rekap Log Absensi Terbaru
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendanceLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada log absensi.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {attendanceLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{log.profile_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), 'dd MMM yyyy HH:mm')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {log.out_of_radius && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <MapPin className="w-3 h-3" /> Luar radius
                          </Badge>
                        )}
                        <Badge
                          variant={log.log_type === 'check_in' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {log.log_type === 'check_in' ? 'Check-in' : 'Check-out'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Daftar Belanja Besok
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground">Semua stok mencukupi.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {lowStock.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <span className="text-sm font-medium">{item.item_name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">
                          Sisa: {item.ending_stock}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          min: {item.minimum_threshold}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Staff Overview */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5" />
              Ikhtisar Karyawan {selectedOutlet !== ALL ? `— ${outletName}` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {staff.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data karyawan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Nama</th>
                      <th className="pb-2 font-medium">Poin Disiplin</th>
                      <th className="pb-2 font-medium">Status SP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((s, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="py-2.5">{s.full_name || '-'}</td>
                        <td className="py-2.5">
                          <Badge variant={s.discipline_points > 3 ? 'destructive' : 'secondary'}>
                            {s.discipline_points}
                          </Badge>
                        </td>
                        <td className="py-2.5">{s.warning_letter_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
