import { useRef, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppSettings, FONT_OPTIONS, hexToHsl, hslToHex, FontFamilyKey } from '@/hooks/useAppSettings';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Settings as SettingsIcon, RotateCcw, Upload, Image as ImageIcon, KeyRound, Eye, EyeOff, Palette, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import nagaBg from '@/assets/naga-bg.png';
import AttendanceThresholdsTab from '@/components/settings/AttendanceThresholdsTab';

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={hslToHex(value)}
        onChange={(e) => onChange(hexToHsl(e.target.value))}
        className="h-10 w-14 rounded-md border border-border bg-transparent cursor-pointer"
      />
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground font-mono">hsl({value})</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { role, loading } = useAuth();
  const { settings, updateSetting, resetSettings } = useAppSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Hidden password feature (admin only)
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // Tunggu role ter-load dulu sebelum cek akses (mencegah redirect prematur)
  if (loading || role === null) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground">
          Memuat pengaturan...
        </div>
      </AppLayout>
    );
  }

  if (role !== 'management' && role !== 'admin') {
    return <Navigate to="/profile" replace />;
  }

  const handleLogoUpload = async (file: File) => {
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error('Ukuran logo maksimal 1.5MB');
      return;
    }
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        updateSetting('customLogoUrl', reader.result as string);
        toast.success('Logo berhasil diperbarui');
        setUploading(false);
      };
      reader.onerror = () => {
        toast.error('Gagal membaca file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('Gagal mengunggah logo');
      setUploading(false);
    }
  };

  const handleDragonClick = () => {
    if (role !== 'admin') return;
    setPwDialogOpen(true);
  };

  const handleChangePassword = async () => {
    if (newPw.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }
    if (newPw !== confirmPw) {
      toast.error('Konfirmasi password tidak cocok');
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSavingPw(false);
    if (error) {
      toast.error(error.message || 'Gagal mengubah password');
      return;
    }
    toast.success('Password berhasil diubah');
    setPwDialogOpen(false);
    setNewPw('');
    setConfirmPw('');
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Pengaturan</h1>
            <p className="text-sm text-muted-foreground">Kustomisasi tampilan & atur ambang waktu absensi.</p>
          </div>
        </div>

        <Tabs defaultValue="appearance" className="space-y-6">
          <TabsList>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="w-4 h-4" /> Tampilan
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2">
              <Clock className="w-4 h-4" /> Absensi
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appearance" className="space-y-6 mt-0">

        {/* Typography */}
        <Card>
          <CardHeader>
            <CardTitle>Tipografi</CardTitle>
            <CardDescription>Atur jenis font dan skala ukuran teks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Jenis Font</Label>
              <Select
                value={settings.fontFamily}
                onValueChange={(v) => updateSetting('fontFamily', v as FontFamilyKey)}
              >
                <SelectTrigger className="max-w-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f.key} value={f.key} style={{ fontFamily: f.stack }}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Skala Ukuran Font</Label>
                <span className="text-sm text-muted-foreground">{Math.round(settings.fontScale * 100)}%</span>
              </div>
              <Slider
                value={[settings.fontScale]}
                min={0.85}
                max={1.25}
                step={0.05}
                onValueChange={(v) => updateSetting('fontScale', v[0])}
              />
              <p className="text-xs text-muted-foreground">Berlaku untuk seluruh aplikasi.</p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs text-muted-foreground mb-2">Pratinjau</p>
              <h3 className="text-2xl font-bold mb-1">Dua Legenda Management</h3>
              <p className="text-base">Cepat, rapi, dan terkontrol — tampilan teks Anda akan tampak seperti ini.</p>
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle>Warna Brand</CardTitle>
            <CardDescription>Atur warna utama dan sidebar untuk mode terang & gelap.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-5">
            <ColorPicker
              label="Primary (Mode Terang)"
              value={settings.primaryLight}
              onChange={(v) => updateSetting('primaryLight', v)}
            />
            <ColorPicker
              label="Primary (Mode Gelap)"
              value={settings.primaryDark}
              onChange={(v) => updateSetting('primaryDark', v)}
            />
            <ColorPicker
              label="Sidebar (Mode Terang)"
              value={settings.sidebarLight}
              onChange={(v) => updateSetting('sidebarLight', v)}
            />
            <ColorPicker
              label="Sidebar (Mode Gelap)"
              value={settings.sidebarDark}
              onChange={(v) => updateSetting('sidebarDark', v)}
            />
          </CardContent>
        </Card>

        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle>Logo Perusahaan</CardTitle>
            <CardDescription>Ganti logo yang muncul di sidebar (mendukung kampanye seasonal).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-20 w-32 rounded-lg border border-border bg-sidebar flex items-center justify-center overflow-hidden">
                {settings.customLogoUrl ? (
                  <img src={settings.customLogoUrl} alt="Logo" className="max-h-16 max-w-28 object-contain" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-sidebar-foreground/40" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f);
                  }}
                />
                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  {settings.customLogoUrl ? 'Ganti Logo' : 'Unggah Logo'}
                </Button>
                {settings.customLogoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateSetting('customLogoUrl', null)}
                    className="text-destructive hover:text-destructive"
                  >
                    Kembalikan logo default
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">PNG/SVG transparan, maksimal 1.5MB.</p>
          </CardContent>
        </Card>

        {/* Display options */}
        <Card>
          <CardHeader>
            <CardTitle>Tampilan Lainnya</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Tampilkan ornamen latar (macan & naga)</Label>
                <p className="text-xs text-muted-foreground">Matikan untuk tampilan minimalis.</p>
              </div>
              <Switch
                checked={settings.showBgArtwork}
                onCheckedChange={(v) => updateSetting('showBgArtwork', v)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center gap-3 flex-wrap">
          {/* Hidden dragon trigger — admin only. Klik untuk membuka dialog ganti password */}
          {role === 'admin' ? (
            <button
              type="button"
              onClick={handleDragonClick}
              aria-label="Ganti password admin (rahasia)"
              title="🐉"
              className="group bg-transparent border-0 p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
            >
              <img
                src={nagaBg}
                alt=""
                className="h-10 w-10 object-contain opacity-40 group-hover:opacity-80 transition-opacity pointer-events-none select-none"
              />
            </button>
          ) : (
            <span />
          )}

          <Button variant="outline" onClick={() => { resetSettings(); toast.success('Pengaturan dikembalikan ke default'); }}>
            <RotateCcw className="w-4 h-4 mr-2" /> Kembalikan ke Default
          </Button>
        </div>
      </div>

      {/* Hidden Password Change Dialog */}
      <Dialog open={pwDialogOpen} onOpenChange={(o) => { setPwDialogOpen(o); if (!o) { setNewPw(''); setConfirmPw(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              Ganti Password Admin
            </DialogTitle>
            <DialogDescription>
              Fitur tersembunyi khusus admin. Masukkan password baru untuk akun Anda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Password Baru</Label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? 'Sembunyikan' : 'Tampilkan'}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Konfirmasi Password</Label>
              <Input
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                placeholder="Ulangi password baru"
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwDialogOpen(false)} disabled={savingPw}>
              Batal
            </Button>
            <Button onClick={handleChangePassword} disabled={savingPw || !newPw || !confirmPw}>
              {savingPw ? 'Menyimpan...' : 'Simpan Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
