import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, MapPin, Clock, RefreshCw, LogIn, LogOut, AlertTriangle, CheckCircle2, ExternalLink, Building2, Briefcase } from 'lucide-react';
import { useAttendanceThresholds } from '@/hooks/useAttendanceThresholds';

interface ProfileLite {
  full_name: string;
  outlet_id: string | null;
  outlet_name?: string;
  outlet_lat?: number | null;
  outlet_lng?: number | null;
  outlet_radius?: number | null;
}

interface OutletOption {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  radius_meters: number | null;
}

interface RecentLog {
  id: string;
  log_type: string;
  created_at: string;
  selfie_url: string;
  out_of_radius: boolean;
}

// Haversine distance in meters
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function CheckInPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [now, setNow] = useState(new Date());
  const [coords, setCoords] = useState<GeolocationPosition | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [logType, setLogType] = useState<'check_in' | 'check_out'>('check_in');
  const [notes, setNotes] = useState('');
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [allOutlets, setAllOutlets] = useState<OutletOption[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<string>('Default');

  const canChooseOutlet = role === 'admin' || role === 'management';
  const { shiftsForOutlet, resolve: resolveThresholds } = useAttendanceThresholds();
  const availableShifts = shiftsForOutlet(selectedOutletId);
  const activeThresholds = resolveThresholds(selectedOutletId, selectedShift);

  // Realtime clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load all outlets for admin/management
  useEffect(() => {
    if (!canChooseOutlet) return;
    (async () => {
      const { data } = await supabase
        .from('outlets')
        .select('id, name, latitude, longitude, radius_meters')
        .order('name');
      if (data) setAllOutlets(data as OutletOption[]);
    })();
  }, [canChooseOutlet]);

  // Load profile + outlet info
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name, outlet_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!prof) return;
      let outletData: any = {};
      if (prof.outlet_id) {
        const { data: o } = await supabase
          .from('outlets')
          .select('name, latitude, longitude, radius_meters')
          .eq('id', prof.outlet_id)
          .maybeSingle();
        if (o) outletData = { outlet_name: o.name, outlet_lat: o.latitude, outlet_lng: o.longitude, outlet_radius: o.radius_meters };
      }
      setProfile({ full_name: prof.full_name, outlet_id: prof.outlet_id, ...outletData });
      // Default selected outlet to profile outlet if any
      if (prof.outlet_id) setSelectedOutletId(prof.outlet_id);
    })();
  }, [user]);

  const fetchRecent = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('attendance_logs')
      .select('id, log_type, created_at, selfie_url, out_of_radius')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) {
      setRecentLogs(data as RecentLog[]);
      // Auto-suggest next log type
      if (data[0]?.log_type === 'check_in') setLogType('check_out');
      else setLogType('check_in');
    }
  };
  useEffect(() => { fetchRecent(); }, [user]);

  // Pastikan shift terpilih selalu ada dalam daftar shift outlet aktif
  useEffect(() => {
    if (availableShifts.length === 0) return;
    if (!availableShifts.includes(selectedShift)) {
      setSelectedShift(availableShifts[0]);
    }
  }, [availableShifts, selectedShift]);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (e: any) {
      toast({ title: 'Kamera tidak dapat diakses', description: e.message || 'Izinkan akses kamera di browser.', variant: 'destructive' });
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  };

  useEffect(() => () => stopCamera(), []);

  // Get GPS
  const getLocation = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError('Browser tidak mendukung GPS');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords(pos),
      (err) => setGeoError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };
  useEffect(() => { getLocation(); }, []);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror horizontally for natural selfie
    ctx.translate(size, 0);
    ctx.scale(-1, 1);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setPhotoBlob(blob);
          setPhotoPreview(URL.createObjectURL(blob));
          stopCamera();
        }
      },
      'image/jpeg',
      0.85
    );
  };

  const retake = () => {
    setPhotoBlob(null);
    setPhotoPreview(null);
    startCamera();
  };

  // Resolve effective outlet (admin/management uses selected; others use profile)
  const effectiveOutlet = canChooseOutlet
    ? allOutlets.find((o) => o.id === selectedOutletId) || null
    : profile?.outlet_id
      ? {
          id: profile.outlet_id,
          name: profile.outlet_name || '',
          latitude: profile.outlet_lat ?? null,
          longitude: profile.outlet_lng ?? null,
          radius_meters: profile.outlet_radius ?? null,
        }
      : null;

  // Compute distance + warning
  const distance =
    coords && effectiveOutlet?.latitude != null && effectiveOutlet?.longitude != null
      ? haversine(coords.coords.latitude, coords.coords.longitude, Number(effectiveOutlet.latitude), Number(effectiveOutlet.longitude))
      : null;
  const radius = effectiveOutlet?.radius_meters ?? 100;
  const outOfRadius = distance != null && distance > radius;

  const handleSubmit = async () => {
    if (!user || !photoBlob || !coords) {
      toast({ title: 'Data belum lengkap', description: 'Pastikan foto dan lokasi GPS sudah terdeteksi.', variant: 'destructive' });
      return;
    }
    if (canChooseOutlet && !selectedOutletId) {
      toast({ title: 'Pilih outlet dulu', description: 'Sebagai admin/management, pilih cabang tempat absen.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const filename = `${user.id}/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('attendance-selfies').upload(filename, photoBlob, {
        contentType: 'image/jpeg',
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('attendance-selfies').getPublicUrl(filename);

      const { error: insErr } = await (supabase as any).from('attendance_logs').insert({
        user_id: user.id,
        outlet_id: effectiveOutlet?.id || null,
        log_type: logType,
        shift_name: selectedShift || 'Default',
        selfie_url: publicUrl,
        latitude: coords.coords.latitude,
        longitude: coords.coords.longitude,
        accuracy_meters: coords.coords.accuracy,
        distance_from_outlet_meters: distance,
        out_of_radius: outOfRadius,
        device_info: navigator.userAgent.slice(0, 200),
        notes: notes || null,
      });
      if (insErr) throw insErr;

      toast({
        title: `${logType === 'check_in' ? 'Check-in' : 'Check-out'} berhasil!`,
        description: outOfRadius ? '⚠️ Tercatat dengan flag di luar radius outlet.' : 'Absensi tersimpan.',
      });
      setPhotoBlob(null);
      setPhotoPreview(null);
      setNotes('');
      fetchRecent();
    } catch (e: any) {
      toast({ title: 'Gagal menyimpan', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const mapsLink = coords ? `https://www.google.com/maps?q=${coords.coords.latitude},${coords.coords.longitude}` : '';

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
            <Camera className="w-7 h-7" /> Absen Sekarang
          </h1>
          <p className="text-muted-foreground mt-1">Selfie + GPS untuk catat kehadiran realtime</p>
        </div>

        {/* Info Bar */}
        <Card className="glass-card">
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Karyawan</p>
              <p className="font-semibold">{profile?.full_name || '...'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {effectiveOutlet?.name || profile?.outlet_name || 'Outlet belum diset'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Waktu</p>
              <p className="font-mono font-bold text-lg">{now.toLocaleTimeString('id-ID')}</p>
              <p className="text-xs text-muted-foreground">{now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" /> Lokasi</p>
              {geoError ? (
                <p className="text-xs text-destructive">{geoError} <button onClick={getLocation} className="underline">Coba lagi</button></p>
              ) : coords ? (
                <>
                  <p className="font-mono text-xs">{coords.coords.latitude.toFixed(6)}, {coords.coords.longitude.toFixed(6)}</p>
                  <a href={mapsLink} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                    Buka Google Maps <ExternalLink className="w-3 h-3" />
                  </a>
                  <p className="text-xs text-muted-foreground">Akurasi: ±{Math.round(coords.coords.accuracy)}m</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Mendeteksi GPS...</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Outlet selector for admin/management */}
        {canChooseOutlet && (
          <Card className="glass-card border-primary/30">
            <CardContent className="p-4 space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Pilih Cabang Tempat Absen
              </Label>
              <Select value={selectedOutletId || ''} onValueChange={(v) => setSelectedOutletId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih outlet..." />
                </SelectTrigger>
                <SelectContent>
                  {allOutlets.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sebagai {role}, Anda dapat absen di cabang manapun. Validasi radius tetap berlaku per outlet yang dipilih.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Distance warning */}
        {distance != null && (
          <Card className={outOfRadius ? 'border-destructive bg-destructive/5' : 'border-emerald-500/40 bg-emerald-500/5'}>
            <CardContent className="p-4 flex items-start gap-3">
              {outOfRadius ? (
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              )}
              <div className="text-sm">
                <p className="font-semibold">
                  {outOfRadius ? 'Anda di luar radius outlet' : 'Anda dalam radius outlet'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Jarak dari {effectiveOutlet?.name || 'outlet'}: <strong>{Math.round(distance)}m</strong> (radius diizinkan: {radius}m)
                  {outOfRadius && ' — absen tetap diterima dengan flag untuk review.'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Camera / Preview */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Foto Selfie</CardTitle>
          </CardHeader>
          <CardContent>
            {!photoPreview ? (
              <div className="space-y-3">
                <div className="aspect-square w-full max-w-sm mx-auto bg-muted rounded-lg overflow-hidden relative">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                    playsInline
                    muted
                  />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <Button onClick={startCamera} size="lg" className="gap-2">
                        <Camera className="w-5 h-5" /> Buka Kamera Depan
                      </Button>
                    </div>
                  )}
                </div>
                {cameraReady && (
                  <Button onClick={capturePhoto} className="w-full gap-2" size="lg">
                    <Camera className="w-5 h-5" /> Ambil Foto
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="aspect-square w-full max-w-sm mx-auto rounded-lg overflow-hidden border border-border">
                  <img src={photoPreview} alt="Selfie preview" className="w-full h-full object-cover" />
                </div>
                <Button onClick={retake} variant="outline" className="w-full gap-2">
                  <RefreshCw className="w-4 h-4" /> Ambil Ulang
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit form */}
        {photoPreview && coords && (
          <Card className="glass-card">
            <CardContent className="p-4 space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={logType === 'check_in' ? 'default' : 'outline'}
                  onClick={() => setLogType('check_in')}
                  className="flex-1 gap-2"
                >
                  <LogIn className="w-4 h-4" /> Check-In (Masuk)
                </Button>
                <Button
                  variant={logType === 'check_out' ? 'default' : 'outline'}
                  onClick={() => setLogType('check_out')}
                  className="flex-1 gap-2"
                >
                  <LogOut className="w-4 h-4" /> Check-Out (Pulang)
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Catatan (opsional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Misal: izin ke bank, dll." rows={2} />
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
                {submitting ? 'Menyimpan...' : `Simpan ${logType === 'check_in' ? 'Check-In' : 'Check-Out'}`}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent logs */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">5 Absen Terakhir</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentLogs.length === 0 && <p className="text-sm text-muted-foreground">Belum ada catatan absen.</p>}
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 p-2 bg-muted/40 rounded-lg">
                <img src={log.selfie_url} alt="" className="w-12 h-12 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={log.log_type === 'check_in' ? 'default' : 'secondary'}>
                      {log.log_type === 'check_in' ? 'IN' : 'OUT'}
                    </Badge>
                    {log.out_of_radius && <Badge variant="destructive" className="text-xs">Luar radius</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(log.created_at).toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
