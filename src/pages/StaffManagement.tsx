import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Pencil, Users, Trash2 } from 'lucide-react';
import { useOutlets } from '@/hooks/useOutlets';

interface StaffProfile {
  id: string;
  user_id: string;
  full_name: string;
  nickname: string;
  phone: string;
  address: string;
  date_of_birth: string | null;
  job_title: string;
  discipline_points: number;
  warning_letter_status: string;
  employment_status: string;
  contract_end_date: string | null;
  outlet_id: string | null;
  base_salary: number;
  transport_allowance: number;
  meal_allowance: number;
  nik: string;
  join_date: string | null;
}

const formatRupiah = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

export default function StaffManagement() {
  const { toast } = useToast();
  const { role } = useAuth();
  const { outlets } = useOutlets({ includeManagement: true });
  const [profiles, setProfiles] = useState<StaffProfile[]>([]);
  const [editProfile, setEditProfile] = useState<StaffProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const canDelete = role === 'management' || role === 'admin';

  const fetchProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setProfiles(data as StaffProfile[]);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleSave = async () => {
    if (!editProfile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        nickname: editProfile.nickname,
        phone: editProfile.phone,
        address: editProfile.address,
        date_of_birth: editProfile.date_of_birth,
        job_title: editProfile.job_title,
        discipline_points: editProfile.discipline_points,
        warning_letter_status: editProfile.warning_letter_status,
        employment_status: editProfile.employment_status,
        contract_end_date: editProfile.contract_end_date,
        outlet_id: editProfile.outlet_id,
        nik: editProfile.nik,
        join_date: editProfile.join_date,
        base_salary: Math.round(editProfile.base_salary || 0),
        transport_allowance: Math.round(editProfile.transport_allowance || 0),
        meal_allowance: Math.round(editProfile.meal_allowance || 0),
      })
      .eq('id', editProfile.id);

    setSaving(false);
    if (error) {
      toast({ title: 'Gagal menyimpan', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Profil karyawan diperbarui.' });
      setEditProfile(null);
      fetchProfiles();
    }
  };

  const handleDelete = async (profile: StaffProfile) => {
    const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
    if (error) {
      toast({ title: 'Gagal menghapus', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: `Profil ${profile.full_name} dihapus.` });
      fetchProfiles();
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 font-sans">
            <Users className="w-7 h-7" /> Kelola Karyawan
          </h1>
          <p className="text-muted-foreground mt-1">Edit data profil karyawan</p>
        </div>

        {/* Mobile card view */}
        <div className="space-y-2 md:hidden">
          {profiles.map((p) => {
            const outletName = outlets.find((o) => o.id === p.outlet_id)?.name || '-';
            return (
              <div key={p.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm break-words">{p.full_name || '-'}</div>
                    {p.nickname && <div className="text-xs text-muted-foreground">({p.nickname})</div>}
                    <div className="text-xs text-muted-foreground mt-0.5 break-words">{p.job_title || '-'} · {outletName}</div>
                  </div>
                  <Badge variant={p.employment_status === 'Permanent' ? 'default' : 'outline'} className="shrink-0 text-[10px]">
                    {p.employment_status}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <div className="min-w-0">
                    <div className="text-muted-foreground">Telepon</div>
                    <div className="font-medium truncate">{p.phone || '-'}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-muted-foreground">Status SP</div>
                    <div className="font-medium truncate">{p.warning_letter_status}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-muted-foreground">Poin Disiplin</div>
                    <div>
                      <Badge variant={p.discipline_points > 3 ? 'destructive' : 'secondary'} className="text-[10px]">
                        {p.discipline_points}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2 justify-end">
                  <Button variant="outline" size="sm" className="h-8" onClick={() => setEditProfile({ ...p })}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Karyawan</AlertDialogTitle>
                          <AlertDialogDescription>
                            Yakin ingin menghapus profil <strong>{p.full_name}</strong>? Tindakan ini tidak dapat dibatalkan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(p)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            );
          })}
          {profiles.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-8">Belum ada karyawan.</p>
          )}
        </div>

        {/* Desktop table */}
        <Card className="glass-card hidden md:block">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-4 font-medium">Nama</th>
                    <th className="p-4 font-medium">Jabatan</th>
                    <th className="p-4 font-medium">Cabang</th>
                    <th className="p-4 font-medium">Telepon</th>
                    <th className="p-4 font-medium">Poin Disiplin</th>
                    <th className="p-4 font-medium">Status SP</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => {
                    const outletName = outlets.find((o) => o.id === p.outlet_id)?.name || '-';
                    return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-medium">
                        <div>{p.full_name || '-'}</div>
                        {p.nickname && <div className="text-xs text-muted-foreground">({p.nickname})</div>}
                      </td>
                      <td className="p-4">{p.job_title || '-'}</td>
                      <td className="p-4">{outletName}</td>
                      <td className="p-4 text-muted-foreground">{p.phone || '-'}</td>
                      <td className="p-4">
                        <Badge variant={p.discipline_points > 3 ? 'destructive' : 'secondary'}>
                          {p.discipline_points}
                        </Badge>
                      </td>
                      <td className="p-4">{p.warning_letter_status}</td>
                      <td className="p-4">
                        <Badge variant={p.employment_status === 'Permanent' ? 'default' : 'outline'}>
                          {p.employment_status}
                        </Badge>
                      </td>
                      <td className="p-4 flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditProfile({ ...p })}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Hapus Karyawan</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Yakin ingin menghapus profil <strong>{p.full_name}</strong>? Tindakan ini tidak dapat dibatalkan.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(p)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </td>
                    </tr>
                  );
                  })}
                  {profiles.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">Belum ada karyawan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Dialog open={!!editProfile} onOpenChange={(open) => !open && setEditProfile(null)}>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-heading">Edit Profil: {editProfile?.full_name}</DialogTitle>
            </DialogHeader>
            {editProfile && (
              <div className="space-y-4 overflow-y-auto pr-2 flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nama Panggilan</Label>
                    <Input value={editProfile.nickname || ''} onChange={(e) => setEditProfile({ ...editProfile, nickname: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>NIK</Label>
                    <Input value={editProfile.nik || ''} maxLength={16} onChange={(e) => setEditProfile({ ...editProfile, nik: e.target.value.replace(/\D/g, '').slice(0, 16) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telepon</Label>
                    <Input value={editProfile.phone || ''} onChange={(e) => setEditProfile({ ...editProfile, phone: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Jabatan</Label>
                    <Input value={editProfile.job_title || ''} onChange={(e) => setEditProfile({ ...editProfile, job_title: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Alamat</Label>
                  <Input value={editProfile.address || ''} onChange={(e) => setEditProfile({ ...editProfile, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tanggal Lahir</Label>
                    <Input type="date" value={editProfile.date_of_birth || ''} onChange={(e) => setEditProfile({ ...editProfile, date_of_birth: e.target.value || null })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tanggal Bergabung</Label>
                    <Input type="date" value={editProfile.join_date || ''} onChange={(e) => setEditProfile({ ...editProfile, join_date: e.target.value || null })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Poin Disiplin</Label>
                    <Input type="number" value={editProfile.discipline_points} onChange={(e) => setEditProfile({ ...editProfile, discipline_points: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Status SP</Label>
                    <Select value={editProfile.warning_letter_status} onValueChange={(v) => setEditProfile({ ...editProfile, warning_letter_status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Non-SP">Non-SP</SelectItem>
                        <SelectItem value="SP-1">SP-1</SelectItem>
                        <SelectItem value="SP-2">SP-2</SelectItem>
                        <SelectItem value="SP-3">SP-3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status Kepegawaian</Label>
                    <Select value={editProfile.employment_status} onValueChange={(v) => setEditProfile({ ...editProfile, employment_status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Contract">Kontrak</SelectItem>
                        <SelectItem value="Permanent">Tetap</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Akhir Kontrak</Label>
                    <Input type="date" value={editProfile.contract_end_date || ''} onChange={(e) => setEditProfile({ ...editProfile, contract_end_date: e.target.value || null })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Outlet / Cabang</Label>
                  <Select value={editProfile.outlet_id || ''} onValueChange={(v) => setEditProfile({ ...editProfile, outlet_id: v || null })}>
                    <SelectTrigger><SelectValue placeholder="Pilih outlet" /></SelectTrigger>
                    <SelectContent>
                      {outlets.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Komponen Gaji - terhubung ke Payroll */}
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Komponen Gaji (auto-isi ke Payroll)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Gaji Pokok</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={editProfile.base_salary ?? 0}
                        onChange={(e) => setEditProfile({ ...editProfile, base_salary: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-[11px] text-muted-foreground">{formatRupiah(editProfile.base_salary)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Tunj. Transport</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={editProfile.transport_allowance ?? 0}
                        onChange={(e) => setEditProfile({ ...editProfile, transport_allowance: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-[11px] text-muted-foreground">{formatRupiah(editProfile.transport_allowance)}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Tunj. Makan</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={editProfile.meal_allowance ?? 0}
                        onChange={(e) => setEditProfile({ ...editProfile, meal_allowance: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-[11px] text-muted-foreground">{formatRupiah(editProfile.meal_allowance)}</p>
                    </div>
                  </div>
                </div>

                <Button className="w-full" onClick={handleSave} disabled={saving}>
                  {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
