import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardCheck, Loader2, Save, Trash2, X, Eye } from 'lucide-react';

type Report = {
  id: string;
  user_id: string;
  outlet_id: string | null;
  report_date: string;
  operational_condition: string;
  crew_present: number | null;
  cleanliness: string | null;
  equipment_condition: string | null;
  critical_stock: string | null;
  issues: string | null;
  actions_taken: string | null;
  notes_for_management: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
};

type Outlet = { id: string; name: string };
type ProfileLite = { user_id: string; full_name: string; outlet_id: string | null };

const OPERATIONAL = ['Lancar', 'Ada Kendala', 'Tutup Sementara'];
const CLEANLINESS = ['Baik', 'Cukup', 'Kurang'];
const EQUIPMENT = ['Normal', 'Perlu Perbaikan', 'Rusak'];

function todayIso() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export default function PicDailyReportPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const canSeeAll = role === 'admin' || role === 'management';

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [myProfile, setMyProfile] = useState<ProfileLite | null>(null);

  // form state
  const [reportDate, setReportDate] = useState<string>(todayIso());
  const [outletId, setOutletId] = useState<string>('');
  const [operational, setOperational] = useState<string>('Lancar');
  const [crewPresent, setCrewPresent] = useState<string>('');
  const [cleanliness, setCleanliness] = useState<string>('Baik');
  const [equipment, setEquipment] = useState<string>('Normal');
  const [criticalStock, setCriticalStock] = useState<string>('');
  const [issues, setIssues] = useState<string>('');
  const [actions, setActions] = useState<string>('');
  const [notesMgmt, setNotesMgmt] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  // recap state
  const [recap, setRecap] = useState<Report[]>([]);
  const [recapLoading, setRecapLoading] = useState(false);
  const [filterFrom, setFilterFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 10);
  });
  const [filterTo, setFilterTo] = useState<string>(todayIso());
  const [filterOutlet, setFilterOutlet] = useState<string>('all');
  const [filterPic, setFilterPic] = useState<string>('all');
  const [detail, setDetail] = useState<Report | null>(null);

  // Load outlets + profiles
  useEffect(() => {
    supabase.from('outlets').select('id, name').order('name').then(({ data }) => {
      if (data) setOutlets(data);
    });
    supabase
      .from('profiles')
      .select('user_id, full_name, outlet_id')
      .order('full_name')
      .then(({ data }) => {
        if (data) setProfiles(data as ProfileLite[]);
      });
  }, []);

  // Load own profile + default outlet for form
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('user_id, full_name, outlet_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setMyProfile(data as ProfileLite);
          if (!outletId && data.outlet_id) setOutletId(data.outlet_id);
        }
      });
  }, [user]);

  // Load existing report for selected date+outlet (current user)
  useEffect(() => {
    if (!user || !outletId || !reportDate) return;
    supabase
      .from('pic_daily_reports')
      .select('*')
      .eq('user_id', user.id)
      .eq('outlet_id', outletId)
      .eq('report_date', reportDate)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const r = data as any;
          setExistingId(r.id);
          setOperational(r.operational_condition || 'Lancar');
          setCrewPresent(r.crew_present?.toString() ?? '');
          setCleanliness(r.cleanliness || 'Baik');
          setEquipment(r.equipment_condition || 'Normal');
          setCriticalStock(r.critical_stock || '');
          setIssues(r.issues || '');
          setActions(r.actions_taken || '');
          setNotesMgmt(r.notes_for_management || '');
          setPhotos(Array.isArray(r.photos) ? r.photos : []);
        } else {
          setExistingId(null);
          setOperational('Lancar');
          setCrewPresent('');
          setCleanliness('Baik');
          setEquipment('Normal');
          setCriticalStock('');
          setIssues('');
          setActions('');
          setNotesMgmt('');
          setPhotos([]);
        }
      });
  }, [user, outletId, reportDate]);

  const loadRecap = async () => {
    setRecapLoading(true);
    let q = supabase
      .from('pic_daily_reports')
      .select('*')
      .gte('report_date', filterFrom)
      .lte('report_date', filterTo)
      .order('report_date', { ascending: false });
    if (filterOutlet !== 'all') q = q.eq('outlet_id', filterOutlet);
    if (filterPic !== 'all') q = q.eq('user_id', filterPic);
    const { data, error } = await q;
    setRecapLoading(false);
    if (error) {
      toast({ title: 'Gagal memuat rekap', description: error.message, variant: 'destructive' });
      return;
    }
    setRecap((data || []).map((r: any) => ({ ...r, photos: Array.isArray(r.photos) ? r.photos : [] })));
  };

  useEffect(() => {
    loadRecap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFrom, filterTo, filterOutlet, filterPic]);

  const outletNameMap = useMemo(() => Object.fromEntries(outlets.map((o) => [o.id, o.name])), [outlets]);
  const picNameMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name])), [profiles]);

  const handleUploadPhotos = async (files: FileList | null) => {
    if (!files || !files.length || !user) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('pic-daily-photos').upload(path, file, {
        contentType: file.type || 'image/jpeg',
      });
      if (error) {
        toast({ title: 'Upload gagal', description: error.message, variant: 'destructive' });
        continue;
      }
      uploaded.push(path);
    }
    setPhotos((p) => [...p, ...uploaded]);
    setUploading(false);
  };

  const photoUrl = (path: string) => {
    const { data } = supabase.storage.from('pic-daily-photos').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleRemovePhoto = async (path: string) => {
    setPhotos((p) => p.filter((x) => x !== path));
    await supabase.storage.from('pic-daily-photos').remove([path]);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!outletId) {
      toast({ title: 'Pilih outlet dulu', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      user_id: user.id,
      outlet_id: outletId,
      report_date: reportDate,
      operational_condition: operational,
      crew_present: crewPresent ? parseInt(crewPresent, 10) : null,
      cleanliness,
      equipment_condition: equipment,
      critical_stock: criticalStock || null,
      issues: issues || null,
      actions_taken: actions || null,
      notes_for_management: notesMgmt || null,
      photos,
    };
    const { data, error } = existingId
      ? await supabase.from('pic_daily_reports').update(payload).eq('id', existingId).select().maybeSingle()
      : await supabase.from('pic_daily_reports').insert(payload).select().maybeSingle();
    setSaving(false);
    if (error) {
      toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
      return;
    }
    if (data) setExistingId((data as any).id);
    toast({ title: existingId ? 'Laporan diperbarui' : 'Laporan tersimpan' });
    loadRecap();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus laporan ini?')) return;
    const { error } = await supabase.from('pic_daily_reports').delete().eq('id', id);
    if (error) {
      toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Laporan dihapus' });
    if (existingId === id) setExistingId(null);
    loadRecap();
    setDetail(null);
  };

  const conditionBadge = (val: string) => {
    const color =
      val === 'Lancar' || val === 'Baik' || val === 'Normal'
        ? 'default'
        : val === 'Ada Kendala' || val === 'Cukup' || val === 'Perlu Perbaikan'
        ? 'secondary'
        : 'destructive';
    return <Badge variant={color as any}>{val}</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Laporan Harian PIC</h1>
        </div>

        <Tabs defaultValue="input">
          <TabsList>
            <TabsTrigger value="input">Input Laporan</TabsTrigger>
            <TabsTrigger value="recap">Rekap Laporan</TabsTrigger>
          </TabsList>

          {/* ---------------- INPUT ---------------- */}
          <TabsContent value="input">
            <Card>
              <CardHeader>
                <CardTitle>
                  {existingId ? 'Perbarui Laporan' : 'Input Laporan Harian'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Tanggal</Label>
                    <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Outlet</Label>
                    <Select value={outletId} onValueChange={setOutletId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih outlet" />
                      </SelectTrigger>
                      <SelectContent>
                        {outlets.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Kondisi Operasional</Label>
                    <Select value={operational} onValueChange={setOperational}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPERATIONAL.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Jumlah Crew Hadir</Label>
                    <Input type="number" min={0} value={crewPresent} onChange={(e) => setCrewPresent(e.target.value)} />
                  </div>
                  <div>
                    <Label>Kondisi Kebersihan</Label>
                    <Select value={cleanliness} onValueChange={setCleanliness}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CLEANLINESS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Kondisi Peralatan</Label>
                    <Select value={equipment} onValueChange={setEquipment}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EQUIPMENT.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Stok Bahan Kritis</Label>
                    <Textarea rows={3} value={criticalStock} onChange={(e) => setCriticalStock(e.target.value)} placeholder="Item yang menipis / habis..." />
                  </div>
                  <div>
                    <Label>Kendala / Masalah</Label>
                    <Textarea rows={3} value={issues} onChange={(e) => setIssues(e.target.value)} placeholder="Kendala yang terjadi hari ini..." />
                  </div>
                  <div>
                    <Label>Tindakan yang Diambil</Label>
                    <Textarea rows={3} value={actions} onChange={(e) => setActions(e.target.value)} placeholder="Tindakan yang sudah dilakukan..." />
                  </div>
                  <div>
                    <Label>Catatan untuk Management</Label>
                    <Textarea rows={3} value={notesMgmt} onChange={(e) => setNotesMgmt(e.target.value)} placeholder="Hal yang perlu eskalasi ke management..." />
                  </div>
                </div>

                <div>
                  <Label>Foto Lapangan (opsional)</Label>
                  <Input type="file" accept="image/*" multiple onChange={(e) => handleUploadPhotos(e.target.files)} disabled={uploading} />
                  {uploading && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Mengunggah...</p>}
                  {photos.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
                      {photos.map((p) => (
                        <div key={p} className="relative group">
                          <img src={photoUrl(p)} alt="foto" className="w-full h-20 object-cover rounded border" />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(p)}
                            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  {existingId && (
                    <Button variant="destructive" onClick={() => handleDelete(existingId)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Hapus
                    </Button>
                  )}
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    {existingId ? 'Perbarui' : 'Simpan'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---------------- RECAP ---------------- */}
          <TabsContent value="recap">
            <Card>
              <CardHeader>
                <CardTitle>Rekap Laporan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label>Dari</Label>
                    <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label>Sampai</Label>
                    <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
                  </div>
                  <div>
                    <Label>Outlet</Label>
                    <Select value={filterOutlet} onValueChange={setFilterOutlet}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Outlet</SelectItem>
                        {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {canSeeAll && (
                    <div>
                      <Label>PIC</Label>
                      <Select value={filterPic} onValueChange={setFilterPic}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua PIC</SelectItem>
                          {profiles.map((p) => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>PIC</TableHead>
                        <TableHead>Outlet</TableHead>
                        <TableHead>Operasional</TableHead>
                        <TableHead>Kebersihan</TableHead>
                        <TableHead>Peralatan</TableHead>
                        <TableHead>Kendala</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recapLoading ? (
                        <TableRow><TableCell colSpan={8} className="text-center"><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Memuat...</TableCell></TableRow>
                      ) : recap.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Belum ada laporan</TableCell></TableRow>
                      ) : (
                        recap.map((r) => (
                          <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                            <TableCell>{r.report_date}</TableCell>
                            <TableCell>{picNameMap[r.user_id] || '-'}</TableCell>
                            <TableCell>{r.outlet_id ? (outletNameMap[r.outlet_id] || '-') : '-'}</TableCell>
                            <TableCell>{conditionBadge(r.operational_condition)}</TableCell>
                            <TableCell>{r.cleanliness ? conditionBadge(r.cleanliness) : '-'}</TableCell>
                            <TableCell>{r.equipment_condition ? conditionBadge(r.equipment_condition) : '-'}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{r.issues || '-'}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetail(r); }}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ---------- Detail Dialog ---------- */}
        <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detail Laporan — {detail?.report_date}</DialogTitle>
            </DialogHeader>
            {detail && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">PIC:</span> {picNameMap[detail.user_id] || '-'}</div>
                  <div><span className="text-muted-foreground">Outlet:</span> {detail.outlet_id ? outletNameMap[detail.outlet_id] : '-'}</div>
                  <div><span className="text-muted-foreground">Operasional:</span> {conditionBadge(detail.operational_condition)}</div>
                  <div><span className="text-muted-foreground">Crew Hadir:</span> {detail.crew_present ?? '-'}</div>
                  <div><span className="text-muted-foreground">Kebersihan:</span> {detail.cleanliness ? conditionBadge(detail.cleanliness) : '-'}</div>
                  <div><span className="text-muted-foreground">Peralatan:</span> {detail.equipment_condition ? conditionBadge(detail.equipment_condition) : '-'}</div>
                </div>
                {detail.critical_stock && <div><div className="text-muted-foreground">Stok Bahan Kritis</div><div className="whitespace-pre-wrap">{detail.critical_stock}</div></div>}
                {detail.issues && <div><div className="text-muted-foreground">Kendala</div><div className="whitespace-pre-wrap">{detail.issues}</div></div>}
                {detail.actions_taken && <div><div className="text-muted-foreground">Tindakan</div><div className="whitespace-pre-wrap">{detail.actions_taken}</div></div>}
                {detail.notes_for_management && <div><div className="text-muted-foreground">Catatan untuk Management</div><div className="whitespace-pre-wrap">{detail.notes_for_management}</div></div>}
                {detail.photos.length > 0 && (
                  <div>
                    <div className="text-muted-foreground mb-1">Foto Lapangan</div>
                    <div className="grid grid-cols-3 gap-2">
                      {detail.photos.map((p) => (
                        <a key={p} href={photoUrl(p)} target="_blank" rel="noreferrer">
                          <img src={photoUrl(p)} alt="foto" className="w-full h-24 object-cover rounded border" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {(canSeeAll || detail.user_id === user?.id) && (
                  <div className="flex justify-end">
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(detail.id)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Hapus
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
