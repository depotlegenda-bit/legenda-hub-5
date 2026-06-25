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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardCheck, Loader2, Save, Trash2, X, Eye, Sunrise, Activity, Moon } from 'lucide-react';

// === Definisi 3 segmen checklist ===
const SEGMENTS = [
  {
    key: 'opening',
    title: 'Opening',
    icon: Sunrise,
    items: [
      'Opening sesuai jam buka outlet',
      'Cek kelengkapan bahan',
      'Cek kelengkapan staf',
      'Cek modal awal',
      'Cek online food',
      'Cek kebersihan area',
      'Cek kebersihan dapur',
      'Cek asbak dan tisu',
    ],
  },
  {
    key: 'operasional',
    title: 'Operasional',
    icon: Activity,
    items: [
      'Pesanan keluar tidak lebih dari 20 menit',
      'Pesanan keluar sesuai SOP',
      'Memasak sesuai SOP',
      'Tidak ada salah pesanan / salah antar pesanan',
      'Memastikan meja segera di cleanup',
      'Memastikan staf tetap dengan groomingnya',
      'Memastikan staf ramah dan menjaga attitude',
    ],
  },
  {
    key: 'closing',
    title: 'Closing',
    icon: Moon,
    items: [
      'Memastikan kebersihan area',
      'Memastikan stok opname',
      'Memastikan tidak ada minus di kasir',
      'Pelaporan closing report / omset di group',
      'Memastikan cucian kotor sudah bersih semua',
      'Memastikan sampah terbuang',
      'Memastikan sanitasi / selokan bersih',
      'Memastikan kebersihan kamar mandi',
      'Mematikan semua peralatan yg terkoneksi listrik (yg perlu dimatikan)',
      'Memastikan modal kasir untuk besok',
      'Mematikan lampu dan mengunci pintu',
    ],
  },
] as const;

type ChecklistMap = Record<string, Record<string, boolean>>;

type Report = {
  id: string;
  user_id: string;
  outlet_id: string | null;
  report_date: string;
  checklist: ChecklistMap;
  notes_for_management: string | null;
  photos: string[];
  created_at: string;
  updated_at: string;
};

type Outlet = { id: string; name: string };
type ProfileLite = { user_id: string; full_name: string; outlet_id: string | null };

function todayIso() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function emptyChecklist(): ChecklistMap {
  const obj: ChecklistMap = {};
  SEGMENTS.forEach((s) => {
    obj[s.key] = {};
    s.items.forEach((it) => (obj[s.key][it] = false));
  });
  return obj;
}

function countChecked(cl: ChecklistMap, segKey: string) {
  const seg = SEGMENTS.find((s) => s.key === segKey);
  if (!seg) return { done: 0, total: 0 };
  const map = cl?.[segKey] || {};
  const done = seg.items.filter((it) => !!map[it]).length;
  return { done, total: seg.items.length };
}

function totalProgress(cl: ChecklistMap) {
  let done = 0;
  let total = 0;
  SEGMENTS.forEach((s) => {
    const c = countChecked(cl, s.key);
    done += c.done;
    total += c.total;
  });
  return { done, total };
}

export default function PicDailyReportPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const canSeeAll = role === 'admin' || role === 'management';

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);

  // form
  const [reportDate, setReportDate] = useState<string>(todayIso());
  const [outletId, setOutletId] = useState<string>('');
  const [checklist, setChecklist] = useState<ChecklistMap>(emptyChecklist());
  const [notesMgmt, setNotesMgmt] = useState<string>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  // recap
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

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('user_id, full_name, outlet_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data && !outletId && data.outlet_id) setOutletId(data.outlet_id);
      });
  }, [user]);

  // Load existing
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
          const base = emptyChecklist();
          const incoming = (r.checklist || {}) as ChecklistMap;
          SEGMENTS.forEach((s) => {
            s.items.forEach((it) => {
              base[s.key][it] = !!incoming?.[s.key]?.[it];
            });
          });
          setChecklist(base);
          setNotesMgmt(r.notes_for_management || '');
          setPhotos(Array.isArray(r.photos) ? r.photos : []);
        } else {
          setExistingId(null);
          setChecklist(emptyChecklist());
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
    setRecap(
      (data || []).map((r: any) => ({
        ...r,
        photos: Array.isArray(r.photos) ? r.photos : [],
        checklist: (r.checklist || {}) as ChecklistMap,
      })),
    );
  };

  useEffect(() => {
    loadRecap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterFrom, filterTo, filterOutlet, filterPic]);

  const outletNameMap = useMemo(() => Object.fromEntries(outlets.map((o) => [o.id, o.name])), [outlets]);
  const picNameMap = useMemo(() => Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name])), [profiles]);

  const toggleItem = (segKey: string, item: string, checked: boolean) => {
    setChecklist((prev) => ({
      ...prev,
      [segKey]: { ...prev[segKey], [item]: checked },
    }));
  };

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
    const payload: any = {
      user_id: user.id,
      outlet_id: outletId,
      report_date: reportDate,
      checklist,
      notes_for_management: notesMgmt || null,
      photos,
      // Field lama dikosongkan agar tidak menyesatkan
      operational_condition: 'Lancar',
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

  const progress = totalProgress(checklist);

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
                <CardTitle className="flex items-center justify-between">
                  <span>{existingId ? 'Perbarui Laporan' : 'Input Laporan Harian'}</span>
                  <Badge variant="secondary">
                    {progress.done}/{progress.total} checklist
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {SEGMENTS.map((seg) => {
                    const Icon = seg.icon;
                    const c = countChecked(checklist, seg.key);
                    return (
                      <Card key={seg.key} className="border-muted">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {seg.title}
                            </span>
                            <Badge variant="outline">{c.done}/{c.total}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {seg.items.map((it) => {
                            const id = `${seg.key}-${it}`;
                            const checked = !!checklist[seg.key]?.[it];
                            return (
                              <label
                                key={it}
                                htmlFor={id}
                                className="flex items-start gap-2 text-sm cursor-pointer leading-snug"
                              >
                                <Checkbox
                                  id={id}
                                  checked={checked}
                                  onCheckedChange={(v) => toggleItem(seg.key, it, !!v)}
                                  className="mt-0.5"
                                />
                                <span className={checked ? 'line-through text-muted-foreground' : ''}>{it}</span>
                              </label>
                            );
                          })}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                <div>
                  <Label>Temuan Harian</Label>
                  <Textarea
                    rows={3}
                    value={notesMgmt}
                    onChange={(e) => setNotesMgmt(e.target.value)}
                    placeholder="Catatan temuan, kendala, atau hal penting di lapangan hari ini..."
                  />
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
                        <TableHead>Opening</TableHead>
                        <TableHead>Operasional</TableHead>
                        <TableHead>Closing</TableHead>
                        <TableHead>Temuan Harian</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recapLoading ? (
                        <TableRow><TableCell colSpan={8} className="text-center"><Loader2 className="h-4 w-4 animate-spin inline mr-1" /> Memuat...</TableCell></TableRow>
                      ) : recap.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Belum ada laporan</TableCell></TableRow>
                      ) : (
                        recap.map((r) => {
                          const op = countChecked(r.checklist, 'opening');
                          const ops = countChecked(r.checklist, 'operasional');
                          const cl = countChecked(r.checklist, 'closing');
                          const segBadge = (c: { done: number; total: number }) => {
                            const v = c.total === 0 ? 0 : c.done / c.total;
                            const variant = v === 1 ? 'default' : v >= 0.5 ? 'secondary' : 'destructive';
                            return <Badge variant={variant as any}>{c.done}/{c.total}</Badge>;
                          };
                          return (
                            <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetail(r)}>
                              <TableCell>{r.report_date}</TableCell>
                              <TableCell>{picNameMap[r.user_id] || '-'}</TableCell>
                              <TableCell>{r.outlet_id ? (outletNameMap[r.outlet_id] || '-') : '-'}</TableCell>
                              <TableCell>{segBadge(op)}</TableCell>
                              <TableCell>{segBadge(ops)}</TableCell>
                              <TableCell>{segBadge(cl)}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{r.notes_for_management || '-'}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetail(r); }}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
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
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detail Laporan — {detail?.report_date}</DialogTitle>
            </DialogHeader>
            {detail && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">PIC:</span> {picNameMap[detail.user_id] || '-'}</div>
                  <div><span className="text-muted-foreground">Outlet:</span> {detail.outlet_id ? outletNameMap[detail.outlet_id] : '-'}</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {SEGMENTS.map((seg) => {
                    const Icon = seg.icon;
                    const c = countChecked(detail.checklist, seg.key);
                    return (
                      <div key={seg.key} className="border rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium flex items-center gap-1.5">
                            <Icon className="h-4 w-4" /> {seg.title}
                          </div>
                          <Badge variant="outline">{c.done}/{c.total}</Badge>
                        </div>
                        <ul className="space-y-1">
                          {seg.items.map((it) => {
                            const done = !!detail.checklist?.[seg.key]?.[it];
                            return (
                              <li key={it} className="flex items-start gap-1.5 text-xs">
                                <span className={done ? 'text-green-600' : 'text-muted-foreground'}>{done ? '✓' : '○'}</span>
                                <span className={done ? '' : 'text-muted-foreground'}>{it}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                {detail.notes_for_management && (
                  <div>
                    <div className="text-muted-foreground">Temuan Harian</div>
                    <div className="whitespace-pre-wrap">{detail.notes_for_management}</div>
                  </div>
                )}
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
