import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { CalendarCheck, ChevronLeft, ChevronRight, Save, MapPin, Plus, Crosshair, Trash2, AlertTriangle, Pencil, Camera, Download } from 'lucide-react';
import { useOutlets } from '@/hooks/useOutlets';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { useTabParam } from '@/hooks/useTabParam';
import { usePersistentState } from '@/hooks/usePersistentState';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { ExportButtons } from '@/components/ExportButtons';
import { usePersistentDraft } from '@/hooks/usePersistentDraft';
import { useAttendanceThresholds } from '@/hooks/useAttendanceThresholds';
import { getAttendanceStatus, formatDiffMinutes, isRoleExempt } from '@/lib/attendanceStatus';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  fromSelfie?: boolean;
}

interface SelfieLog {
  id: string;
  user_id: string;
  log_type: 'check_in' | 'check_out';
  created_at: string;
  outlet_id: string | null;
  shift_name?: string | null;
}

const createAttendanceDraft = () => ({
  date: new Date().toISOString().split('T')[0],
  selectedOutlet: '',
  rows: {} as Record<string, RowState>,
});

export default function AttendancePage() {
  const { role } = useAuth();
  const canManageOutlets = role === 'management' || role === 'admin';
  const [mainTab, setMainTab] = useTabParam('recap');
  const { toast } = useToast();
  const { outlets, selectedOutlet, setSelectedOutlet, loading: outletsLoading } = useOutlets({ includeManagement: true });
  const attendanceDraft = usePersistentDraft('draft:attendance-input-v1', createAttendanceDraft());
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [date, setDate] = useState<string>(attendanceDraft.value.date);
  const [rows, setRows] = useState<Record<string, RowState>>(attendanceDraft.value.rows);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [selfieLogsByUser, setSelfieLogsByUser] = useState<Record<string, SelfieLog[]>>({});
  const { resolve: resolveThresholds } = useAttendanceThresholds();

  const deriveFromSelfie = (logs: SelfieLog[]): Partial<RowState> | null => {
    if (!logs || logs.length === 0) return null;
    const ins = logs.filter((l) => l.log_type === 'check_in').sort((a, b) => a.created_at.localeCompare(b.created_at));
    const outs = logs.filter((l) => l.log_type === 'check_out').sort((a, b) => a.created_at.localeCompare(b.created_at));
    const firstIn = ins[0];
    const lastOut = outs[outs.length - 1];
    let lateMin = 0;
    if (firstIn) {
      const th = resolveThresholds(firstIn.outlet_id, firstIn.shift_name || 'Default');
      const info = getAttendanceStatus(firstIn.created_at, 'check_in', th);
      if (info.key === 'late') lateMin = Math.max(0, info.diffMinutes);
    }
    const fmt = (iso?: string) => iso ? format(new Date(iso), 'HH:mm') : '-';
    const note = `Selfie: IN ${fmt(firstIn?.created_at)}${lastOut ? ` · OUT ${fmt(lastOut.created_at)}` : ''}`;
    return { status: 'H', late_minutes: lateMin, late_notes: note };
  };

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
    const [y, m, d] = date.split('-').map(Number);
    const startLocal = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
    const endLocal = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999);

    Promise.all([
      supabase.from('attendance').select('*').eq('attendance_date', date).in('user_id', userIds),
      supabase
        .from('attendance_logs')
        .select('id,user_id,log_type,created_at,outlet_id,shift_name')
        .eq('outlet_id', selectedOutlet)
        .gte('created_at', startLocal.toISOString())
        .lte('created_at', endLocal.toISOString())
        .in('user_id', userIds),
    ]).then(([attRes, logsRes]) => {
      const data = attRes.data;
      const logsByUser: Record<string, SelfieLog[]> = {};
      (logsRes.data as SelfieLog[] | null || []).forEach((l) => {
        if (!logsByUser[l.user_id]) logsByUser[l.user_id] = [];
        logsByUser[l.user_id].push(l);
      });
      setSelfieLogsByUser(logsByUser);

      const map: Record<string, RowState> = {};
      outletProfiles.forEach((p) => {
        const rec = data?.find((d: any) => d.user_id === p.user_id);
        if (rec) {
          map[p.user_id] = {
            status: DB_TO_CODE[rec.status] || 'H',
            late_minutes: rec.late_minutes ?? 0,
            late_notes: rec.late_notes ?? '',
            cashbon_amount: Number(rec.cashbon_amount ?? 0),
            cashbon_notes: rec.cashbon_notes ?? '',
            existingId: rec.id,
            dirty: false,
          };
        } else {
          const derived = deriveFromSelfie(logsByUser[p.user_id] || []);
          map[p.user_id] = {
            status: (derived?.status as StatusCode) || 'H',
            late_minutes: derived?.late_minutes ?? 0,
            late_notes: derived?.late_notes ?? '',
            cashbon_amount: 0,
            cashbon_notes: '',
            dirty: false,
            fromSelfie: !!derived,
          };
        }
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

  const selfieAvailableCount = Object.keys(selfieLogsByUser).filter((uid) => outletProfiles.some((p) => p.user_id === uid)).length;

  const pullFromSelfie = () => {
    const targets = Object.entries(selfieLogsByUser).filter(([uid]) => outletProfiles.some((p) => p.user_id === uid));
    if (targets.length === 0) {
      toast({ title: 'Tidak ada log selfie', description: 'Belum ada absen selfie untuk tanggal & outlet ini.' });
      return;
    }
    let applied = 0;
    setRows((prev) => {
      const next = { ...prev };
      targets.forEach(([uid, logs]) => {
        const derived = deriveFromSelfie(logs);
        if (!derived || !next[uid]) return;
        next[uid] = { ...next[uid], ...derived, dirty: true, fromSelfie: true };
        applied++;
      });
      return next;
    });
    toast({ title: 'Tertarik dari selfie', description: `${applied} karyawan diisi otomatis. Periksa lalu klik Simpan.` });
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
            <TabsTrigger value="recap">Rekap Bulanan</TabsTrigger>
            <TabsTrigger value="logs">Log Absen Selfie</TabsTrigger>
            {canManageOutlets && <TabsTrigger value="outlets">Kelola Toko</TabsTrigger>}
          </TabsList>


          <TabsContent value="recap">
            <RecapTab
              outletId={selectedOutlet}
              profiles={outletProfiles}
              role={role}
              outlets={outlets}
              selectedOutlet={selectedOutlet}
              setSelectedOutlet={setSelectedOutlet}
              outletsLoading={outletsLoading}
            />
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

function RecapTab({
  outletId,
  profiles,
  role,
  outlets,
  selectedOutlet,
  setSelectedOutlet,
  outletsLoading,
}: {
  outletId: string;
  profiles: Profile[];
  role: AppRole | null;
  outlets: { id: string; name: string }[];
  selectedOutlet: string;
  setSelectedOutlet: (id: string) => void;
  outletsLoading: boolean;
}) {
  const { toast } = useToast();
  const isAdmin = role === 'admin';
  const { resolve: resolveThresholds } = useAttendanceThresholds();
  const now = new Date();
  const [month, setMonth] = usePersistentState<number>('attendance:recap:month', now.getMonth() + 1);
  const [year, setYear] = usePersistentState<number>('attendance:recap:year', now.getFullYear());
  const [records, setRecords] = useState<any[]>([]);
  const [autoCount, setAutoCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deletingDuplicates, setDeletingDuplicates] = useState(false);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);

  const startEditLate = (rec: any | null, ds: string) => {
    setEditingDate(ds);
    setEditValue(rec?.late_minutes || 0);
    setEditNotes(rec?.late_notes || '');
  };

  const saveEditLate = async (ds: string) => {
    if (!detailUserId) return;
    setEditSaving(true);
    const rec = records.find((r) => r.user_id === detailUserId && r.attendance_date === ds);
    let error: any = null;
    if (rec && !rec._auto) {
      const res = await supabase
        .from('attendance')
        .update({ late_minutes: editValue, late_notes: editNotes })
        .eq('id', rec.id);
      error = res.error;
    } else {
      // Insert override (untuk virtual selfie atau hari kosong)
      const payload = {
        user_id: detailUserId,
        outlet_id: outletId,
        attendance_date: ds,
        status: rec?.status || 'hadir',
        late_minutes: editValue,
        late_notes: editNotes,
        cashbon_amount: rec?.cashbon_amount || 0,
        cashbon_notes: rec?.cashbon_notes || '',
      };
      const res = await supabase.from('attendance').insert(payload);
      error = res.error;
    }
    setEditSaving(false);
    if (error) {
      toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Terlambat diperbarui' });
    setEditingDate(null);
    reload();
  };

  const reload = () => {
    if (!outletId || profiles.length === 0) { setRecords([]); setAutoCount(0); return; }
    setLoading(true);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;
    const userIds = profiles.map((p) => p.user_id);
    const startLocal = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endLocal = new Date(year, month - 1, endDate, 23, 59, 59, 999);

    Promise.all([
      supabase
        .from('attendance')
        .select('*')
        .gte('attendance_date', start)
        .lte('attendance_date', end)
        .in('user_id', userIds)
        .order('attendance_date', { ascending: false }),
      supabase
        .from('attendance_logs')
        .select('id,user_id,log_type,created_at,outlet_id,shift_name,status_override,status_override_note,notes')
        .gte('created_at', startLocal.toISOString())
        .lte('created_at', endLocal.toISOString())
        .in('user_id', userIds),
    ]).then(([attRes, logsRes]) => {
      const manual = (attRes.data || []) as any[];
      const manualKeys = new Set(manual.map((r) => `${r.user_id}__${r.attendance_date}`));

      // Group log selfie per user_id + tanggal lokal
      const logsByKey: Record<string, any[]> = {};
      (logsRes.data || []).forEach((l: any) => {
        const d = new Date(l.created_at);
        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const key = `${l.user_id}__${localDate}`;
        if (!logsByKey[key]) logsByKey[key] = [];
        logsByKey[key].push(l);
      });

      // Buat virtual record dari log selfie untuk tanggal yang belum punya entri manual
      const STATUS_FROM_OVERRIDE: Record<string, string> = {
        H: 'hadir', I: 'izin', S: 'sakit', C: 'cuti', L: 'libur',
      };
      const STATUS_LABEL: Record<string, string> = {
        H: 'Hadir', I: 'Izin', S: 'Sakit', C: 'Cuti', L: 'Libur',
      };
      const virtual: any[] = [];
      Object.entries(logsByKey).forEach(([key, logs]) => {
        if (manualKeys.has(key)) return;
        const [user_id, attendance_date] = key.split('__');
        const ins = logs.filter((l) => l.log_type === 'check_in').sort((a, b) => a.created_at.localeCompare(b.created_at));
        const outs = logs.filter((l) => l.log_type === 'check_out').sort((a, b) => a.created_at.localeCompare(b.created_at));
        const firstIn = ins[0];
        const lastOut = outs[outs.length - 1];

        // Status diambil dari status_override pertama yang bukan 'H' (prioritaskan non-hadir),
        // atau 'H' bila semua log H / tidak ada override.
        const overrides = logs.map((l) => l.status_override).filter(Boolean) as string[];
        const nonH = overrides.find((s) => s !== 'H');
        const statusCode = nonH || overrides[0] || 'H';
        const dbStatus = STATUS_FROM_OVERRIDE[statusCode] || 'hadir';
        const isPresent = statusCode === 'H';

        let lateMin = 0;
        if (isPresent && firstIn) {
          const th = resolveThresholds(firstIn.outlet_id, firstIn.shift_name || 'Default');
          const info = getAttendanceStatus(firstIn.created_at, 'check_in', th);
          if (info.key === 'late') lateMin = Math.max(0, info.diffMinutes);
        }
        const fmt = (iso?: string) => iso ? format(new Date(iso), 'HH:mm') : '-';
        const userNote = logs.map((l) => l.status_override_note || l.notes).filter(Boolean)[0] || '';
        const lateNotes = isPresent
          ? `Selfie: IN ${fmt(firstIn?.created_at)}${lastOut ? ` · OUT ${fmt(lastOut.created_at)}` : ''}`
          : `${STATUS_LABEL[statusCode] || statusCode}${userNote ? ` — ${userNote}` : ''}`;

        virtual.push({
          id: `selfie-${key}`,
          user_id,
          attendance_date,
          status: dbStatus,
          late_minutes: lateMin,
          late_notes: lateNotes,
          cashbon_amount: 0,
          cashbon_notes: '',
          _auto: true,
        });
      });

      const merged = [...manual, ...virtual].sort((a, b) => (b.attendance_date || '').localeCompare(a.attendance_date || ''));
      setRecords(merged);
      setAutoCount(virtual.length);
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
      user_id: p.user_id,
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
          <div className="flex gap-2 items-center flex-wrap">
            <Select value={selectedOutlet} onValueChange={setSelectedOutlet} disabled={outletsLoading}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Pilih cabang" />
              </SelectTrigger>
              <SelectContent>
                {outlets.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        {autoCount > 0 && (
          <div className="flex items-start gap-3 p-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10">
            <Camera className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-emerald-800 dark:text-emerald-300">{autoCount} kehadiran terisi otomatis dari Absen Selfie</p>
              <p className="text-xs text-muted-foreground">Status dan menit terlambat dihitung otomatis dari Log Absen Selfie — termasuk status Izin / Sakit / Cuti / Libur yang dipilih crew saat absen.</p>
            </div>
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
                  <td className="p-3 font-medium">
                    <button
                      type="button"
                      onClick={() => setDetailUserId(s.user_id)}
                      className="text-left hover:text-primary hover:underline focus:outline-none focus:text-primary"
                      title="Lihat detail absensi bulan ini"
                    >
                      {s.name}
                    </button>
                  </td>
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
                      <tr key={r.id} className={cn('border-t border-border/50 hover:bg-muted/20', isDup && 'bg-destructive/5', r._auto && 'bg-emerald-500/5')}>
                        <td className="p-3 font-mono text-xs">{r.attendance_date}</td>
                        <td className="p-3">
                          <div className="font-medium flex items-center gap-1.5">
                            {prof?.full_name || '—'}
                            {r._auto && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                                <Camera className="w-3 h-3" /> Selfie
                              </span>
                            )}
                          </div>
                          {isDup && <span className="text-[10px] uppercase font-bold text-destructive">Duplikat</span>}
                          {r._auto && r.late_notes && <div className="text-[10px] text-muted-foreground mt-0.5">{r.late_notes}</div>}
                        </td>
                        <td className="p-3"><span className="text-xs font-bold">{DB_TO_CODE[r.status] || r.status}</span></td>
                        <td className="p-3 text-right">{r.late_minutes || 0} mnt</td>
                        <td className="p-3 text-right">Rp {Number(r.cashbon_amount || 0).toLocaleString('id-ID')}</td>
                        <td className="p-3 text-right">
                          {r._auto ? (
                            <span className="text-[10px] text-muted-foreground italic">Otomatis</span>
                          ) : (
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
                          )}
                        </td>
                      </tr>
                    );
                  })}

                </tbody>
              </table>
            </div>
          </div>
        )}

        <Dialog open={!!detailUserId} onOpenChange={(o) => !o && setDetailUserId(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            {(() => {
              if (!detailUserId) return null;
              const prof = profileMap.get(detailUserId);
              const today = new Date();
              const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;
              const lastDay = isCurrentMonth ? today.getDate() : new Date(year, month, 0).getDate();
              const userRecs = records.filter((r) => r.user_id === detailUserId);
              const byDate = new Map<string, any>();
              userRecs.forEach((r) => { byDate.set(r.attendance_date, r); });
              const days: { date: string; rec: any | null }[] = [];
              for (let d = 1; d <= lastDay; d++) {
                const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                days.push({ date: ds, rec: byDate.get(ds) || null });
              }
              return (
                <>
                  <DialogHeader>
                    <DialogTitle>{prof?.full_name || 'Karyawan'}</DialogTitle>
                    <DialogDescription>
                      Detail absensi {periodLabel} — 1 s/d {lastDay} {isCurrentMonth ? '(bulan berjalan)' : ''}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="overflow-x-auto rounded-lg border border-border mt-2">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr className="text-left text-xs uppercase text-muted-foreground">
                          <th className="p-2">Tanggal</th>
                          <th className="p-2">Hari</th>
                          <th className="p-2">Status</th>
                          <th className="p-2 text-right">Terlambat</th>
                          <th className="p-2">Keterangan</th>
                          {isAdmin && <th className="p-2 text-right">Aksi</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {days.map(({ date: ds, rec }) => {
                          const dObj = parseISO(ds);
                          const code = rec ? (DB_TO_CODE[rec.status] || '-') : '–';
                          const def = STATUS_DEFS.find((s) => s.code === code);
                          const isEditing = isAdmin && editingDate === ds;
                          return (
                            <tr key={ds} className="border-t border-border/50">
                              <td className="p-2 font-mono text-xs">{format(dObj, 'dd MMM', { locale: idLocale })}</td>
                              <td className="p-2 text-xs text-muted-foreground">{format(dObj, 'EEEE', { locale: idLocale })}</td>
                              <td className="p-2">
                                {rec ? (
                                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-xs font-bold', def?.cls)}>
                                    {code} · {def?.label}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">Belum absen</span>
                                )}
                                {rec?._auto && (
                                  <span className="ml-1 inline-flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">
                                    <Camera className="w-3 h-3" />
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-right text-xs">
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    value={editValue}
                                    onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                                    className="h-7 w-20 ml-auto text-right"
                                  />
                                ) : (
                                  rec ? `${rec.late_minutes || 0} mnt` : '-'
                                )}
                              </td>
                              <td className="p-2 text-xs text-muted-foreground">
                                {isEditing ? (
                                  <Input
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    placeholder="Catatan mitigasi"
                                    className="h-7 text-xs"
                                  />
                                ) : (
                                  rec?.late_notes || rec?.notes || ''
                                )}
                              </td>
                              {isAdmin && (
                                <td className="p-2 text-right">
                                  {isEditing ? (
                                    <div className="flex gap-1 justify-end">
                                      <Button size="sm" variant="ghost" onClick={() => setEditingDate(null)} disabled={editSaving}>Batal</Button>
                                      <Button size="sm" onClick={() => saveEditLate(ds)} disabled={editSaving}>
                                        {editSaving ? '...' : 'Simpan'}
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button size="sm" variant="ghost" onClick={() => startEditLate(rec, ds)} title="Edit terlambat">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function SelfieLogsTab({ outlets, allProfiles, role }: { outlets: { id: string; name: string }[]; allProfiles: Profile[]; role: AppRole | null }) {
  const { toast } = useToast();
  const isAdmin = role === 'admin';
  const { resolve: resolveThresholds, shiftsForOutlet, shiftNames } = useAttendanceThresholds();
  const [logs, setLogs] = useState<any[]>([]);
  const [date, setDate] = usePersistentState<string>('attendance:logs:date', new Date().toISOString().split('T')[0]);
  const [userFilter, setUserFilter] = usePersistentState<string>('attendance:logs:userFilter', 'all');
  const [outletFilter, setOutletFilter] = usePersistentState<string>('attendance:logs:outletFilter', 'all');
  const [typeFilter, setTypeFilter] = usePersistentState<'all' | 'check_in' | 'check_out'>('attendance:logs:typeFilter', 'all');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [rolesByUser, setRolesByUser] = useState<Record<string, string[]>>({});

  // Fetch role per user supaya bisa menentukan siapa yang dikecualikan dari ambang waktu.
  useEffect(() => {
    if (allProfiles.length === 0) { setRolesByUser({}); return; }
    const ids = allProfiles.map((p) => p.user_id);
    supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', ids)
      .then(({ data }) => {
        const map: Record<string, string[]> = {};
        (data || []).forEach((r: any) => {
          if (!map[r.user_id]) map[r.user_id] = [];
          map[r.user_id].push(String(r.role));
        });
        setRolesByUser(map);
      });
  }, [allProfiles]);

  const isUserExempt = (userId: string) => (rolesByUser[userId] || []).some((r) => isRoleExempt(r));

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
  const filtered = logs
    .filter((l) => userFilter === 'all' || l.user_id === userFilter)
    .filter((l) => typeFilter === 'all' || l.log_type === typeFilter);

  const STATUS_OVERRIDE_OPTIONS: { key: string; label: string }[] = [
    { key: 'on_time', label: 'Tepat Waktu' },
    { key: 'late', label: 'Terlambat' },
    { key: 'early_in', label: 'Datang Awal' },
    { key: 'early_out', label: 'Pulang Duluan' },
    { key: 'exempt', label: 'Bebas Jam' },
  ];

  const computeStatus = (log: any) => {
    const exempt = isUserExempt(log.user_id);
    const shiftName = log.shift_name || 'Default';
    const auto = getAttendanceStatus(log.created_at, log.log_type, resolveThresholds(log.outlet_id, shiftName), { exempt });
    // Hilangkan label "Lembur" pada log selfie — tampilkan sebagai Tepat Waktu
    if (auto.key === 'overtime') {
      auto.key = 'on_time';
      auto.label = 'Tepat Waktu';
      auto.className = 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
    }
    if (log.status_override && log.status_override !== 'overtime') {
      const opt = STATUS_OVERRIDE_OPTIONS.find((o) => o.key === log.status_override);
      if (opt) {
        // Reuse className mapping by calling getAttendanceStatus once with exempt trick is not ideal;
        // instead, derive class from a lookup of a synthetic call.
        const synthetic = { ...auto, key: log.status_override as any, label: opt.label };
        // Reuse the className convention by pulling from STATUS_LABELS via a fresh getAttendanceStatus
        // call won't work cleanly; instead inline a minimal class map:
        const CLS: Record<string, string> = {
          on_time:  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
          late:     'bg-destructive/15 text-destructive',
          early_in: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
          early_out:'bg-amber-500/15 text-amber-700 dark:text-amber-400',
          overtime: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
          exempt:   'bg-slate-500/15 text-slate-700 dark:text-slate-300',
        };
        synthetic.className = CLS[log.status_override] || auto.className;
        return { info: synthetic, overridden: true };
      }
    }
    return { info: auto, overridden: false };
  };

  const exportRows = filtered.map((log) => {
    const prof = profileMap.get(log.user_id);
    const shiftName = log.shift_name || 'Default';
    const { info: status, overridden } = computeStatus(log);
    return {
      tanggal: format(new Date(log.created_at), 'yyyy-MM-dd'),
      waktu: format(new Date(log.created_at), 'HH:mm:ss'),
      karyawan: prof?.full_name || '-',
      outlet: outletMap.get(log.outlet_id || '') || '-',
      tipe: log.log_type === 'check_in' ? 'Check In' : 'Check Out',
      shift: shiftName,
      status_jam: status.label + (overridden ? ' (koreksi)' : ''),
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

  const correctStatus = async (logId: string, override: string | null, note: string) => {
    const payload: any = override === null
      ? { status_override: null, status_override_by: null, status_override_at: null, status_override_note: null }
      : {
          status_override: override,
          status_override_by: (await supabase.auth.getUser()).data.user?.id || null,
          status_override_at: new Date().toISOString(),
          status_override_note: note || null,
        };
    const { error } = await supabase.from('attendance_logs').update(payload).eq('id', logId);
    if (error) {
      toast({ title: 'Gagal koreksi status', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: override === null ? 'Koreksi dihapus' : 'Status dikoreksi' });
    reload();
  };

  const editShift = async (logId: string, newShift: string) => {
    const { error } = await supabase
      .from('attendance_logs')
      .update({ shift_name: newShift } as any)
      .eq('id', logId);
    if (error) {
      toast({ title: 'Gagal mengubah shift', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Shift diperbarui', description: `Shift diubah menjadi ${newShift}.` });
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
          <div className="inline-flex rounded-md border border-input overflow-hidden">
            {([
              { v: 'all', l: 'Semua' },
              { v: 'check_in', l: 'IN' },
              { v: 'check_out', l: 'OUT' },
            ] as const).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => setTypeFilter(opt.v)}
                className={`px-3 h-10 text-sm transition-colors ${
                  typeFilter === opt.v
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-accent'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
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
                <th className="p-3">Shift</th>
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
                const shiftName = log.shift_name || 'Default';
                const { info: status, overridden } = computeStatus(log);
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
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted/60 text-foreground">
                        {shiftName}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium w-fit', status.className)}>
                          {status.label}{overridden ? ' *' : ''}
                        </span>
                        {status.key !== 'unknown' && status.key !== 'on_time' && status.key !== 'exempt' && (
                          <span className="text-[10px] font-mono text-muted-foreground">{formatDiffMinutes(status.diffMinutes)}</span>
                        )}
                        {overridden && (
                          <span className="text-[10px] text-muted-foreground italic" title={log.status_override_note || ''}>
                            dikoreksi admin
                          </span>
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
                        <div className="flex items-center justify-end gap-1">
                          <EditShiftDialog
                            log={log}
                            availableShifts={Array.from(new Set([
                              ...(shiftsForOutlet(log.outlet_id) || []),
                              ...(shiftNames || []),
                              'Default',
                            ]))}
                            onSave={(newShift) => editShift(log.id, newShift)}
                          />
                          <CorrectStatusDialog
                            log={log}
                            options={STATUS_OVERRIDE_OPTIONS}
                            onSave={(override, note) => correctStatus(log.id, override, note)}
                          />
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
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={isAdmin ? 9 : 8} className="p-8 text-center text-muted-foreground">Belum ada log absen selfie pada tanggal ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function CorrectStatusDialog({
  log,
  options,
  onSave,
}: {
  log: any;
  options: { key: string; label: string }[];
  onSave: (override: string | null, note: string) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(log.status_override || '');
  const [note, setNote] = useState<string>(log.status_override_note || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(log.status_override || '');
      setNote(log.status_override_note || '');
    }
  }, [open, log.status_override, log.status_override_note]);

  const handleSave = async () => {
    setBusy(true);
    await onSave(value || null, note);
    setBusy(false);
    setOpen(false);
  };

  const handleClear = async () => {
    setBusy(true);
    await onSave(null, '');
    setBusy(false);
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Koreksi status jam">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Koreksi Status Jam</AlertDialogTitle>
          <AlertDialogDescription>
            Ubah status hasil perhitungan otomatis (mis. dari Terlambat menjadi Tepat Waktu).
            Status koreksi akan menggantikan status otomatis di tampilan & ekspor.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Status Baru</label>
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">— Gunakan otomatis —</option>
              {options.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Catatan Koreksi (opsional)</label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="mis. salah pilih shift, jam server tidak sinkron, dll."
            />
          </div>
        </div>
        <AlertDialogFooter>
          {log.status_override && (
            <Button variant="outline" onClick={handleClear} disabled={busy}>
              Hapus Koreksi
            </Button>
          )}
          <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={busy}>
            Simpan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function EditShiftDialog({
  log,
  availableShifts,
  onSave,
}: {
  log: any;
  availableShifts: string[];
  onSave: (newShift: string) => Promise<void> | void;
}) {
  const currentShift = log.shift_name || 'Default';
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(currentShift);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setValue(currentShift);
  }, [open, currentShift]);

  const handleSave = async () => {
    if (!value || value === currentShift) {
      setOpen(false);
      return;
    }
    setBusy(true);
    await onSave(value);
    setBusy(false);
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Ubah shift">
          <CalendarCheck className="w-3.5 h-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ubah Shift Log Absen</AlertDialogTitle>
          <AlertDialogDescription>
            Pilih shift yang benar untuk log ini. Status jam (Tepat Waktu / Terlambat / Pulang Duluan)
            akan dihitung ulang otomatis sesuai ambang waktu shift yang dipilih.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Shift Saat Ini</label>
            <div className="text-sm text-muted-foreground">{currentShift}</div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Shift Baru</label>
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
            >
              {availableShifts.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={handleSave} disabled={busy}>
            Simpan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
