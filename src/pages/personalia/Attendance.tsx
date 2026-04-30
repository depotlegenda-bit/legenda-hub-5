import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { CalendarCheck, ChevronLeft, ChevronRight, Save, MapPin, Plus, Crosshair, Trash2, AlertTriangle } from 'lucide-react';
import { useOutlets } from '@/hooks/useOutlets';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { useTabParam } from '@/hooks/useTabParam';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ExportButtons } from '@/components/ExportButtons';
import { usePersistentDraft } from '@/hooks/usePersistentDraft';
import { useAttendanceThresholds } from '@/hooks/useAttendanceThresholds';
import { getAttendanceStatus, formatDiffMinutes } from '@/lib/attendanceStatus';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type StatusCode = 'H' | 'I' | 'S' | 'C' | 'L' | 'T';

const STATUS_DEFS: { code: StatusCode; label: string; cls: string }[] = [
  { code: 'H', label: 'Hadir',           cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40' },
  { code: 'I', label: 'Izin',            cls: 'bg-blue-500/15 text-blue-700 border-blue-500/40' },
  { code: 'S', label: 'Sakit',           cls: 'bg-amber-500/15 text-amber-700 border-amber-500/40' },
  { code: 'C', label: 'Cuti',            cls: 'bg-violet-500/15 text-violet-700 border-violet-500/40' },
  { code: 'L', label: 'Libur',           cls: 'bg-slate-500/15 text-slate-700 border-slate-500/40' },
  { code: 'T', label: 'Tanpa Keterangan',cls: 'bg-rose-500/15 text-rose-700 border-rose-500/40' },
];

const DB_TO_CODE: Record<string, StatusCode> = {
  hadir: 'H', izin: 'I', sakit: 'S', cuti: 'C', libur: 'L', alpha: 'T',
};
const CODE_TO_DB: Record<StatusCode, string> = {
  H: 'hadir', I: 'izin', S: 'sakit', C: 'cuti', L: 'libur', T: 'alpha',
};

interface Profile {
  user_id: string;
  full_name: string;
  job_title: string;
  outlet_id: string | null;
}

interface RowState {
  status: StatusCode;
  late_minutes: number;
  late_notes: string;
  cashbon_amount: number;
  cashbon_notes: string;
  existingId?: string;
  dirty: boolean;
}

const createAttendanceDraft = () => ({
  date: new Date().toISOString().split('T')[0],
  selectedOutlet: '',
  rows: {} as Record<string, RowState>,
});

export default function AttendancePage() {
  const { role } = useAuth();
  const canManageOutlets = role === 'management' || role === 'admin';
  const [mainTab, setMainTab] = useTabParam('input');
  const { toast } = useToast();
  const { outlets, selectedOutlet, setSelectedOutlet, loading: outletsLoading } = useOutlets();
  const attendanceDraft = usePersistentDraft('draft:attendance-input-v1', createAttendanceDraft());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [date, setDate] = useState<string>(attendanceDraft.value.date);
  const [rows, setRows] = useState<Record<string, RowState>>(attendanceDraft.value.rows);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Fetch profiles once
  useEffect(() => {
    supabase
      .from('profiles')
      .select('user_id, full_name, job_title, outlet_id')
      .order('full_name')
      .then(({ data }) => { if (data) setProfiles(data as Profile[]); });
  }, []);

  // Filter karyawan per outlet
  const outletProfiles = useMemo(
    () => profiles.filter((p) => p.outlet_id === selectedOutlet),
    [profiles, selectedOutlet]
  );

  // Load attendance for date+outlet
  useEffect(() => {
    if (!selectedOutlet && attendanceDraft.value.selectedOutlet) {
      setSelectedOutlet(attendanceDraft.value.selectedOutlet);
    }
  }, [attendanceDraft.value.selectedOutlet, selectedOutlet, setSelectedOutlet]);

  useEffect(() => {
    attendanceDraft.setValue({ date, selectedOutlet, rows });
  }, [attendanceDraft, date, rows, selectedOutlet]);

  useEffect(() => {
    if (!selectedOutlet || outletProfiles.length === 0) {
      setRows({});
      setSelected({});
      return;
    }

    if (attendanceDraft.hasStoredValue && attendanceDraft.value.selectedOutlet === selectedOutlet && attendanceDraft.value.date === date) {
      const draftRowKeys = Object.keys(attendanceDraft.value.rows || {});
      const outletUserIds = outletProfiles.map((p) => p.user_id);
      const hasOutletDraft = draftRowKeys.some((uid) => outletUserIds.includes(uid));

      if (hasOutletDraft) {
        const next: Record<string, RowState> = {};
        outletProfiles.forEach((p) => {
          next[p.user_id] = attendanceDraft.value.rows[p.user_id] || {
            status: 'H',
            late_minutes: 0,
            late_notes: '',
            cashbon_amount: 0,
            cashbon_notes: '',
            dirty: false,
          };
        });
        setRows(next);
        setSelected({});
        return;
      }
    }

    const userIds = outletProfiles.map((p) => p.user_id);
    supabase
      .from('attendance')
      .select('*')
      .eq('attendance_date', date)
      .in('user_id', userIds)
      .then(({ data }) => {
        const map: Record<string, RowState> = {};
        outletProfiles.forEach((p) => {
          const rec = data?.find((d: any) => d.user_id === p.user_id);
          map[p.user_id] = {
            status: rec ? (DB_TO_CODE[rec.status] || 'H') : 'H',
            late_minutes: rec?.late_minutes ?? 0,
            late_notes: rec?.late_notes ?? '',
            cashbon_amount: Number(rec?.cashbon_amount ?? 0),
            cashbon_notes: rec?.cashbon_notes ?? '',
            existingId: rec?.id,
            dirty: false,
          };
        });
        setRows(map);
        setSelected({});
      });
  }, [date, selectedOutlet, outletProfiles]);

  const updateRow = (uid: string, patch: Partial<RowState>) => {
    setRows((prev) => ({ ...prev, [uid]: { ...prev[uid], ...patch, dirty: true } }));
  };

  const dirtyCount = Object.values(rows).filter((r) => r.dirty).length;

  const shiftDate = (delta: number) => {
    const d = parseISO(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleSave = async () => {
    const dirty = Object.entries(rows).filter(([, r]) => r.dirty);
    if (dirty.length === 0) {
      toast({ title: 'Tidak ada perubahan' });
      return;
    }
    setSaving(true);
    let success = 0;
    let failed = 0;
    for (const [uid, r] of dirty) {
      const payload = {
        user_id: uid,
        outlet_id: selectedOutlet,
        attendance_date: date,
        status: CODE_TO_DB[r.status],
        late_minutes: r.late_minutes,
        late_notes: r.late_notes,
        cashbon_amount: r.cashbon_amount,
        cashbon_notes: r.cashbon_notes,
      };
      const res = r.existingId
        ? await supabase.from('attendance').update(payload).eq('id', r.existingId)
        : await supabase.from('attendance').insert(payload);
      if (res.error) failed++; else success++;
    }
    setSaving(false);
    if (failed > 0) {
      toast({ title: `Tersimpan ${success}, gagal ${failed}`, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: `${success} absensi tersimpan.` });
      attendanceDraft.clear(createAttendanceDraft());
    }
    // Refresh
    setDate((d) => d);
  };

  const allSelected = outletProfiles.length > 0 && outletProfiles.every((p) => selected[p.user_id]);
  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    outletProfiles.forEach((p) => { next[p.user_id] = checked; });
    setSelected(next);
  };
  const bulkSetStatus = (code: StatusCode) => {
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (ids.length === 0) return;
    setRows((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = { ...next[id], status: code, dirty: true }; });
      return next;
    });
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
            <CalendarCheck className="w-7 h-7" /> Absensi Karyawan
          </h1>
          <p className="text-muted-foreground mt-1">Input dan rekap kehadiran karyawan per outlet</p>
        </div>

        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full">
          <TabsList>
            <TabsTrigger value="input">Input Absensi</TabsTrigger>
            <TabsTrigger value="recap">Rekap Bulanan</TabsTrigger>
            <TabsTrigger value="logs">Log Absen Selfie</TabsTrigger>
            {canManageOutlets && <TabsTrigger value="outlets">Kelola Toko</TabsTrigger>}
          </TabsList>

          <TabsContent value="input" className="space-y-4">
            {/* Outlet tabs */}
            <Tabs value={selectedOutlet} onValueChange={setSelectedOutlet}>
              <TabsList className="flex-wrap gap-x-2 h-auto bg-transparent border-b border-border w-full justify-start rounded-none p-0">
                {outlets.map((o) => (
                  <TabsTrigger
                    key={o.id}
                    value={o.id}
                    className="flex-none whitespace-normal text-left h-auto data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    {o.name}
                  </TabsTrigger>
                ))}
                {outlets.length === 0 && !outletsLoading && (
                  <span className="text-sm text-muted-foreground py-2 px-3">Belum ada outlet</span>
                )}
              </TabsList>
            </Tabs>

            {/* Date navigator */}
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => shiftDate(-1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
                <Button variant="outline" size="icon" onClick={() => shiftDate(1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground ml-2">
                  {format(parseISO(date), 'EEEE, d MMMM yyyy', { locale: idLocale })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setDate(new Date().toISOString().split('T')[0])}>
                  Hari Ini
                </Button>
                <Button onClick={handleSave} disabled={saving || dirtyCount === 0}>
                  <Save className="w-4 h-4 mr-2" /> Simpan Absensi {dirtyCount > 0 && `(${dirtyCount})`}
                </Button>
              </div>
            </div>

            {/* Bulk actions */}
            {Object.values(selected).some(Boolean) && (
              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg border border-border">
                <span className="text-sm font-medium">Set status untuk {Object.values(selected).filter(Boolean).length} terpilih:</span>
                {STATUS_DEFS.map((s) => (
                  <button
                    key={s.code}
                    onClick={() => bulkSetStatus(s.code)}
                    className={cn('px-2.5 py-1 rounded border text-xs font-bold', s.cls)}
                    title={s.label}
                  >
                    {s.code}
                  </button>
                ))}
              </div>
            )}

            <Card className="glass-card overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[1100px]">
                    <thead className="bg-muted/40">
                      <tr className="text-left text-xs uppercase text-muted-foreground">
                        <th className="p-3 w-10">
                          <Checkbox checked={allSelected} onCheckedChange={(c) => toggleAll(!!c)} />
                        </th>
                        <th className="p-3 w-10">No</th>
                        <th className="p-3">Nama Karyawan</th>
                        <th className="p-3">Jabatan</th>
                        <th className="p-3">Status Kehadiran</th>
                        <th className="p-3">Terlambat (menit)</th>
                        <th className="p-3">Ket. Terlambat</th>
                        <th className="p-3">Kasbon (Rp)</th>
                        <th className="p-3">Ket. Kasbon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outletProfiles.map((p, idx) => {
                        const r = rows[p.user_id];
                        if (!r) return null;
                        return (
                          <tr key={p.user_id} className="border-t border-border/50 hover:bg-muted/20">
                            <td className="p-3">
                              <Checkbox
                                checked={!!selected[p.user_id]}
                                onCheckedChange={(c) => setSelected((s) => ({ ...s, [p.user_id]: !!c }))}
                              />
                            </td>
                            <td className="p-3 text-muted-foreground">{idx + 1}</td>
                            <td className="p-3 font-medium">{p.full_name}</td>
                            <td className="p-3 text-muted-foreground">{p.job_title || '-'}</td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                {STATUS_DEFS.map((s) => {
                                  const active = r.status === s.code;
                                  return (
                                    <button
                                      key={s.code}
                                      type="button"
                                      onClick={() => updateRow(p.user_id, { status: s.code })}
                                      className={cn(
                                        'w-8 h-8 rounded border text-xs font-bold transition-all',
                                        active ? s.cls : 'border-border text-muted-foreground hover:bg-muted'
                                      )}
                                      title={s.label}
                                    >
                                      {s.code}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                min={0}
                                value={r.late_minutes}
                                onChange={(e) => updateRow(p.user_id, { late_minutes: parseInt(e.target.value) || 0 })}
                                className="w-20"
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                value={r.late_notes}
                                onChange={(e) => updateRow(p.user_id, { late_notes: e.target.value })}
                                placeholder="Keterangan..."
                                className="w-40"
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                min={0}
                                value={r.cashbon_amount}
                                onChange={(e) => updateRow(p.user_id, { cashbon_amount: parseFloat(e.target.value) || 0 })}
                                className="w-28"
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                value={r.cashbon_notes}
                                onChange={(e) => updateRow(p.user_id, { cashbon_notes: e.target.value })}
                                placeholder="Keterangan..."
                                className="w-40"
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {outletProfiles.length === 0 && (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-muted-foreground">
                            {outlets.length === 0
                              ? 'Belum ada outlet. Tambah outlet terlebih dahulu.'
                              : 'Tidak ada karyawan di outlet ini. Atur outlet karyawan di menu Data Karyawan.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recap">
            <RecapTab outletId={selectedOutlet} profiles={outletProfiles} role={role} />
          </TabsContent>

          <TabsContent value="logs">
            <SelfieLogsTab outlets={outlets} allProfiles={profiles} role={role} />
          </TabsContent>

          {canManageOutlets && (
            <TabsContent value="outlets">
              <OutletsManagementTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </AppLayout>
  );
}

function RecapTab({ outletId, profiles, role }: { outletId: string; profiles: Profile[]; role: AppRole | null }) {
  const { toast } = useToast();
  const isAdmin = role === 'admin';
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingDuplicates, setDeletingDuplicates] = useState(false);

  const reload = () => {
    if (!outletId || profiles.length === 0) { setRecords([]); return; }
    setLoading(true);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;
    supabase
      .from('attendance')
      .select('*')
      .gte('attendance_date', start)
      .lte('attendance_date', end)
      .in('user_id', profiles.map((p) => p.user_id))
      .order('attendance_date', { ascending: false })
      .then(({ data }) => {
        setRecords(data || []);
        setLoading(false);
      });
  };

  useEffect(() => { reload(); }, [outletId, month, year, profiles]);

  // Deteksi duplikat: sama user_id + attendance_date
  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, any[]>();
    records.forEach((r) => {
      const key = `${r.user_id}__${r.attendance_date}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });
    return Array.from(groups.values()).filter((g) => g.length > 1);
  }, [records]);

  const duplicateCount = duplicateGroups.reduce((s, g) => s + (g.length - 1), 0);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.user_id, p])), [profiles]);

  const summary = profiles.map((p) => {
    const recs = records.filter((r) => r.user_id === p.user_id);
    const count = (db: string) => recs.filter((r) => r.status === db).length;
    const totalLate = recs.reduce((s, r) => s + (r.late_minutes || 0), 0);
    const totalCashbon = recs.reduce((s, r) => s + Number(r.cashbon_amount || 0), 0);
    return {
      name: p.full_name,
      H: count('hadir'), I: count('izin'), S: count('sakit'),
      C: count('cuti'), L: count('libur'), T: count('alpha'),
      late: totalLate, cashbon: totalCashbon,
    };
  });

  const periodLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: idLocale });

  const deleteOne = async (id: string) => {
    const { error } = await supabase.from('attendance').delete().eq('id', id);
    if (error) {
      toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Data absen dihapus' });
    reload();
  };

  const cleanupDuplicates = async () => {
    // Untuk tiap grup duplikat, simpan record paling baru (created_at terbesar) dan hapus sisanya
    const toDelete: string[] = [];
    duplicateGroups.forEach((group) => {
      const sorted = [...group].sort(
        (a, b) => new Date(b.created_at || b.updated_at || 0).getTime() - new Date(a.created_at || a.updated_at || 0).getTime()
      );
      sorted.slice(1).forEach((r) => toDelete.push(r.id));
    });
    if (toDelete.length === 0) {
      toast({ title: 'Tidak ada duplikat' });
      return;
    }
    setDeletingDuplicates(true);
    const { error } = await supabase.from('attendance').delete().in('id', toDelete);
    setDeletingDuplicates(false);
    if (error) {
      toast({ title: 'Gagal membersihkan duplikat', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Duplikat dibersihkan', description: `${toDelete.length} entri dihapus.` });
    reload();
  };

  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2 items-center">
            <Input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(parseInt(e.target.value) || 1)} className="w-20" />
            <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || year)} className="w-28" />
            <span className="text-sm text-muted-foreground">{periodLabel}</span>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <ExportButtons
              filename={`rekap-absensi-${year}-${String(month).padStart(2, '0')}`}
              title={`Rekap Absensi ${periodLabel}`}
              subtitle={`Total karyawan: ${profiles.length}`}
              orientation="landscape"
              columns={[
                { header: 'Nama', accessor: 'name' },
                { header: 'Hadir', accessor: 'H' },
                { header: 'Izin', accessor: 'I' },
                { header: 'Sakit', accessor: 'S' },
                { header: 'Cuti', accessor: 'C' },
                { header: 'Libur', accessor: 'L' },
                { header: 'Tanpa Ket.', accessor: 'T' },
                { header: 'Total Terlambat (mnt)', accessor: 'late' },
                { header: 'Total Kasbon (Rp)', accessor: (r) => Number(r.cashbon).toLocaleString('id-ID') },
              ]}
              rows={summary}
            />
          </div>
        </div>

        {isAdmin && duplicateCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-destructive/40 bg-destructive/10">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm font-medium">Terdeteksi {duplicateCount} entri absen duplikat</p>
              <p className="text-xs text-muted-foreground">
                Beberapa karyawan memiliki lebih dari satu absen pada tanggal yang sama. Pembersihan akan menyimpan entri terbaru dan menghapus sisanya.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={deletingDuplicates}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deletingDuplicates ? 'Membersihkan...' : 'Bersihkan Duplikat'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Bersihkan absen duplikat?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sistem akan menghapus {duplicateCount} entri lama dan menyimpan entri terbaru per karyawan-tanggal. Tindakan ini tidak dapat dibatalkan.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={cleanupDuplicates}>Hapus Duplikat</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="p-3">Nama</th>
                {STATUS_DEFS.map((s) => (
                  <th key={s.code} className="p-3 text-center w-12" title={s.label}>{s.code}</th>
                ))}
                <th className="p-3 text-right">Total Terlambat</th>
                <th className="p-3 text-right">Total Kasbon</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.name} className="border-b border-border/50">
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3 text-center">{s.H}</td>
                  <td className="p-3 text-center">{s.I}</td>
                  <td className="p-3 text-center">{s.S}</td>
                  <td className="p-3 text-center">{s.C}</td>
                  <td className="p-3 text-center">{s.L}</td>
                  <td className="p-3 text-center">{s.T}</td>
                  <td className="p-3 text-right">{s.late} mnt</td>
                  <td className="p-3 text-right">Rp {s.cashbon.toLocaleString('id-ID')}</td>
                </tr>
              ))}
              {summary.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">{loading ? 'Memuat...' : 'Belum ada data.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {isAdmin && records.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Detail Entri Absen ({records.length})</h4>
              <span className="text-xs text-muted-foreground">Admin dapat menghapus entri individual untuk mitigasi data bertumpuk.</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Karyawan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Terlambat</th>
                    <th className="p-3 text-right">Kasbon</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const prof = profileMap.get(r.user_id);
                    const dupKey = `${r.user_id}__${r.attendance_date}`;
                    const isDup = duplicateGroups.some((g) => g[0] && `${g[0].user_id}__${g[0].attendance_date}` === dupKey);
                    return (
                      <tr key={r.id} className={cn('border-t border-border/50 hover:bg-muted/20', isDup && 'bg-destructive/5')}>
                        <td className="p-3 font-mono text-xs">{r.attendance_date}</td>
                        <td className="p-3">
                          <div className="font-medium">{prof?.full_name || '—'}</div>
                          {isDup && <span className="text-[10px] uppercase font-bold text-destructive">Duplikat</span>}
                        </td>
                        <td className="p-3"><span className="text-xs font-bold">{DB_TO_CODE[r.status] || r.status}</span></td>
                        <td className="p-3 text-right">{r.late_minutes || 0} mnt</td>
                        <td className="p-3 text-right">Rp {Number(r.cashbon_amount || 0).toLocaleString('id-ID')}</td>
                        <td className="p-3 text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus entri absen?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {prof?.full_name} · {r.attendance_date} · {DB_TO_CODE[r.status] || r.status}. Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteOne(r.id)}>Hapus</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SelfieLogsTab({ outlets, allProfiles, role }: { outlets: { id: string; name: string }[]; allProfiles: Profile[]; role: AppRole | null }) {
  const { toast } = useToast();
  const isAdmin = role === 'admin';
  const { thresholds } = useAttendanceThresholds();
  const [logs, setLogs] = useState<any[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [userFilter, setUserFilter] = useState<string>('all');
  const [outletFilter, setOutletFilter] = useState<string>('all');
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const visibleProfiles = useMemo(
    () => outletFilter === 'all' ? allProfiles : allProfiles.filter((p) => p.outlet_id === outletFilter),
    [allProfiles, outletFilter]
  );

  const reload = () => {
    if (visibleProfiles.length === 0) { setLogs([]); return; }
    const userIds = visibleProfiles.map((p) => p.user_id);
    // Gunakan rentang waktu LOKAL penuh (00:00:00.000 – 23:59:59.999) lalu konversi ke ISO/UTC,
    // supaya log absensi di jam berapapun (termasuk dini hari & malam) tetap terdeteksi
    // walau created_at di DB tersimpan dalam UTC.
    const [y, m, d] = date.split('-').map(Number);
    const startLocal = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
    const endLocal = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);
    supabase
      .from('attendance_logs')
      .select('*')
      .gte('created_at', startLocal.toISOString())
      .lte('created_at', endLocal.toISOString())
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .then(({ data }) => setLogs(data || []));
  };

  useEffect(() => { reload(); }, [date, visibleProfiles]);

  useEffect(() => { setUserFilter('all'); }, [outletFilter]);

  const profileMap = useMemo(() => new Map(allProfiles.map((p) => [p.user_id, p])), [allProfiles]);
  const outletMap = useMemo(() => new Map(outlets.map((o) => [o.id, o.name])), [outlets]);
  const filtered = userFilter === 'all' ? logs : logs.filter((l) => l.user_id === userFilter);

  const exportRows = filtered.map((log) => {
    const prof = profileMap.get(log.user_id);
    const status = getAttendanceStatus(log.created_at, log.log_type, thresholds);
    return {
      tanggal: format(new Date(log.created_at), 'yyyy-MM-dd'),
      waktu: format(new Date(log.created_at), 'HH:mm:ss'),
      karyawan: prof?.full_name || '-',
      outlet: outletMap.get(log.outlet_id || '') || '-',
      tipe: log.log_type === 'check_in' ? 'Check In' : 'Check Out',
      status_jam: status.label,
      selisih: formatDiffMinutes(status.diffMinutes),
      latitude: Number(log.latitude).toFixed(6),
      longitude: Number(log.longitude).toFixed(6),
      jarak_meter: log.distance_from_outlet_meters != null ? Math.round(log.distance_from_outlet_meters) : '',
      status_radius: log.out_of_radius ? 'Luar radius' : 'Dalam radius',
      foto_url: log.selfie_url || '',
      catatan: log.notes || '',
    };
  });

  const deleteOne = async (id: string) => {
    const { error } = await supabase.from('attendance_logs').delete().eq('id', id);
    if (error) {
      toast({ title: 'Gagal menghapus log', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Log dihapus' });
    reload();
  };

  const deleteAllVisible = async () => {
    if (filtered.length === 0) return;
    setBulkDeleting(true);
    const ids = filtered.map((l) => l.id);
    const { error } = await supabase.from('attendance_logs').delete().in('id', ids);
    setBulkDeleting(false);
    if (error) {
      toast({ title: 'Gagal menghapus log', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Log dihapus', description: `${ids.length} log dihapus.` });
    reload();
  };

  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-4">
        <Tabs value={outletFilter} onValueChange={setOutletFilter}>
          <TabsList className="flex-wrap gap-x-2 h-auto bg-transparent border-b border-border w-full justify-start rounded-none p-0">
            <TabsTrigger
              value="all"
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

        <div className="flex flex-wrap gap-2 items-center">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="all">Semua karyawan</option>
            {visibleProfiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
          </select>
          <span className="text-sm text-muted-foreground">{filtered.length} log</span>
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <ExportButtons
              filename={`log-absen-selfie-${date}`}
              title={`Log Absen Selfie ${date}`}
              subtitle={outletFilter === 'all' ? 'Semua outlet' : (outletMap.get(outletFilter) || '-')}
              orientation="landscape"
              columns={[
                { header: 'Tanggal', accessor: 'tanggal' },
                { header: 'Waktu', accessor: 'waktu' },
                { header: 'Karyawan', accessor: 'karyawan' },
                { header: 'Outlet', accessor: 'outlet' },
                { header: 'Tipe', accessor: 'tipe' },
                { header: 'Status Jam', accessor: 'status_jam' },
                { header: 'Selisih', accessor: 'selisih' },
                { header: 'Latitude', accessor: 'latitude' },
                { header: 'Longitude', accessor: 'longitude' },
                { header: 'Jarak (m)', accessor: 'jarak_meter' },
                { header: 'Status Radius', accessor: 'status_radius' },
                { header: 'Foto URL', accessor: 'foto_url' },
                { header: 'Catatan', accessor: 'catatan' },
              ]}
              rows={exportRows}
            />
            {isAdmin && filtered.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={bulkDeleting}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    {bulkDeleting ? 'Menghapus...' : `Hapus Semua (${filtered.length})`}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus semua log selfie yang ditampilkan?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {filtered.length} log absen selfie pada filter saat ini akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAllVisible}>Hapus Semua</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="p-3">Foto</th>
                <th className="p-3">Karyawan</th>
                <th className="p-3">Waktu</th>
                <th className="p-3">Tipe</th>
                <th className="p-3">Status Jam</th>
                <th className="p-3">Lokasi</th>
                <th className="p-3">Status</th>
                <th className="p-3">Catatan</th>
                {isAdmin && <th className="p-3 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => {
                const prof = profileMap.get(log.user_id);
                const mapsLink = `https://www.google.com/maps?q=${log.latitude},${log.longitude}`;
                const status = getAttendanceStatus(log.created_at, log.log_type, thresholds);
                return (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-3">
                      <a href={log.selfie_url} target="_blank" rel="noreferrer">
                        <img src={log.selfie_url} alt="" className="w-14 h-14 rounded object-cover hover:ring-2 hover:ring-primary" />
                      </a>
                    </td>
                    <td className="p-3 font-medium">{prof?.full_name || '—'}</td>
                    <td className="p-3 font-mono text-xs">{format(new Date(log.created_at), 'HH:mm:ss')}</td>
                    <td className="p-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-bold',
                        log.log_type === 'check_in' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-blue-500/15 text-blue-700'
                      )}>
                        {log.log_type === 'check_in' ? 'IN' : 'OUT'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium w-fit', status.className)}>
                          {status.label}
                        </span>
                        {status.key !== 'unknown' && status.key !== 'on_time' && (
                          <span className="text-[10px] font-mono text-muted-foreground">{formatDiffMinutes(status.diffMinutes)}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <a href={mapsLink} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs font-mono">
                        {Number(log.latitude).toFixed(4)}, {Number(log.longitude).toFixed(4)}
                      </a>
                      {log.distance_from_outlet_meters != null && (
                        <p className="text-xs text-muted-foreground">{Math.round(log.distance_from_outlet_meters)}m dari outlet</p>
                      )}
                    </td>
                    <td className="p-3">
                      {log.out_of_radius ? (
                        <span className="px-2 py-0.5 rounded text-xs bg-destructive/15 text-destructive font-medium">Luar radius</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/15 text-emerald-700 font-medium">Dalam radius</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{log.notes || '-'}</td>
                    {isAdmin && (
                      <td className="p-3 text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Hapus log absen selfie?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {prof?.full_name || '—'} · {format(new Date(log.created_at), 'dd MMM yyyy HH:mm:ss')} · {log.log_type === 'check_in' ? 'Check In' : 'Check Out'}. Tindakan ini tidak dapat dibatalkan.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Batal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteOne(log.id)}>Hapus</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={isAdmin ? 8 : 7} className="p-8 text-center text-muted-foreground">Belum ada log absen selfie pada tanggal ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

interface OutletRow {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
  dirty?: boolean;
  isNew?: boolean;
}

function OutletsManagementTab() {
  const { toast } = useToast();
  const [outlets, setOutlets] = useState<OutletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('outlets')
      .select('id, name, latitude, longitude, radius_meters')
      .order('name');
    setOutlets((data || []) as OutletRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateField = (id: string, patch: Partial<OutletRow>) => {
    setOutlets((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch, dirty: true } : o)));
  };

  const useMyLocation = (id: string) => {
    if (!navigator.geolocation) {
      toast({ title: 'Browser tidak mendukung Geolocation', variant: 'destructive' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateField(id, {
          latitude: Number(pos.coords.latitude.toFixed(7)),
          longitude: Number(pos.coords.longitude.toFixed(7)),
        });
        toast({ title: 'Lokasi diisi', description: 'Jangan lupa simpan perubahan.' });
      },
      (err) => toast({ title: 'Gagal mengambil lokasi', description: err.message, variant: 'destructive' }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const saveOutlet = async (o: OutletRow) => {
    if (!o.name.trim()) {
      toast({ title: 'Nama outlet wajib diisi', variant: 'destructive' });
      return;
    }
    setSavingId(o.id);
    const payload = {
      name: o.name.trim(),
      latitude: o.latitude,
      longitude: o.longitude,
      radius_meters: o.radius_meters ?? 100,
    };
    const res = o.isNew
      ? await supabase.from('outlets').insert(payload).select().single()
      : await supabase.from('outlets').update(payload).eq('id', o.id).select().single();
    setSavingId(null);
    if (res.error) {
      toast({ title: 'Gagal menyimpan', description: res.error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Outlet tersimpan' });
    await load();
  };

  const addNewRow = () => {
    const tempId = `new-${Date.now()}`;
    setOutlets((prev) => [
      ...prev,
      { id: tempId, name: '', latitude: null, longitude: null, radius_meters: 100, isNew: true, dirty: true },
    ]);
  };

  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Koordinat & Radius Outlet</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Atur titik pusat (latitude/longitude) dan radius (meter) untuk validasi check-in. Jika di luar radius, sistem akan memberi peringatan namun absen tetap diterima.
            </p>
          </div>
          <Button onClick={addNewRow} size="sm">
            <Plus className="w-4 h-4 mr-2" /> Tambah Outlet
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : outlets.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Belum ada outlet. Klik "Tambah Outlet".</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr className="text-left">
                  <th className="p-3">Nama Outlet</th>
                  <th className="p-3">Latitude</th>
                  <th className="p-3">Longitude</th>
                  <th className="p-3">Radius (m)</th>
                  <th className="p-3">Peta</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {outlets.map((o) => {
                  const hasCoords = o.latitude != null && o.longitude != null;
                  return (
                    <tr key={o.id} className="border-t border-border/50 hover:bg-muted/20">
                      <td className="p-3">
                        <Input
                          value={o.name}
                          onChange={(e) => updateField(o.id, { name: e.target.value })}
                          placeholder="Nama outlet"
                          className="min-w-[180px]"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          step="0.0000001"
                          value={o.latitude ?? ''}
                          onChange={(e) => updateField(o.id, { latitude: e.target.value === '' ? null : parseFloat(e.target.value) })}
                          placeholder="-6.2088"
                          className="w-36"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          step="0.0000001"
                          value={o.longitude ?? ''}
                          onChange={(e) => updateField(o.id, { longitude: e.target.value === '' ? null : parseFloat(e.target.value) })}
                          placeholder="106.8456"
                          className="w-36"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min={1}
                          value={o.radius_meters ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '') {
                              updateField(o.id, { radius_meters: null });
                              return;
                            }
                            const n = parseInt(v, 10);
                            updateField(o.id, { radius_meters: Number.isNaN(n) ? null : n });
                          }}
                          placeholder="100"
                          className="w-28"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => useMyLocation(o.id)}
                            title="Gunakan lokasi saya"
                          >
                            <Crosshair className="w-3.5 h-3.5" />
                          </Button>
                          {hasCoords && (
                            <Button asChild type="button" variant="outline" size="sm">
                              <a
                                href={`https://www.google.com/maps?q=${o.latitude},${o.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => saveOutlet(o)}
                          disabled={savingId === o.id || !o.dirty}
                        >
                          <Save className="w-3.5 h-3.5 mr-1" />
                          {savingId === o.id ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
