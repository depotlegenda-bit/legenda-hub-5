import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Clock, Save, Store, Trash2, Plus, Layers, Pencil, ListChecks } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAttendanceThresholds } from '@/hooks/useAttendanceThresholds';
import { useOutlets } from '@/hooks/useOutlets';
import { getAttendanceStatus, formatDiffMinutes, DEFAULT_THRESHOLDS } from '@/lib/attendanceStatus';

const GLOBAL_KEY = '__global__';

function toTimeInput(t?: string) {
  if (!t) return '';
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function normalizeShiftName(s: string) {
  return s.trim().replace(/\s+/g, ' ');
}

export default function AttendanceThresholdsTab() {
  const { rows, getRow, refetch, loading, shiftsForOutlet } = useAttendanceThresholds();
  const { outlets } = useOutlets();

  const [activeOutlet, setActiveOutlet] = useState<string>(GLOBAL_KEY);
  const [activeShift, setActiveShift] = useState<string>('Default');

  const [checkInStart, setCheckInStart] = useState('07:00');
  const [checkInLate, setCheckInLate] = useState('08:00');
  const [checkOutEarliest, setCheckOutEarliest] = useState('17:00');
  const [checkOutLatest, setCheckOutLatest] = useState('22:00');
  const [earlyMinutes, setEarlyMinutes] = useState(30);
  const [saving, setSaving] = useState(false);

  // Dialog tambah shift
  const [addOpen, setAddOpen] = useState(false);
  const [newShiftName, setNewShiftName] = useState('');

  const currentOutletId = activeOutlet === GLOBAL_KEY ? null : activeOutlet;
  const availableShifts = shiftsForOutlet(currentOutletId);

  // Pastikan activeShift tetap valid bila ganti cabang
  useEffect(() => {
    if (!availableShifts.includes(activeShift)) {
      setActiveShift(availableShifts[0] || 'Default');
    }
  }, [activeOutlet, availableShifts.join('|')]);

  const currentRow = getRow(currentOutletId, activeShift);

  // Load nilai sesuai cabang+shift aktif. Fallback ke global+shift, lalu global+Default, lalu DEFAULT.
  useEffect(() => {
    const src =
      currentRow ||
      getRow(null, activeShift) ||
      getRow(null, 'Default') ||
      ({ ...DEFAULT_THRESHOLDS } as any);
    setCheckInStart(toTimeInput((src as any).check_in_start));
    setCheckInLate(toTimeInput((src as any).check_in_late_after));
    setCheckOutEarliest(toTimeInput((src as any).check_out_earliest));
    setCheckOutLatest(toTimeInput((src as any).check_out_latest));
    setEarlyMinutes((src as any).early_checkin_minutes ?? 30);
  }, [activeOutlet, activeShift, rows]);

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
      shift_name: activeShift,
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
      `Tersimpan: ${currentOutletId ? 'cabang' : 'global'} • shift "${activeShift}"`,
    );
    refetch();
  };

  const handleDeleteShift = async () => {
    if (!currentRow?.id) {
      // Tidak ada baris di DB untuk kombinasi ini → cukup pindah shift
      toast.info('Belum ada data tersimpan untuk shift ini');
      return;
    }
    const label = currentOutletId ? 'cabang ini' : 'pengaturan global';
    if (!confirm(`Hapus shift "${activeShift}" untuk ${label}?`)) return;
    const { error } = await (supabase as any)
      .from('attendance_thresholds')
      .delete()
      .eq('id', currentRow.id);
    if (error) {
      toast.error(error.message || 'Gagal menghapus shift');
      return;
    }
    toast.success(`Shift "${activeShift}" dihapus`);
    setActiveShift('Default');
    refetch();
  };

  const handleAddShift = () => {
    const name = normalizeShiftName(newShiftName);
    if (!name) {
      toast.error('Nama shift tidak boleh kosong');
      return;
    }
    if (availableShifts.includes(name)) {
      toast.error('Shift dengan nama tersebut sudah ada');
      return;
    }
    setActiveShift(name);
    setAddOpen(false);
    setNewShiftName('');
    toast.message(`Shift "${name}" ditambahkan. Atur jam lalu klik Simpan untuk menyimpannya.`);
  };

  const handleEditRow = (row: typeof rows[number]) => {
    setActiveOutlet(row.outlet_id ?? GLOBAL_KEY);
    setActiveShift(row.shift_name || 'Default');
    // Scroll ke atas form
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.message(`Memuat pengaturan: ${row.outlet_id ? outlets.find((o) => o.id === row.outlet_id)?.name ?? 'Cabang' : 'Global'} • shift "${row.shift_name}"`);
  };

  const handleDeleteRow = async (row: typeof rows[number]) => {
    const outletLabel = row.outlet_id ? outlets.find((o) => o.id === row.outlet_id)?.name ?? 'cabang' : 'global';
    if (!confirm(`Hapus pengaturan ${outletLabel} • shift "${row.shift_name}"?`)) return;
    const { error } = await (supabase as any).from('attendance_thresholds').delete().eq('id', row.id);
    if (error) {
      toast.error(error.message || 'Gagal menghapus pengaturan');
      return;
    }
    toast.success('Pengaturan dihapus');
    refetch();
  };

  const outletName = (id: string | null) =>
    id ? outlets.find((o) => o.id === id)?.name ?? '—' : 'Default Global';
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
          Atur jam standar check-in & check-out per cabang dan per shift. Status otomatis
          (Tepat Waktu / Terlambat / Pulang Duluan / Lembur) dihitung berdasarkan ambang ini dan
          tampil di log absen selfie. Kalau cabang/shift tidak punya pengaturan khusus, sistem
          memakai pengaturan global, lalu shift "Default" sebagai fallback terakhir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pilihan cabang & shift */}
        <section className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Store className="w-4 h-4 text-muted-foreground" /> Cabang
              </Label>
              <Select value={activeOutlet} onValueChange={setActiveOutlet}>
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="w-4 h-4 text-muted-foreground" /> Shift
              </Label>
              <div className="flex gap-2">
                <Select value={activeShift} onValueChange={setActiveShift}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Pilih shift" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableShifts.map((s) => {
                      const exists = !!getRow(currentOutletId, s);
                      return (
                        <SelectItem key={s} value={s}>
                          {s} {exists ? '• tersimpan' : '• belum ada'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" title="Tambah shift">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Tambah Shift Baru</DialogTitle>
                      <DialogDescription>
                        Beri nama shift (mis. Pagi, Siang, Malam, Weekend). Nama unik per cabang.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label>Nama Shift</Label>
                      <Input
                        value={newShiftName}
                        onChange={(e) => setNewShiftName(e.target.value)}
                        placeholder="Pagi"
                        autoFocus
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setAddOpen(false)}>
                        Batal
                      </Button>
                      <Button onClick={handleAddShift}>
                        <Plus className="w-4 h-4 mr-1" /> Tambah
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleDeleteShift}
                  disabled={!currentRow?.id}
                  title="Hapus shift ini"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Status:</span>
            {currentRow?.id ? (
              <Badge variant="secondary">
                Tersimpan • {currentOutletId ? 'cabang' : 'global'} • shift "{activeShift}"
              </Badge>
            ) : (
              <Badge variant="outline">
                Belum ada — isi & simpan untuk membuat pengaturan {currentOutletId ? 'cabang' : 'global'} shift "{activeShift}"
              </Badge>
            )}
          </div>
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
              : `Simpan ${currentOutletId ? 'Cabang' : 'Global'} • Shift "${activeShift}"`}
          </Button>
        </div>

        {/* Rekap pengaturan tersimpan */}
        <section className="space-y-3 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Rekap Ambang Waktu Tersimpan</h3>
            <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Daftar semua pengaturan ambang waktu per cabang & shift yang sudah disimpan. Klik
            edit untuk memuatnya ke form di atas, atau hapus untuk menghilangkannya.
          </p>

          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cabang</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead className="hidden md:table-cell">Check-In</TableHead>
                  <TableHead className="hidden md:table-cell">Check-Out</TableHead>
                  <TableHead className="hidden lg:table-cell">Toleransi Awal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                      Memuat…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                      Belum ada pengaturan tersimpan.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  rows.map((r) => {
                    const isActive =
                      (r.outlet_id ?? null) === (currentOutletId ?? null) &&
                      (r.shift_name || 'Default') === activeShift;
                    return (
                      <TableRow key={r.id} className={isActive ? 'bg-muted/40' : ''}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {r.outlet_id ? (
                              <Store className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">GLOBAL</Badge>
                            )}
                            <span className="truncate">{outletName(r.outlet_id)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">{r.shift_name || 'Default'}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-mono text-xs">
                          {toTimeInput(r.check_in_start)} – {toTimeInput(r.check_in_late_after)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-mono text-xs">
                          {toTimeInput(r.check_out_earliest)} – {toTimeInput(r.check_out_latest)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">
                          {r.early_checkin_minutes ?? 30} mnt
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditRow(r)}
                              title="Edit pengaturan ini"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteRow(r)}
                              title="Hapus pengaturan ini"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
