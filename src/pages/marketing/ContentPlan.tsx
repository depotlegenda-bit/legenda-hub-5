import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMenuPermissions } from '@/hooks/useMenuPermissions';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { usePersistentDraft } from '@/hooks/usePersistentDraft';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Plus } from 'lucide-react';

const statusLabels: Record<string, string> = {
  idea: 'Ide',
  draft: 'Draft',
  in_progress: 'Proses',
  review: 'Review',
  posted: 'Posted',
};

const statusColors: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  idea: 'outline',
  draft: 'secondary',
  in_progress: 'default',
  review: 'secondary',
  posted: 'default',
};

export default function ContentPlanPage() {
  const { user, role, isCustom } = useAuth() as any;
  const { getPerm } = useMenuPermissions();
  const { toast } = useToast();
  const canManage = role === 'admin' || role === 'management';
  const canEdit =
    role === 'admin' ||
    role === 'management' ||
    role === 'pic' ||
    (role ? getPerm(role, 'marketing.content', 'can_create', isCustom) : false);
  const [records, setRecords] = useState<any[]>([]);
  const contentDraft = usePersistentDraft('draft:content-plan-v1', { title: '', description: '', platform: 'instagram', scheduled_date: '', status: 'idea', rate_card: '' });
  const [form, setForm] = useState(contentDraft.value);
  const [submitting, setSubmitting] = useState(false);
  const [engagementEdit, setEngagementEdit] = useState<Record<string, any>>({});

  const fetchData = async () => {
    const { data } = await supabase.from('content_plans').select('*').order('scheduled_date', { ascending: true });
    if (data) setRecords(data);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => {
    contentDraft.setValue(form);
  }, [contentDraft, form]);

  const formatRupiah = (n: number) => `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from('content_plans').insert({
      title: form.title,
      description: form.description,
      platform: form.platform,
      scheduled_date: form.scheduled_date || null,
      status: form.status,
      rate_card: parseInt(form.rate_card.replace(/\D/g, '')) || 0,
      created_by: user.id,
    });
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Content plan ditambahkan.' });
      contentDraft.clear({ title: '', description: '', platform: 'instagram', scheduled_date: '', status: 'idea', rate_card: '' });
      setForm({ title: '', description: '', platform: 'instagram', scheduled_date: '', status: 'idea', rate_card: '' });
      fetchData();
    }
    setSubmitting(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from('content_plans').update({ status }).eq('id', id);
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      fetchData();
    }
  };

  const handleSaveEngagement = async (id: string) => {
    const e = engagementEdit[id] || {};
    const { error } = await supabase.from('content_plans').update({
      engagement_likes: parseInt(e.likes) || 0,
      engagement_comments: parseInt(e.comments) || 0,
      engagement_shares: parseInt(e.shares) || 0,
      engagement_views: parseInt(e.views) || 0,
      engagement_reach: parseInt(e.reach) || 0,
    }).eq('id', id);
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Data engagement disimpan.' });
      setEngagementEdit({ ...engagementEdit, [id]: undefined });
      fetchData();
    }
  };

  const startEditEngagement = (r: any) => {
    setEngagementEdit({
      ...engagementEdit,
      [r.id]: {
        likes: r.engagement_likes ?? 0,
        comments: r.engagement_comments ?? 0,
        shares: r.engagement_shares ?? 0,
        views: r.engagement_views ?? 0,
        reach: r.engagement_reach ?? 0,
      },
    });
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
          <Megaphone className="w-7 h-7" /> Content Plan
        </h1>

        {canEdit && (
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg">Tambah Konten</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Judul</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Judul konten..." required />
                </div>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="youtube">YouTube</SelectItem>
                      <SelectItem value="other">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Jadwal</Label>
                  <Input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="idea">Ide</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="in_progress">Proses</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="posted">Posted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label>Rate Card / Biaya Konten</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Rp 0"
                    value={form.rate_card ? `Rp ${(parseInt(form.rate_card.replace(/\D/g, '')) || 0).toLocaleString('id-ID')}` : ''}
                    onChange={(e) => setForm({ ...form, rate_card: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label>Deskripsi</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi konten..." />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={submitting} className="w-full"><Plus className="w-4 h-4 mr-1" /> Tambah</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">Content Calendar</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Jadwal</th>
                    <th className="p-3 font-medium">Judul</th>
                    <th className="p-3 font-medium">Platform</th>
                    <th className="p-3 font-medium">Rate Card</th>
                    <th className="p-3 font-medium">Status</th>
                    {canEdit && <th className="p-3 font-medium">Ubah Status</th>}
                    {canEdit && <th className="p-3 font-medium min-w-[280px]">Engagement</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const editing = engagementEdit[r.id];
                    const totalEng = (r.engagement_likes || 0) + (r.engagement_comments || 0) + (r.engagement_shares || 0);
                    return (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3">{r.scheduled_date || '-'}</td>
                      <td className="p-3">
                        <p className="font-medium">{r.title}</p>
                        {r.description && <p className="text-xs text-muted-foreground mt-1 truncate max-w-xs">{r.description}</p>}
                      </td>
                      <td className="p-3 capitalize">{r.platform}</td>
                      <td className="p-3 whitespace-nowrap">{formatRupiah(r.rate_card || 0)}</td>
                      <td className="p-3"><Badge variant={statusColors[r.status] || 'outline'}>{statusLabels[r.status] || r.status}</Badge></td>
                      {canEdit && (
                        <td className="p-3">
                          <Select value={r.status} onValueChange={(v) => handleStatusChange(r.id, v)}>
                            <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="idea">Ide</SelectItem>
                              <SelectItem value="draft">Draft</SelectItem>
                              <SelectItem value="in_progress">Proses</SelectItem>
                              <SelectItem value="review">Review</SelectItem>
                              <SelectItem value="posted">Posted</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      )}
                      {canEdit && (
                        <td className="p-3">
                          {editing ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-5 gap-1">
                                {[
                                  { k: 'likes', label: '❤️' },
                                  { k: 'comments', label: '💬' },
                                  { k: 'shares', label: '🔁' },
                                  { k: 'views', label: '👁' },
                                  { k: 'reach', label: '📡' },
                                ].map((f) => (
                                  <div key={f.k} className="flex flex-col items-center">
                                    <span className="text-[10px]">{f.label}</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={editing[f.k] ?? 0}
                                      onChange={(ev) =>
                                        setEngagementEdit({
                                          ...engagementEdit,
                                          [r.id]: { ...editing, [f.k]: ev.target.value },
                                        })
                                      }
                                      className="h-7 text-xs px-1 text-center"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-1">
                                <Button size="sm" className="h-7 text-xs flex-1" onClick={() => handleSaveEngagement(r.id)}>Simpan</Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEngagementEdit({ ...engagementEdit, [r.id]: undefined })}>Batal</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                                <span>❤️ {r.engagement_likes || 0}</span>
                                <span>💬 {r.engagement_comments || 0}</span>
                                <span>🔁 {r.engagement_shares || 0}</span>
                                <span>👁 {(r.engagement_views || 0).toLocaleString('id-ID')}</span>
                                <span>📡 {(r.engagement_reach || 0).toLocaleString('id-ID')}</span>
                              </div>
                              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => startEditEngagement(r)}>
                                Input Engagement
                              </Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                    );
                  })}
                  {records.length === 0 && (
                    <tr><td colSpan={canEdit ? 7 : 5} className="p-8 text-center text-muted-foreground">Belum ada content plan.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
