import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import logoKop from '@/assets/logo-dua-legenda.png';
import logoFloating from '@/assets/logo-floating.png';

const months = [
'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 20 }, (_, i) => currentYear - i);

const JOB_TITLES = ['Crew', 'Kasir', 'Barista', 'Cook', 'Server', 'Stockman', 'PIC', 'Supervisor', 'Manager', 'Lainnya'];
const EMPLOYMENT_STATUSES = ['Contract', 'Probation', 'Permanent', 'Part-Time', 'Magang'];

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [nik, setNik] = useState('');
  const [joinMonth, setJoinMonth] = useState('');
  const [joinYear, setJoinYear] = useState('');
  const [outletId, setOutletId] = useState('');
  const [jobTitle, setJobTitle] = useState('Crew');
  const [employmentStatus, setEmploymentStatus] = useState('Contract');
  const [outlets, setOutlets] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  // Make html background match the dark login page (fix uneven black background
  // in forced-desktop mode where body is scaled and html shows through).
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.backgroundColor;
    html.style.backgroundColor = '#0a0a0a'; // neutral-950
    return () => { html.style.backgroundColor = prev; };
  }, []);

  // Load outlets for signup outlet selector
  useEffect(() => {
    if (!isSignUp) return;
    if (outlets.length > 0) return;
    supabase.from('outlets').select('id, name').order('name').then(({ data }) => {
      if (data) setOutlets(data);
    });
  }, [isSignUp, outlets.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      if (nik && (nik.length !== 16 || !/^\d+$/.test(nik))) {
        toast({ title: 'NIK tidak valid', description: 'NIK harus 16 digit angka', variant: 'destructive' });
        setLoading(false);
        return;
      }
      if (phone && !/^08\d{8,13}$/.test(phone)) {
        toast({ title: 'No. HP tidak valid', description: 'No. HP harus diawali 08 dan 10-15 digit', variant: 'destructive' });
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, {
        full_name: fullName,
        nickname,
        address,
        phone,
        nik,
        outlet_id: outletId || null,
        join_month: joinMonth,
        join_year: joinYear,
        job_title: jobTitle,
        employment_status: employmentStatus,
      });
      if (error) {
        toast({ title: 'Gagal mendaftar', description: error.message, variant: 'destructive' });
      } else {
        // Email confirmation dimatikan — langsung sign-in agar user masuk dashboard
        const { error: signInErr } = await signIn(email, password);
        if (signInErr) {
          toast({ title: 'Akun berhasil dibuat', description: 'Silakan masuk dengan email & password Anda.' });
          setIsSignUp(false);
        } else {
          toast({ title: 'Selamat datang!', description: 'Akun berhasil dibuat dan Anda otomatis masuk.' });
        }
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        toast({ title: 'Gagal masuk', description: error.message, variant: 'destructive' });
      }
    }
    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-neutral-950 overflow-hidden">
      {/* Floating logo background - pinball motion across whole screen */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-0 overflow-hidden">
        <div className="animate-pinball">
          <img
            src={logoFloating}
            alt=""
            aria-hidden="true"
            className="w-[400px] max-w-[60vw] h-auto object-contain animate-float-slow"
            style={{
              filter: 'brightness(0) invert(1) drop-shadow(0 0 30px hsl(var(--primary) / 0.8)) drop-shadow(0 0 60px hsl(var(--primary) / 0.5))',
            }}
          />
        </div>
      </div>

      <Card className="relative w-full max-w-md shadow-2xl border-border/50 z-10 backdrop-blur-sm bg-card/95">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <img
              src={logoKop}
              alt="Dua Legenda"
              className="max-h-20 w-auto object-contain dark:invert"
            />
          </div>
          <CardDescription className="text-muted-foreground">
            {isSignUp ? 'Buat akun baru' : 'Masuk ke akun Anda'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp &&
            <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Nama Lengkap</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap" required maxLength={100} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nickname">Panggilan</Label>
                    <Input id="nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Nama panggilan" maxLength={50} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Alamat</Label>
                  <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat lengkap" rows={2} maxLength={500} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">No. HP</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))} placeholder="08xxxxxxxxxx" maxLength={15} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nik">NIK</Label>
                    <Input id="nik" value={nik} onChange={(e) => setNik(e.target.value.replace(/\D/g, '').slice(0, 16))} placeholder="16 digit NIK" maxLength={16} />
                    <p className="text-xs text-muted-foreground">{nik.length}/16 digit</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bulan Bergabung</Label>
                    <Select value={joinMonth} onValueChange={setJoinMonth}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Bulan" /></SelectTrigger>
                      <SelectContent className="z-[200] max-h-60" position="popper" sideOffset={4}>
                        {months.map((m, i) =>
                      <SelectItem key={m} value={String(i + 1).padStart(2, '0')}>{m}</SelectItem>
                      )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tahun Bergabung</Label>
                    <Select value={joinYear} onValueChange={setJoinYear}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Tahun" /></SelectTrigger>
                      <SelectContent className="z-[200] max-h-60" position="popper" sideOffset={4}>
                        {years.map((y) =>
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Jabatan</Label>
                    <Select value={jobTitle} onValueChange={setJobTitle}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih jabatan" /></SelectTrigger>
                      <SelectContent className="z-[200] max-h-60" position="popper" sideOffset={4}>
                        {JOB_TITLES.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status Kerja</Label>
                    <Select value={employmentStatus} onValueChange={setEmploymentStatus}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Pilih status" /></SelectTrigger>
                      <SelectContent className="z-[200] max-h-60" position="popper" sideOffset={4}>
                        {EMPLOYMENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cabang / Outlet Tempat Bekerja</Label>
                  <Select value={outletId} onValueChange={setOutletId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={outlets.length === 0 ? 'Memuat cabang...' : 'Pilih cabang'} />
                    </SelectTrigger>
                    <SelectContent className="z-[200] max-h-60" position="popper" sideOffset={4}>
                      {outlets.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Tidak ada cabang tersedia</div>
                      ) : (
                        outlets.map((o) => (
                          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </>
            }
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" required maxLength={255} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {!isSignUp && (
                  <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary transition-colors">
                    Lupa password?
                  </Link>
                )}
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={1} />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</> : isSignUp ? 'Daftar' : 'Masuk'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
              {isSignUp ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>);

}