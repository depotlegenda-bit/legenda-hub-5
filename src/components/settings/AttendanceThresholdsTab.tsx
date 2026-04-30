import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Save, Store, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAttendanceThresholds } from '@/hooks/useAttendanceThresholds';
import { useOutlets } from '@/hooks/useOutlets';
import { getAttendanceStatus, formatDiffMinutes, DEFAULT_THRESHOLDS } from '@/lib/attendanceStatus';

const GLOBAL_KEY = '__global__';

// Normalisasi 'HH:MM:SS' atau 'HH:MM' → 'HH:MM' untuk input type=time
function toTimeInput(t?: string) {
  if (!t) return '';
  return t.length >= 5 ? t.slice(0, 5) : t;
}

export default function AttendanceThresholdsTab() {
  const { rows, getRow, refetch, loading } = useAttendanceThresholds();
  const { outlets } = useOutlets();

  // Cabang aktif yang sedang diatur (GLOBAL_KEY = default global, atau outlet.id)
  const [activeOutlet, setActiveOutlet] = useState<string>(GLOBAL_KEY);

  const [checkInStart, setCheckInStart] = useState('07:00');
  const [checkInLate, setCheckInLate] = useState('08:00');
  const [checkOutEarliest, setCheckOutEarliest] = useState('17:00');
  const [checkOutLatest, setCheckOutLatest] = useState('22:00');
  const [earlyMinutes, setEarlyMinutes] = useState(30);
  const [saving, setSaving] = useState(false);

  const currentOutletId = activeOutlet === GLOBAL_KEY ? null : activeOutlet;
  const currentRow = getRow(currentOutletId);

  // Load nilai sesuai cabang aktif. Jika belum ada baris untuk cabang ini,
  // pakai nilai global sebagai starting point (atau DEFAULT bila global juga belum ada).
  useEffect(() => {
    const src = currentRow || getRow(null) || {
      ...DEFAULT_THRESHOLDS,
    };
    setCheckInStart(toTimeInput((src as any).check_in_start));
    setCheckInLate(toTimeInput((src as any).check_in_late_after));
    setCheckOutEarliest(toTimeInput((src as any).check_out_earliest));
    setCheckOutLatest(toTimeInput((src as any).check_out_latest));
    setEarlyMinutes((src as any).early_checkin_minutes ?? 30);
  }, [activeOutlet, rows]);

  const handleSave = async () => {
    if (checkInStart >= checkInLate) {
      toast.error('Jam batas terlambat harus setelah jam mulai check-in');
      return;
    }
    if (checkOutEarliest >= checkOutLatest) {
      toast.error('Jam batas check-out harus setelah jam paling awal pulang');
      return;
    }
    setSaving(true);
    const payload = {
      check_in_start: checkInStart,
      check_in_late_after: checkInLate,
      check_out_earliest: checkOutEarliest,
      check_out_latest: checkOutLatest,
      early_checkin_minutes: earlyMinutes,
      outlet_id: currentOutletId,
      updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    };
    const client = supabase as any;
    const { error } = currentRow?.id
      ? await client.from('attendance_thresholds').update(payload).eq('id', currentRow.id)
      : await client.from('attendance_thresholds').insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message || 'Gagal menyimpan pengaturan');
      return;
    }
    toast.success(
      currentOutletId
        ? `Pengaturan untuk cabang tersimpan`
        : 'Pengaturan default global tersimpan',
    );
    refetch();
  };

  const handleResetToGlobal = async () => {
    if (!currentOutletId || !currentRow?.id) return;
    if (!confirm('Hapus pengaturan khusus cabang ini? Cabang akan kembali memakai pengaturan default global.')) return;
    const { error } = await (supabase as any)
      .from('attendance_thresholds')
      .delete()
      .eq('id', currentRow.id);
    if (error) {
      toast.error(error.message || 'Gagal menghapus pengaturan');
      return;
    }
    toast.success('Pengaturan cabang dihapus, kembali ke default global');
    refetch();
  };

  // Preview status berdasarkan nilai yang sedang diedit
  const editingThresholds = {
    check_in_start: checkInStart,
    check_in_late_after: checkInLate,
    check_out_earliest: checkOutEarliest,
    check_out_latest: checkOutLatest,
    early_checkin_minutes: earlyMinutes,
  };
  const previewCheckIn = getAttendanceStatus(new Date(), 'check_in', editingThresholds);
  const previewCheckOut = getAttendanceStatus(new Date(), 'check_out', editingThresholds);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" /> Ambang Waktu Absensi
        </CardTitle>
        <CardDescription>
          Atur jam standar check-in & check-out per cabang. Status otomatis (Tepat Waktu / Terlambat /
          Pulang Duluan / Lembur) akan dihitung berdasarkan ambang ini dan tampil di log absen selfie.
          Cabang yang tidak punya pengaturan khusus akan memakai pengaturan default global.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pilihan cabang */}
        <section className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-semibold">
            <Store className="w-4 h-4 text-muted-foreground" /> Pilih Cabang
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={activeOutlet} onValueChange={setActiveOutlet}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Pilih cabang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GLOBAL_KEY}>
                  Default Global (semua cabang tanpa pengaturan khusus)
                </SelectItem>
                {outlets.map((o) => {
                  const hasCustom = !!rows.find((r) => r.outlet_id === o.id);
                  return (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} {hasCustom ? '• custom' : '• pakai default'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {currentOutletId && currentRow?.id && (
              <Button variant="ghost" size="sm" onClick={handleResetToGlobal} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-1" /> Hapus & pakai default
              </Button>
            )}
          </div>
          {currentOutletId && !currentRow?.id && (
            <p className="text-xs text-muted-foreground">
              Cabang ini belum punya pengaturan khusus. Mengisi & menyimpan form di bawah akan membuat
              pengaturan khusus untuk cabang ini.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Check-In</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Jam Mulai Check-In</Label>
              <Input type="time" value={checkInStart} onChange={(e) => setCheckInStart(e.target.value)} />
              <p className="text-xs text-muted-foreground">Jam ideal karyawan mulai absen masuk.</p>
            </div>
            <div className="space-y-2">
              <Label>Batas Terlambat (Setelah jam ini = Terlambat)</Label>
              <Input type="time" value={checkInLate} onChange={(e) => setCheckInLate(e.target.value)} />
              <p className="text-xs text-muted-foreground">Check-in setelah jam ini ditandai Terlambat.</p>
            </div>
          </div>
          <div className="space-y-2 max-w-xs">
            <Label>Toleransi Datang Lebih Awal (menit)</Label>
            <Input
              type="number"
              min={0}
              max={240}
              value={earlyMinutes}
              onChange={(e) => setEarlyMinutes(Math.max(0, Math.min(240, Number(e.target.value) || 0)))}
            />
            <p className="text-xs text-muted-foreground">
              Datang lebih awal dari toleransi ini ditandai "Datang Awal".
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Check-Out</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Jam Paling Awal Pulang</Label>
              <Input type="time" value={checkOutEarliest} onChange={(e) => setCheckOutEarliest(e.target.value)} />
              <p className="text-xs text-muted-foreground">Check-out sebelum jam ini ditandai Pulang Duluan.</p>
            </div>
            <div className="space-y-2">
              <Label>Batas Akhir Check-Out</Label>
              <Input type="time" value={checkOutLatest} onChange={(e) => setCheckOutLatest(e.target.value)} />
              <p className="text-xs text-muted-foreground">Check-out setelah jam ini ditandai Lembur.</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Pratinjau (jika absen sekarang — {new Date().toLocaleTimeString('id-ID')})
          </p>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className={`px-3 py-1 rounded ${previewCheckIn.className}`}>
              Check-In: {previewCheckIn.label}
              {previewCheckIn.key !== 'on_time' && previewCheckIn.key !== 'unknown' && (
                <span className="ml-2 font-mono text-xs opacity-80">{formatDiffMinutes(previewCheckIn.diffMinutes)}</span>
              )}
            </span>
            <span className={`px-3 py-1 rounded ${previewCheckOut.className}`}>
              Check-Out: {previewCheckOut.label}
              {previewCheckOut.key !== 'on_time' && previewCheckOut.key !== 'unknown' && (
                <span className="ml-2 font-mono text-xs opacity-80">{formatDiffMinutes(previewCheckOut.diffMinutes)}</span>
              )}
            </span>
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || loading}>
            <Save className="w-4 h-4 mr-2" />
            {saving
              ? 'Menyimpan...'
              : currentOutletId
                ? 'Simpan Pengaturan Cabang'
                : 'Simpan Default Global'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
