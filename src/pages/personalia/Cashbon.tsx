import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
import { Banknote, Plus, Check, X } from 'lucide-react';

export default function CashbonPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const canManage = role === 'management';
  const canView = role === 'management' || role === 'pic';
  const [records, setRecords] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const cashbonDraft = usePersistentDraft('draft:cashbon-page-v1', { amount: '', notes: '' });
  const [amount, setAmount] = useState(cashbonDraft.value.amount);
  const [notes, setNotes] = useState(cashbonDraft.value.notes);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    const { data } = await supabase.from('cashbon').select('*').order('request_date', { ascending: false }).limit(200);
    if (data) setRecords(data);
    if (canView) {
      const { data: p } = await supabase.from('profiles').select('user_id, full_name');
      if (p) setProfiles(p);
    }
  };

  useEffect(() => { fetchData(); }, [role]);
  useEffect(() => {
    cashbonDraft.setValue({ amount, notes });
  }, [amount, cashbonDraft, notes]);

  // Format number to Rp x.xxx.xxx (rounded, integer only)
  const rawAmount = parseInt(amount.replace(/\D/g, '')) || 0;
  const displayAmount = rawAmount > 0 ? `Rp ${rawAmount.toLocaleString('id-ID')}` : '';

  const handleAmountChange = (val: string) => {
    const digits = val.replace(/\D/g, '');
    setAmount(digits);
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.from('cashbon').insert({
      user_id: user.id,
      amount: rawAmount,
      notes,
    });
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: 'Pengajuan cashbon dikirim.' });
      cashbonDraft.clear({ amount: '', notes: '' });
      setAmount(''); setNotes('');
      fetchData();
    }
    setSubmitting(false);
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('cashbon').update({ status, approved_by: user?.id }).eq('id', id);
    if (error) {
      toast({ title: 'Gagal', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Berhasil', description: `Cashbon ${status}.` });
      fetchData();
    }
  };

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p.full_name]));

  const statusVariant = (s: string) => {
    if (s === 'approved') return 'default';
    if (s === 'paid') return 'secondary';
    if (s === 'rejected') return 'destructive';
    return 'outline';
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold font-sans flex items-center gap-3">
          <Banknote className="w-7 h-7" /> Cashbon
        </h1>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">Ajukan Cashbon</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleRequest} className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label>Jumlah</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Rp 0"
                  value={displayAmount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Catatan</Label>
                <Input placeholder="Keperluan..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={submitting}><Plus className="w-4 h-4 mr-1" /> Ajukan</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">Riwayat Cashbon</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Tanggal</th>
                    {canView && <th className="p-3 font-medium">Nama</th>}
                    <th className="p-3 font-medium">Jumlah</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Catatan</th>
                    {canManage && <th className="p-3 font-medium">Aksi</th>}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3">{r.request_date}</td>
                      {canView && <td className="p-3">{profileMap.get(r.user_id) || '-'}</td>}
                      <td className="p-3">Rp {(r.amount || 0).toLocaleString('id-ID')}</td>
                      <td className="p-3"><Badge variant={statusVariant(r.status)}>{r.status}</Badge></td>
                      <td className="p-3 text-xs">{r.notes || '-'}</td>
                      {canManage && r.status === 'pending' && (
                        <td className="p-3 flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(r.id, 'approved')}><Check className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(r.id, 'rejected')}><X className="w-3 h-3" /></Button>
                        </td>
                      )}
                      {canManage && r.status !== 'pending' && <td className="p-3" />}
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Belum ada data cashbon.</td></tr>
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
