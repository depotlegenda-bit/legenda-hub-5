import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Save, Pencil, Trash2, X } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Outlet { id: string; name: string }
interface Profile { user_id: string; full_name: string; job_title?: string | null; outlet_id?: string | null }

const CATEGORIES: { key: string; label: string; weight: number }[] = [
  { key: 'disiplin',   label: 'Disiplin & Kehadiran',     weight: 20 },
  { key: 'sop',        label: 'Ketaatan SOP',             weight: 20 },
  { key: 'kecepatan',  label: 'Kecepatan & Ketepatan',    weight: 15 },
  { key: 'kualitas',   label: 'Kualitas Produk',          weight: 15 },
  { key: 'kerjasama',  label: 'Kerja Sama Tim',           weight: 10 },
  { key: 'attitude',   label: 'Attitude & Etika',         weight: 10 },
  { key: 'inisiatif',  label: 'Inisiatif & Tanggung Jawab', weight: 10 },
];

const MONTHS = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember',
];

const ALL = '__all__';

export default function PerformanceReviewPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const { getPerm, customRoles } = useMenuPermissions();
  const isCustom = !!role && customRoles.some((c) => c.code === role);
  const canManage =
    role === 'admin' ||
    role === 'management' ||
    role === 'pic' ||
    (role ? getPerm(role, 'personalia/performance', 'can_create', isCustom) : false);
  const canEdit =
    role === 'admin' ||
    role === 'management' ||
    (role ? getPerm(role, 'personalia/performance', 'can_edit', isCustom) : false);
  const canDelete =
    role === 'admin' ||
    role === 'management' ||
    (role ? getPerm(role, 'personalia/performance', 'can_delete', isCustom) : false);

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState<string>(ALL);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [reviewerName, setReviewerName] = useState('');

  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));
  const [scores, setScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [records, setRecords] = useState<any[]>([]);

  // Initial load
  useEffect(() => {
    (async () => {
      const [{ data: o }, { data: p }, { data: r }] = await Promise.all([
        supabase.from('outlets').select('id, name').neq('name', 'Manajemen').order('name'),
        supabase.from('profiles').select('user_id, full_name, job_title, outlet_id').order('full_name'),
        supabase.from('performance_reviews').select('*').order('created_at', { ascending: false }).limit(200),
      ]);
      if (o) setOutlets(o);
      if (p) setProfiles(p);
      if (r) setRecords(r);

      if (user?.id) {
        const { data: me } = await supabase
          .from('profiles').select('full_name').eq('user_id', user.id).maybeSingle();
        setReviewerName(me?.full_name || user.email || '');
      }
    })();
  }, [user?.id]);

  const reloadRecords = async () => {
    const { data: r } = await supabase
      .from('performance_reviews').select('*')
      .order('created_at', { ascending: false }).limit(200);
    if (r) setRecords(r);
  };

  // Build set of user_ids already reviewed for the current period (excluding the one being edited)
  const reviewedForPeriod = useMemo(() => {
    if (!month || !year) return new Set<string>();
    const period = `${month} ${year}`;
    return new Set(
      records
        .filter((r: any) => r.review_period === period && r.id !== editingId)
        .map((r: any) => r.user_id),
    );
  }, [records, month, year, editingId]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (outletId !== ALL && p.outlet_id !== outletId) return false;
      if (reviewedForPeriod.has(p.user_id)) return false;
      return true;
    });
  }, [profiles, outletId, reviewedForPeriod]);

  // Reset employee if no longer in filtered list
  useEffect(() => {
    if (employeeId && !filteredProfiles.find((p) => p.user_id === employeeId)) {
      setEmployeeId('');
    }
  }, [filteredProfiles, employeeId]);

  // Compute weighted total
  const totalScore = useMemo(() => {
    let total = 0;
    for (const c of CATEGORIES) {
      const s = scores[c.key];
      if (typeof s === 'number' && s >= 1 && s <= 5) {
        total += (s / 5) * c.weight;
      }
    }
    return Math.round(total);
  }, [scores]);

  const setScore = (key: string, raw: string) => {
    if (raw === '') {
      const next = { ...scores };
      delete next[key];
      setScores(next);
      return;
    }
    const n = Math.max(1, Math.min(5, parseFloat(raw)));
    if (!isNaN(n)) setScores({ ...scores, [key]: n });
  };

  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.user_id, p])),
    [profiles],
  );

  const resetForm = () => {
    setEditingId(null);
    setEmployeeId('');
    setMonth('');
    setScores({});
  };

  const handleEdit = (r: any) => {
    setEditingId(r.id);
    setEmployeeId(r.user_id);
    const parts = (r.review_period || '').split(' ');
    setMonth(parts[0] || '');
    setYear(parts[1] || String(new Date().getFullYear()));
    const cats = (r.categories || {}) as Record<string, { score: number }>;
    const next: Record<string, number> = {};
    Object.entries(cats).forEach(([k, v]) => {
      if (typeof v?.score === 'number') next[k] = v.score;
    });
    setScores(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('performance_reviews').delete().eq('id', deleteId);
    if (error) {
      toast({ title: 'Gagal hapus', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Penilaian dihapus.' });
      if (editingId === deleteId) resetForm();
      await reloadRecords();
    }
    setDeleteId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !employeeId || !month || !year) {
      toast({ title: 'Lengkapi data', description: 'Pilih karyawan, bulan, dan tahun.', variant: 'destructive' });
      return;
    }
    const filledCount = CATEGORIES.filter((c) => typeof scores[c.key] === 'number').length;
    if (filledCount < CATEGORIES.length) {
      toast({ title: 'Skor belum lengkap', description: 'Isi semua 7 kategori (skala 1-5).', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const period = `${month} ${year}`;
    const breakdown: Record<string, { label: string; weight: number; score: number }> = {};
    CATEGORIES.forEach((c) => {
      breakdown[c.key] = { label: c.label, weight: c.weight, score: scores[c.key] };
    });

    let error: any = null;
    if (editingId) {
      const res = await supabase.from('performance_reviews').update({
        user_id: employeeId,
        review_period: period,
        score: totalScore,
        categories: breakdown,
      }).eq('id', editingId);
      error = res.error;
    } else {
      const res = await supabase.from('performance_reviews').insert({
        user_id: employeeId,
        reviewer_id: user.id,
        review_period: period,
        score: totalScore,
        categories: breakdown,
      });
      error = res.error;
    }

    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: 'Berhasil',
        description: `${editingId ? 'Perubahan' : 'Penilaian'} ${period} tersimpan (skor ${totalScore}).`,
      });
      resetForm();
      await reloadRecords();
    }
    setSubmitting(false);
  };

  const scoreVariant = (s: number): 'default' | 'secondary' | 'destructive' => {
    if (s >= 80) return 'default';
    if (s >= 60) return 'secondary';
    return 'destructive';
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
          <ClipboardList className="w-7 h-7" /> Penilaian Kinerja
        </h1>

        {/* Outlet filter tabs */}
        <Card className="glass-card">
          <CardContent className="p-4">
            <Tabs value={outletId} onValueChange={setOutletId}>
              <TabsList className="flex-wrap gap-x-2 h-auto bg-transparent border-b border-border w-full justify-start rounded-none p-0">
                <TabsTrigger
                  value={ALL}
                  className="flex-none whitespace-normal text-left h-auto data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                >
                  Semua Outlet
                </TabsTrigger>
                {outlets.map((o) => (
                  <TabsTrigger
                    key={o.id}
                    value={o.id}
                    className="flex-none whitespace-normal text-left h-auto data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    {o.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {canManage && (
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base font-bold tracking-wide uppercase">
                  {editingId ? 'Edit Penilaian' : 'Penilaian Kinerja'}
                </CardTitle>
                {editingId && (
                  <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                    <X className="w-4 h-4 mr-1" /> Batal Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Periode */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Periode Penilaian
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={month} onValueChange={setMonth}>
                      <SelectTrigger><SelectValue placeholder="-- Bulan --" /></SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={2020}
                      max={2100}
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder="Tahun"
                    />
                  </div>
                </div>

                {/* Karyawan */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Karyawan
                  </Label>
                  <Select value={employeeId} onValueChange={setEmployeeId} disabled={!!editingId}>
                    <SelectTrigger><SelectValue placeholder={month && year ? '-- Pilih --' : 'Pilih bulan & tahun dahulu'} /></SelectTrigger>
                    <SelectContent>
                      {filteredProfiles.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          {month && year ? 'Semua karyawan sudah dinilai untuk periode ini.' : 'Tidak ada karyawan.'}
                        </div>
                      )}
                      {filteredProfiles.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.full_name}{p.job_title ? ` — ${p.job_title}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {month && year && !editingId && (
                    <p className="text-[11px] text-muted-foreground">
                      Karyawan yang sudah dinilai untuk <strong>{month} {year}</strong> otomatis disembunyikan.
                    </p>
                  )}
                </div>

                {/* Penilai */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Penilai
                  </Label>
                  <Input value={reviewerName} readOnly className="bg-muted/40" />
                </div>

                {/* Skala Skor */}
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Skala Skor (1 - 5)
                    </Label>
                    <Badge variant={scoreVariant(totalScore)}>Total: {totalScore}/100</Badge>
                  </div>

                  <div className="space-y-2">
                    {CATEGORIES.map((c) => (
                      <div
                        key={c.key}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 border border-border/50"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{c.label}</div>
                          <div className="text-[11px] font-medium text-muted-foreground">Bobot {c.weight}%</div>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          step={1}
                          inputMode="numeric"
                          value={scores[c.key] ?? ''}
                          onChange={(e) => setScore(c.key, e.target.value)}
                          className="w-20 text-center font-semibold bg-background"
                          placeholder="-"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting || !employeeId}
                  className="w-full h-11 font-semibold"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {editingId ? 'Simpan Perubahan' : 'Simpan Penilaian'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Riwayat */}
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">Riwayat Penilaian</CardTitle></CardHeader>
          <CardContent className="p-3 sm:p-4 space-y-2">
            {records.length === 0 && (
              <p className="p-8 text-center text-muted-foreground text-sm">Belum ada data penilaian.</p>
            )}

            {records.length > 0 && (
              <Accordion type="multiple" className="w-full space-y-2">
                {records.map((r) => {
                  const prof = profileMap.get(r.user_id);
                  const cats = (r.categories || {}) as Record<string, { label: string; weight?: number; score: number }>;
                  const catEntries = Object.entries(cats);

                  return (
                    <AccordionItem
                      key={r.id}
                      value={r.id}
                      className="border border-border/60 rounded-lg bg-muted/20 px-3 sm:px-4"
                    >
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <div className="flex flex-1 items-center justify-between gap-3 pr-2 min-w-0">
                          <div className="min-w-0 text-left">
                            <div className="font-semibold text-sm truncate">{prof?.full_name || '-'}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{r.review_period}</div>
                          </div>
                          <Badge variant={scoreVariant(r.score)} className="shrink-0">{r.score}</Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-3">
                        <div className="space-y-2">
                          {catEntries.length === 0 && (
                            <p className="text-xs text-muted-foreground">{r.notes || 'Tidak ada rincian.'}</p>
                          )}
                          {catEntries.map(([key, c]) => (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-3 p-2.5 rounded-md bg-background border border-border/50"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{c.label}</div>
                                {typeof c.weight === 'number' && (
                                  <div className="text-[11px] text-muted-foreground">Bobot {c.weight}%</div>
                                )}
                              </div>
                              <div className="text-sm font-bold tabular-nums">{c.score}<span className="text-muted-foreground font-normal">/5</span></div>
                            </div>
                          ))}

                          {(canEdit || canDelete) && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                              {canEdit && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(r)}
                                >
                                  <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => setDeleteId(r.id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Hapus
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus penilaian ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Data penilaian kinerja akan dihapus permanen dan tidak bisa dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
