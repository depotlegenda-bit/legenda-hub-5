import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, startOfWeek } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import {
  PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line,
  BarChart, Bar, XAxis, Tooltip,
} from 'recharts';
import {
  Megaphone, Plus, Search, Filter, Calendar as CalendarIcon, ExternalLink,
  Heart, MessageCircle, Bookmark, Share2, Eye, MousePointerClick,
  Instagram, Youtube, Facebook, Linkedin, Twitter, Music2, Globe,
  TrendingUp, DollarSign, Percent, Zap, X as XIcon, Archive,
  CheckCircle2, ChevronsUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { usePersistentDraft } from '@/hooks/usePersistentDraft';
import { cn } from '@/lib/utils';

// ---------- Constants ----------
const TEAL = '#22C55E';
const TEAL_DARK = '#16A34A';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'tiktok', label: 'TikTok', icon: Music2 },
  { value: 'youtube', label: 'YouTube', icon: Youtube },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'x', label: 'X', icon: Twitter },
  { value: 'other', label: 'Other', icon: Globe },
] as const;

const STATUSES = [
  { value: 'idea', label: 'Ide', cls: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30' },
  { value: 'briefing', label: 'Briefing', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  { value: 'production', label: 'Production', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  { value: 'posted', label: 'Posted', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { value: 'archived', label: 'Archived', cls: 'bg-muted text-muted-foreground border-border' },
] as const;

const CONTENT_TYPES = [
  { value: 'product_review', label: 'Product Review' },
  { value: 'behind_the_scenes', label: 'Behind the Scenes' },
  { value: 'promo', label: 'Promo' },
  { value: 'educational', label: 'Educational' },
  { value: 'user_story', label: 'User Story' },
] as const;

const CHART_COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#A855F7', '#EC4899', '#06B6D4', '#94A3B8'];

const platformMeta = (p: string) => PLATFORMS.find((x) => x.value === p) ?? PLATFORMS[6];
const statusMeta = (s: string) => STATUSES.find((x) => x.value === s) ?? STATUSES[0];
const contentTypeLabel = (c: string) => CONTENT_TYPES.find((x) => x.value === c)?.label ?? c;

const fmtIDR = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;
const fmtNum = (n: number) => (n || 0).toLocaleString('id-ID');

const totalEngagement = (r: any) =>
  (r.engagement_likes || 0) + (r.engagement_comments || 0) + (r.engagement_saves || 0) +
  (r.engagement_shares || 0) + (r.engagement_views || 0) + (r.engagement_link_clicks || 0);

const cpeOf = (r: any) => {
  const t = totalEngagement(r);
  return t > 0 ? (r.rate_card || 0) / t : 0;
};

// ---------- Multi-select chip dropdown ----------
function MultiSelect({
  label, options, value, onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between min-w-[140px]">
          <span className="text-sm">
            {label}{value.length ? ` (${value.length})` : ''}
          </span>
          <ChevronsUpDown className="w-4 h-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="max-h-64 overflow-auto space-y-1">
          {options.map((o) => (
            <label
              key={o.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
            >
              <Checkbox checked={value.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
              <span className="text-sm">{o.label}</span>
            </label>
          ))}
        </div>
        {value.length > 0 && (
          <Button
            variant="ghost" size="sm" className="w-full mt-1 text-xs"
            onClick={() => onChange([])}
          >Reset</Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------- Main page ----------
export default function ContentPlanPage() {
  const { user, role, isCustom } = useAuth() as any;
  const { getPerm } = useMenuPermissions();
  const { toast } = useToast();
  const canEdit =
    role === 'admin' || role === 'management' || role === 'pic' ||
    (role ? getPerm(role, 'marketing.content', 'can_create', isCustom) : false);

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [fPlatforms, setFPlatforms] = useState<string[]>([]);
  const [fStatuses, setFStatuses] = useState<string[]>([]);
  const [fTypes, setFTypes] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  // Selection + sort
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<'date' | 'rate' | 'cpe'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Performance modal
  const [perfRow, setPerfRow] = useState<any | null>(null);
  const [perfData, setPerfData] = useState<any>({});

  // Form draft
  const emptyForm = {
    title: '', description: '', platform: 'instagram',
    scheduled_date: '', status: 'idea', rate_card: '',
    content_type: 'product_review', pillar_title: '', posted_url: '',
    target_views: '', target_leads: '',
  };
  const draft = usePersistentDraft('draft:content-plan-v2', emptyForm);
  const [form, setForm] = useState<any>(draft.value);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { draft.setValue(form); }, [draft, form]);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('content_plans')
      .select('*')
      .order('scheduled_date', { ascending: false });
    if (data) setRecords(data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ---------- Filtering ----------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (q && !(`${r.title || ''} ${r.pillar_title || ''}`.toLowerCase().includes(q))) return false;
      if (fPlatforms.length && !fPlatforms.includes(r.platform)) return false;
      if (fStatuses.length && !fStatuses.includes(r.status)) return false;
      if (fTypes.length && !fTypes.includes(r.content_type || 'product_review')) return false;
      if (r.scheduled_date) {
        const d = parseISO(r.scheduled_date);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      } else if (dateFrom || dateTo) return false;
      return true;
    });
  }, [records, search, fPlatforms, fStatuses, fTypes, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let av = 0, bv = 0;
      if (sortKey === 'date') {
        av = a.scheduled_date ? new Date(a.scheduled_date).getTime() : 0;
        bv = b.scheduled_date ? new Date(b.scheduled_date).getTime() : 0;
      } else if (sortKey === 'rate') {
        av = a.rate_card || 0; bv = b.rate_card || 0;
      } else { av = cpeOf(a); bv = cpeOf(b); }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // ---------- Aggregates ----------
  const stats = useMemo(() => {
    const posted = filtered.filter((r) => r.status === 'posted');
    const totalSpend = posted.reduce((s, r) => s + (r.rate_card || 0), 0);

    // Avg engagement rate: total engagement / total views * 100
    const totalEng = posted.reduce((s, r) => s + totalEngagement(r), 0);
    const totalViews = posted.reduce((s, r) => s + (r.engagement_views || 0), 0);
    const avgEngRate = totalViews > 0 ? (totalEng / totalViews) * 100 : 0;

    // Per-platform engagement (for bar)
    const perPlatform: Record<string, { eng: number; views: number; count: number }> = {};
    filtered.forEach((r) => {
      const p = r.platform || 'other';
      if (!perPlatform[p]) perPlatform[p] = { eng: 0, views: 0, count: 0 };
      perPlatform[p].eng += totalEngagement(r);
      perPlatform[p].views += r.engagement_views || 0;
      perPlatform[p].count += 1;
    });
    const platformBar = Object.entries(perPlatform).map(([p, v]) => ({
      name: platformMeta(p).label.slice(0, 3),
      rate: v.views > 0 ? +(v.eng / v.views * 100).toFixed(1) : 0,
    }));
    const distribution = Object.entries(perPlatform).map(([p, v]) => ({
      name: platformMeta(p).label, value: v.count,
    }));

    // CPE
    const cpes = posted.map(cpeOf).filter((c) => c > 0);
    const cpeMin = cpes.length ? Math.min(...cpes) : 0;
    const cpeMax = cpes.length ? Math.max(...cpes) : 0;
    const cpeAvg = cpes.length ? cpes.reduce((a, b) => a + b, 0) / cpes.length : 0;

    // Spend sparkline (per week, last 8 weeks of posted items)
    const weekMap: Record<string, number> = {};
    posted.forEach((r) => {
      if (!r.scheduled_date) return;
      const wk = format(startOfWeek(parseISO(r.scheduled_date), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      weekMap[wk] = (weekMap[wk] || 0) + (r.rate_card || 0);
    });
    const spark = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([wk, v]) => ({ wk, v }));

    return { totalSpend, avgEngRate, platformBar, distribution, cpeMin, cpeMax, cpeAvg, spark };
  }, [filtered]);

  // ---------- Actions ----------
  const resetForm = () => { setForm(emptyForm); draft.clear(emptyForm); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from('content_plans').insert({
      title: form.title,
      description: form.description,
      platform: form.platform,
      scheduled_date: form.scheduled_date || null,
      status: form.status,
      rate_card: parseInt(String(form.rate_card).replace(/\D/g, '')) || 0,
      content_type: form.content_type,
      pillar_title: form.pillar_title,
      posted_url: form.posted_url,
      target_views: parseInt(form.target_views) || 0,
      target_leads: parseInt(form.target_leads) || 0,
      created_by: user.id,
    });
    if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Berhasil', description: 'Content plan ditambahkan.' });
      resetForm();
      fetchData();
    }
    setSubmitting(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('content_plans').update({ status }).eq('id', id);
    if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    else fetchData();
  };

  const batchUpdate = async (status: string) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const { error } = await supabase.from('content_plans').update({ status }).in('id', ids);
    if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Berhasil', description: `${ids.length} konten diupdate.` });
      setSelected(new Set());
      fetchData();
    }
  };

  const openPerf = (r: any) => {
    setPerfRow(r);
    setPerfData({
      likes: r.engagement_likes || 0,
      comments: r.engagement_comments || 0,
      saves: r.engagement_saves || 0,
      shares: r.engagement_shares || 0,
      views: r.engagement_views || 0,
      link_clicks: r.engagement_link_clicks || 0,
    });
  };

  const savePerf = async () => {
    if (!perfRow) return;
    const { error } = await supabase.from('content_plans').update({
      engagement_likes: parseInt(perfData.likes) || 0,
      engagement_comments: parseInt(perfData.comments) || 0,
      engagement_saves: parseInt(perfData.saves) || 0,
      engagement_shares: parseInt(perfData.shares) || 0,
      engagement_views: parseInt(perfData.views) || 0,
      engagement_link_clicks: parseInt(perfData.link_clicks) || 0,
    }).eq('id', perfRow.id);
    if (error) toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Berhasil', description: 'Data performance disimpan.' });
      setPerfRow(null);
      fetchData();
    }
  };

  const toggleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const allFilteredSelected = sorted.length > 0 && sorted.every((r) => selected.has(r.id));

  const cpeColorClass = (cpe: number) => {
    if (!cpe || !stats.cpeAvg) return '';
    if (cpe <= stats.cpeAvg * 0.7) return 'text-emerald-600 dark:text-emerald-400 font-semibold';
    if (cpe >= stats.cpeAvg * 1.3) return 'text-red-500 dark:text-red-400 font-semibold';
    return '';
  };

  // ---------- Render ----------
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: TEAL, color: 'white' }}>
                <Megaphone className="w-5 h-5" />
              </span>
              Marketing Content Command Center
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Plan, track, and optimize konten marketing lintas platform.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-muted-foreground">Logged in as</p>
              <p className="text-sm font-medium capitalize">{role || 'guest'}</p>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                 style={{ background: TEAL }}>
              {(user?.email || 'U').slice(0, 1).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="glass-card">
          <CardContent className="p-4 flex flex-wrap gap-2 items-center">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="text-sm">
                  <CalendarIcon className="w-4 h-4 mr-1" />
                  {dateFrom || dateTo
                    ? `${dateFrom ? format(dateFrom, 'dd MMM') : '...'} – ${dateTo ? format(dateTo, 'dd MMM') : '...'}`
                    : 'Date range'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: dateFrom, to: dateTo }}
                  onSelect={(r: any) => { setDateFrom(r?.from); setDateTo(r?.to); }}
                  numberOfMonths={2}
                  className={cn('p-3 pointer-events-auto')}
                />
                {(dateFrom || dateTo) && (
                  <div className="p-2 border-t">
                    <Button variant="ghost" size="sm" className="w-full"
                            onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                      Clear
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <MultiSelect label="Platform" options={[...PLATFORMS]} value={fPlatforms} onChange={setFPlatforms} />
            <MultiSelect label="Status" options={[...STATUSES]} value={fStatuses} onChange={setFStatuses} />
            <MultiSelect label="Type" options={[...CONTENT_TYPES]} value={fTypes} onChange={setFTypes} />

            <div className="relative ml-auto flex-1 min-w-[180px] max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                     placeholder="Cari judul / pillar..." className="pl-9" />
            </div>
          </CardContent>
        </Card>

        {/* Summary widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Spend */}
          <Card className="glass-card border-l-4" style={{ borderLeftColor: TEAL }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Spend</p>
                <DollarSign className="w-4 h-4" style={{ color: TEAL }} />
              </div>
              <p className="text-2xl font-bold">{fmtIDR(stats.totalSpend)}</p>
              <div className="h-10 mt-2">
                {stats.spark.length > 1 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.spark}>
                      <Line type="monotone" dataKey="v" stroke={TEAL} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Avg engagement rate */}
          <Card className="glass-card border-l-4" style={{ borderLeftColor: '#3B82F6' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg Engagement Rate</p>
                <Percent className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold">{stats.avgEngRate.toFixed(2)}%</p>
              <div className="h-10 mt-2">
                {stats.platformBar.length > 0 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.platformBar}>
                      <XAxis dataKey="name" hide />
                      <Tooltip cursor={{ fill: 'transparent' }} />
                      <Bar dataKey="rate" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Distribution */}
          <Card className="glass-card border-l-4" style={{ borderLeftColor: '#A855F7' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Content Distribution</p>
                <TrendingUp className="w-4 h-4 text-purple-500" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-20 h-20">
                  {stats.distribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.distribution} dataKey="value" innerRadius={20} outerRadius={36} paddingAngle={2}>
                          {stats.distribution.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="w-full h-full rounded-full bg-muted" />}
                </div>
                <div className="flex-1 space-y-1 text-xs">
                  {stats.distribution.slice(0, 4).map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="truncate">{d.name}</span>
                      <span className="ml-auto font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CPE */}
          <Card className="glass-card border-l-4" style={{ borderLeftColor: '#F59E0B' }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Efficiency (CPE)</p>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Lowest</span>
                  <span className="font-semibold text-emerald-600">{fmtIDR(stats.cpeMin)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Average</span>
                  <span className="font-semibold">{fmtIDR(stats.cpeAvg)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Highest</span>
                  <span className="font-semibold text-red-500">{fmtIDR(stats.cpeMax)}</span></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add new content accordion */}
        {canEdit && (
          <Accordion type="single" collapsible className="rounded-lg border bg-card">
            <AccordionItem value="add" className="border-0">
              <AccordionTrigger className="px-4 hover:no-underline">
                <span className="flex items-center gap-2 font-semibold">
                  <Plus className="w-4 h-4" style={{ color: TEAL }} /> Add New Content Plan
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Judul</Label>
                    <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tanggal Jadwal</Label>
                    <Input type="date" value={form.scheduled_date}
                           onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Content Type</Label>
                    <Select value={form.content_type} onValueChange={(v) => setForm({ ...form, content_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONTENT_TYPES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Pillar / Campaign Title</Label>
                    <Input value={form.pillar_title}
                           onChange={(e) => setForm({ ...form, pillar_title: e.target.value })}
                           placeholder="Mis. Ramadan 2026" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rate Card</Label>
                    <Input
                      inputMode="numeric" placeholder="Rp 0"
                      value={form.rate_card ? `Rp ${(parseInt(String(form.rate_card).replace(/\D/g, '')) || 0).toLocaleString('id-ID')}` : ''}
                      onChange={(e) => setForm({ ...form, rate_card: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Posted URL</Label>
                    <Input value={form.posted_url} placeholder="https://..."
                           onChange={(e) => setForm({ ...form, posted_url: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Target Views</Label>
                    <Input type="number" min={0} value={form.target_views}
                           onChange={(e) => setForm({ ...form, target_views: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Target Leads</Label>
                    <Input type="number" min={0} value={form.target_leads}
                           onChange={(e) => setForm({ ...form, target_leads: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 space-y-2">
                    <Label>Deskripsi</Label>
                    <Textarea value={form.description}
                              onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={resetForm}>Reset</Button>
                    <Button type="submit" disabled={submitting}
                            className="text-white" style={{ background: TEAL }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = TEAL_DARK)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = TEAL)}>
                      <Plus className="w-4 h-4 mr-1" /> Tambah
                    </Button>
                  </div>
                </form>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {/* Batch toolbar */}
        {selected.size > 0 && canEdit && (
          <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 px-4 py-2 rounded-lg shadow-md"
               style={{ background: TEAL, color: 'white' }}>
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">{selected.size} dipilih</span>
            <Button size="sm" variant="secondary" onClick={() => batchUpdate('posted')}>
              Set → Posted
            </Button>
            <Button size="sm" variant="secondary" onClick={() => batchUpdate('archived')}>
              <Archive className="w-3 h-3 mr-1" /> Archive
            </Button>
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/20 ml-auto"
                    onClick={() => setSelected(new Set())}>
              <XIcon className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Table */}
        <Card className="glass-card overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Content Calendar ({sorted.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-y border-border">
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    {canEdit && (
                      <th className="p-3 w-10">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={(v) => {
                            if (v) setSelected(new Set(sorted.map((r) => r.id)));
                            else setSelected(new Set());
                          }}
                        />
                      </th>
                    )}
                    <th className="p-3 cursor-pointer" onClick={() => toggleSort('date')}>
                      <span className="inline-flex items-center gap-1">Scheduled
                        {sortKey === 'date' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </span>
                    </th>
                    <th className="p-3">Title & Pillar</th>
                    <th className="p-3">Platform</th>
                    <th className="p-3 cursor-pointer" onClick={() => toggleSort('rate')}>
                      <span className="inline-flex items-center gap-1">Rate Card
                        {sortKey === 'rate' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </span>
                    </th>
                    <th className="p-3">Status</th>
                    {canEdit && <th className="p-3">Update</th>}
                    <th className="p-3">Link</th>
                    <th className="p-3 min-w-[200px]">Engagement</th>
                    <th className="p-3 cursor-pointer" onClick={() => toggleSort('cpe')}>
                      <span className="inline-flex items-center gap-1">CPE
                        {sortKey === 'cpe' && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r, idx) => {
                    const Icon = platformMeta(r.platform).icon;
                    const sm = statusMeta(r.status);
                    const cpe = cpeOf(r);
                    return (
                      <tr key={r.id}
                          className={cn(
                            'border-b border-border/50 hover:bg-muted/40 transition-colors',
                            idx % 2 === 1 && 'bg-muted/20',
                            selected.has(r.id) && 'bg-emerald-500/5'
                          )}>
                        {canEdit && (
                          <td className="p-3">
                            <Checkbox
                              checked={selected.has(r.id)}
                              onCheckedChange={(v) => {
                                const ns = new Set(selected);
                                if (v) ns.add(r.id); else ns.delete(r.id);
                                setSelected(ns);
                              }}
                            />
                          </td>
                        )}
                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                          {r.scheduled_date
                            ? format(parseISO(r.scheduled_date), 'dd-MMM-yyyy', { locale: idLocale })
                            : '-'}
                        </td>
                        <td className="p-3">
                          <p className="font-medium leading-tight">{r.title}</p>
                          {r.pillar_title && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">📌 {r.pillar_title}</p>
                          )}
                          {r.content_type && (
                            <p className="text-[10px] text-muted-foreground/70">{contentTypeLabel(r.content_type)}</p>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <Icon className="w-4 h-4" style={{ color: TEAL }} />
                            {platformMeta(r.platform).label}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap">{fmtIDR(r.rate_card || 0)}</td>
                        <td className="p-3">
                          <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs border', sm.cls)}>
                            {sm.label}
                          </span>
                        </td>
                        {canEdit && (
                          <td className="p-3">
                            <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                              <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                        )}
                        <td className="p-3">
                          {r.posted_url ? (
                            <a href={r.posted_url} target="_blank" rel="noreferrer"
                               className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-muted"
                               style={{ color: TEAL }}>
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="p-3">
                          <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px] text-muted-foreground mb-2">
                            <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{fmtNum(r.engagement_likes)}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{fmtNum(r.engagement_comments)}</span>
                            <span className="flex items-center gap-1"><Bookmark className="w-3 h-3" />{fmtNum(r.engagement_saves)}</span>
                            <span className="flex items-center gap-1"><Share2 className="w-3 h-3" />{fmtNum(r.engagement_shares)}</span>
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{fmtNum(r.engagement_views)}</span>
                            <span className="flex items-center gap-1"><MousePointerClick className="w-3 h-3" />{fmtNum(r.engagement_link_clicks)}</span>
                          </div>
                          {canEdit && (
                            <Button size="sm" className="h-7 text-[11px] text-white"
                                    style={{ background: TEAL }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = TEAL_DARK)}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = TEAL)}
                                    onClick={() => openPerf(r)}>
                              Input Performance
                            </Button>
                          )}
                        </td>
                        <td className={cn('p-3 whitespace-nowrap', cpeColorClass(cpe))}>
                          {cpe > 0 ? fmtIDR(cpe) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 10 : 8} className="p-12 text-center text-muted-foreground">
                        {loading ? 'Memuat...' : 'Tidak ada konten yang cocok dengan filter.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance modal */}
      <Dialog open={!!perfRow} onOpenChange={(o) => !o && setPerfRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Input Performance — {perfRow?.title}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-2">
            {[
              { k: 'likes', label: 'Likes', Icon: Heart },
              { k: 'comments', label: 'Comments', Icon: MessageCircle },
              { k: 'saves', label: 'Saves', Icon: Bookmark },
              { k: 'shares', label: 'Shares', Icon: Share2 },
              { k: 'views', label: 'Views', Icon: Eye },
              { k: 'link_clicks', label: 'Link Clicks', Icon: MousePointerClick },
            ].map(({ k, label, Icon }) => (
              <div key={k} className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Icon className="w-3.5 h-3.5" style={{ color: TEAL }} />{label}
                </Label>
                <Input type="number" min={0} value={perfData[k] ?? 0}
                       onChange={(e) => setPerfData({ ...perfData, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPerfRow(null)}>Batal</Button>
            <Button className="text-white" style={{ background: TEAL }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = TEAL_DARK)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = TEAL)}
                    onClick={savePerf}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
