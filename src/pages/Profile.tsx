import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Phone, MapPin, Briefcase, AlertTriangle, FileWarning, Clock, Banknote, Camera, Store, IdCard, UserCircle } from 'lucide-react';
import { Badge as StatusBadge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { ShowMoreList } from '@/components/ShowMoreList';
import { usePersistentDraft } from '@/hooks/usePersistentDraft';

interface Profile {
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
  nik: string;
  join_date: string | null;
  outlet_id: string | null;
  outlet_name?: string;
}

interface CashbonRecord {
  id: string;
  request_date: string;
  amount: number;
  status: string;
  notes: string | null;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [doubleJobNames, setDoubleJobNames] = useState<string[]>([]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const [cashbonOpen, setCashbonOpen] = useState(false);
  const cashbonDraft = usePersistentDraft('draft:cashbon-request-v1', { amount: '', notes: '' });
  const [cashbonForm, setCashbonForm] = useState(cashbonDraft.value);
  const [cashbonSubmitting, setCashbonSubmitting] = useState(false);
  const [cashbonRecords, setCashbonRecords] = useState<CashbonRecord[]>([]);
  const [todayLogs, setTodayLogs] = useState<{ log_type: string; created_at: string; selfie_url: string }[]>([]);

  const fetchTodayAttendance = async () => {
    if (!user) return;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('attendance_logs')
      .select('log_type, created_at, selfie_url')
      .eq('user_id', user.id)
      .gte('created_at', start.toISOString())
      .order('created_at', { ascending: false });
    if (data) setTodayLogs(data);
  };

  const fetchCashbon = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('cashbon')
      .select('id, request_date, amount, status, notes')
      .eq('user_id', user.id)
      .order('request_date', { ascending: false })
      .limit(20);
    if (data) setCashbonRecords(data as CashbonRecord[]);
  };

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const { data: assignments } = await supabase.from('employee_attendance_outlets')
        .select('outlets(name)').eq('user_id', user.id);
      setDoubleJobNames((assignments || []).flatMap(a => a.outlets?.name ? [a.outlets.name] : []));
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, nickname, phone, address, date_of_birth, job_title, discipline_points, warning_letter_status, employment_status, contract_end_date, nik, join_date, outlet_id, outlets(name)')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Profile load error:', error);
        toast({ title: 'Gagal memuat profil', description: error.message, variant: 'destructive' });
      }

      if (data) {
        const { outlets, ...rest } = data as any;
        setProfile({ ...rest, outlet_name: outlets?.name });
      } else {
        const meta = (user.user_metadata as any) || {};
        const fullName = meta.full_name || user.email?.split('@')[0] || '';
        const { data: inserted, error: insErr } = await supabase
          .from('profiles')
          .insert({
            user_id: user.id,
            full_name: fullName,
            nickname: meta.nickname || '',
            phone: meta.phone || '',
            address: meta.address || '',
            nik: meta.nik || '',
            outlet_id: meta.outlet_id || null,
          })
          .select('full_name, nickname, phone, address, date_of_birth, job_title, discipline_points, warning_letter_status, employment_status, contract_end_date, nik, join_date, outlet_id, outlets(name)')
          .maybeSingle();
        if (insErr) {
          console.error('Profile create error:', insErr);
          setProfile({
            full_name: fullName,
            nickname: meta.nickname || '',
            phone: meta.phone || '',
            address: meta.address || '',
            date_of_birth: null,
            job_title: '',
            discipline_points: 0,
            warning_letter_status: 'Non-SP',
            employment_status: 'Contract',
            contract_end_date: null,
            nik: meta.nik || '',
            join_date: null,
            outlet_id: meta.outlet_id || null,
          });
        } else if (inserted) {
          const { outlets, ...rest } = inserted as any;
          setProfile({ ...rest, outlet_name: outlets?.name });
        }
      }
    };
    loadProfile();
    fetchCashbon();
    fetchTodayAttendance();
  }, [user]);
  useEffect(() => {
    cashbonDraft.setValue(cashbonForm);
  }, [cashbonDraft, cashbonForm]);

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from('leave_requests').insert({
      user_id: user.id,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: 'Gagal mengajukan cuti', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil!', description: 'Pengajuan cuti telah dikirim.' });
      setLeaveOpen(false);
      setLeaveForm({ start_date: '', end_date: '', reason: '' });
    }
  };

  const handleCashbonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amountNum = parseFloat(cashbonForm.amount);
    if (!amountNum || amountNum <= 0) {
      toast({ title: 'Jumlah tidak valid', description: 'Masukkan jumlah cashbon lebih dari 0.', variant: 'destructive' });
      return;
    }
    setCashbonSubmitting(true);
    const { error } = await supabase.from('cashbon').insert({
      user_id: user.id,
      amount: amountNum,
      notes: cashbonForm.notes,
    });
    setCashbonSubmitting(false);
    if (error) {
      toast({ title: 'Gagal mengajukan cashbon', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil!', description: 'Pengajuan cashbon telah dikirim.' });
      setCashbonOpen(false);
      cashbonDraft.clear({ amount: '', notes: '' });
      setCashbonForm({ amount: '', notes: '' });
      fetchCashbon();
    }
  };

  const cashbonStatusVariant = (s: string) => {
    if (s === 'approved') return 'default' as const;
    if (s === 'paid') return 'secondary' as const;
    if (s === 'rejected') return 'destructive' as const;
    return 'outline' as const;
  };

  if (!profile) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Memuat profil...</p>
        </div>
      </AppLayout>
    );
  }

  const infoItems = [
    { icon: UserCircle, label: 'Nama Panggilan', value: profile.nickname || '-' },
    { icon: Phone, label: 'Telepon', value: profile.phone || '-' },
    { icon: MapPin, label: 'Alamat', value: profile.address || '-' },
    { icon: CalendarDays, label: 'Tanggal Lahir', value: profile.date_of_birth ? format(new Date(profile.date_of_birth), 'dd MMM yyyy') : '-' },
    { icon: Briefcase, label: 'Jabatan', value: profile.job_title || '-' },
    { icon: Store, label: 'Cabang', value: profile.outlet_name || '-' },
    ...(doubleJobNames.length ? [{ icon: Store, label: 'Cabang Double Job', value: doubleJobNames.join(', ') }] : []),
    { icon: IdCard, label: 'NIK', value: profile.nik || '-' },
    { icon: CalendarDays, label: 'Tanggal Bergabung', value: profile.join_date ? format(new Date(profile.join_date), 'MMMM yyyy', { locale: idLocale }) : '-' },
  ];

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">Profil Karyawan</h1>
          <p className="text-muted-foreground mt-1">Informasi pribadi Anda</p>
        </div>

        <Card className="glass-card">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <CardTitle className="font-heading text-lg md:text-xl break-words">{profile.full_name || 'Belum diisi'}</CardTitle>
              <p className="text-xs md:text-sm text-muted-foreground mt-1 break-all">{user?.email}</p>
            </div>
            <Badge variant={profile.employment_status === 'Permanent' ? 'default' : 'secondary'} className="shrink-0">
              {profile.employment_status}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {infoItems.map((item) => (
                <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <item.icon className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-medium break-words">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Poin Disiplin</p>
                  <p className="text-sm font-bold">{profile.discipline_points}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileWarning className="w-5 h-5 text-destructive shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Status SP</p>
                  <p className="text-sm font-medium break-words">{profile.warning_letter_status}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Clock className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Akhir Kontrak</p>
                  <p className="text-sm font-medium break-words">
                    {profile.contract_end_date ? format(new Date(profile.contract_end_date), 'dd MMM yyyy') : '-'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Absensi Hari Ini */}
        <Card className="glass-card">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="font-heading text-base sm:text-lg flex items-center gap-2 min-w-0">
              <Camera className="w-5 h-5 text-primary shrink-0" />
              <span className="truncate">Absensi Hari Ini</span>
            </CardTitle>
            <Button onClick={() => navigate('/attendance/check-in')} size="sm" className="gap-2 w-full sm:w-auto shrink-0">
              <Camera className="w-4 h-4" /> Absen Sekarang
            </Button>
          </CardHeader>
          <CardContent>
            {todayLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada absensi hari ini. Klik "Absen Sekarang" untuk selfie + GPS.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {todayLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg">
                    <img src={log.selfie_url} alt="" className="w-10 h-10 rounded object-cover" />
                    <div className="text-xs">
                      <StatusBadge variant={log.log_type === 'check_in' ? 'default' : 'secondary'}>
                        {log.log_type === 'check_in' ? 'IN' : 'OUT'}
                      </StatusBadge>
                      <p className="text-muted-foreground mt-0.5">{format(new Date(log.created_at), 'HH:mm:ss')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Leave Request */}
          <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">Pengajuan Cuti</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">Pengajuan Cuti</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal Mulai</Label>
                  <Input
                    type="date"
                    value={leaveForm.start_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Selesai</Label>
                  <Input
                    type="date"
                    value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Alasan</Label>
                <Textarea
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Jelaskan alasan cuti..."
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

          {/* Cashbon Request */}
          <Dialog open={cashbonOpen} onOpenChange={setCashbonOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary" className="w-full sm:w-auto gap-2">
                <Banknote className="w-4 h-4" /> Pengajuan Cashbon
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading">Pengajuan Cashbon</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCashbonSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Jumlah (Rp)</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1000"
                    placeholder="0"
                    value={cashbonForm.amount}
                    onChange={(e) => setCashbonForm({ ...cashbonForm, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Catatan / Keperluan</Label>
                  <Textarea
                    value={cashbonForm.notes}
                    onChange={(e) => setCashbonForm({ ...cashbonForm, notes: e.target.value })}
                    placeholder="Jelaskan keperluan cashbon..."
                  />
                </div>
                <Button type="submit" className="w-full" disabled={cashbonSubmitting}>
                  {cashbonSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Cashbon History */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2">
              <Banknote className="w-5 h-5 text-primary" /> Riwayat Cashbon Saya
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 md:p-0">
            {/* Mobile card view */}
            <div className="md:hidden">
              <ShowMoreList
                items={cashbonRecords}
                initial={5}
                emptyMessage="Belum ada pengajuan cashbon."
                wrapper={(children) => <div className="space-y-2">{children}</div>}
                renderItem={(r) => (
                  <div key={r.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{format(new Date(r.request_date), 'dd MMM yyyy')}</p>
                        <p className="font-semibold text-sm mt-0.5">Rp {(r.amount || 0).toLocaleString('id-ID')}</p>
                      </div>
                      <StatusBadge variant={cashbonStatusVariant(r.status)} className="shrink-0">{r.status}</StatusBadge>
                    </div>
                    {r.notes && <p className="text-xs text-muted-foreground mt-2 break-words">{r.notes}</p>}
                  </div>
                )}
              />
            </div>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Tanggal</th>
                    <th className="p-3 font-medium">Jumlah</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  <ShowMoreList
                    items={cashbonRecords}
                    initial={8}
                    emptyMessage="Belum ada pengajuan cashbon."
                    renderItem={(r) => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3">{format(new Date(r.request_date), 'dd MMM yyyy')}</td>
                        <td className="p-3 font-medium">Rp {(r.amount || 0).toLocaleString('id-ID')}</td>
                        <td className="p-3">
                          <StatusBadge variant={cashbonStatusVariant(r.status)}>{r.status}</StatusBadge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">{r.notes || '-'}</td>
                      </tr>
                    )}
                  />
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
