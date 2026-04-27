import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useEffect } from 'react';

export interface ExpenseRow {
  id: string;
  description: string;
  amount: number;
  qty: number;
  unit_price: number;
  category: string | null;
  report_id: string;
}

export interface ReportGroup {
  report_id: string;
  report_date: string;
  outlet_id: string | null;
  outlet_name: string;
  created_at: string;
  expenses: ExpenseRow[];
  income: number;
}

interface PLCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
}

interface Props {
  title: string;
  accent: 'warning' | 'success';
  groups: ReportGroup[];
  openGroups: Record<string, boolean>;
  toggleGroup: (id: string) => void;
  expenseCategories: PLCategory[];
  pendingChanges: Record<string, string>;
  onCategoryChange: (id: string, category: string) => void;
  formatRp: (v: number) => string;
  defaultOpen?: boolean;
}

export default function ReportSection({
  title,
  accent,
  groups,
  openGroups,
  toggleGroup,
  expenseCategories,
  pendingChanges,
  onCategoryChange,
  formatRp,
  defaultOpen,
}: Props) {
  // Auto-open the first group in this section on mount if defaultOpen
  useEffect(() => {
    if (defaultOpen && groups[0] && openGroups[groups[0].report_id] === undefined) {
      toggleGroup(groups[0].report_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length]);

  if (groups.length === 0) return null;

  const accentClass =
    accent === 'success'
      ? 'border-l-4 border-l-primary'
      : 'border-l-4 border-l-yellow-500';
  const badgeClass =
    accent === 'success'
      ? 'bg-primary/15 text-primary border-primary/30'
      : 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30';
  const Icon = accent === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <Card className={`glass-card ${accentClass}`}>
      <div className="flex items-center justify-between px-5 py-3 bg-muted/40 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${accent === 'success' ? 'text-primary' : 'text-yellow-500'}`} />
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        <Badge variant="outline" className={badgeClass}>
          {groups.length} laporan
        </Badge>
      </div>
      <CardContent className="p-0 divide-y">
        {groups.map((g) => {
          const isOpen = openGroups[g.report_id] ?? false;
          const total = g.expenses.reduce((s, e) => s + e.amount, 0);
          const dateLabel = format(parseISO(g.report_date), 'EEEE, d MMM yyyy', { locale: localeId });
          const timeLabel = g.created_at ? format(new Date(g.created_at), 'HH:mm') : '';
          const unassignedInGroup = g.expenses.filter(
            (r) => !((pendingChanges[r.id] ?? r.category) && (pendingChanges[r.id] ?? r.category) !== 'Lain-lain'),
          ).length;

          return (
            <Collapsible key={g.report_id} open={isOpen} onOpenChange={() => toggleGroup(g.report_id)}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-5 py-3 bg-foreground hover:bg-foreground/90 text-background transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                    <span className="font-semibold truncate">{g.outlet_name}</span>
                    <span className="text-xs opacity-80">{dateLabel}</span>
                    {timeLabel && <span className="text-xs opacity-60">{timeLabel}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {unassignedInGroup > 0 && (
                      <Badge variant="outline" className="bg-background/20 border-background/40">
                        {unassignedInGroup} belum
                      </Badge>
                    )}
                    <span className="text-sm font-semibold">{formatRp(total)}</span>
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-2 py-2 bg-background">
                  {g.expenses.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-6">
                      Tidak ada pengeluaran pada laporan ini.
                    </p>
                  ) : (
                    <>
                      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Pengeluaran Cash
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nama</TableHead>
                            <TableHead className="text-right w-32">Harga (Rp)</TableHead>
                            <TableHead className="text-right w-20">Qty</TableHead>
                            <TableHead className="text-right w-32">Total (Rp)</TableHead>
                            <TableHead className="w-56">Akun</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {g.expenses.map((row) => {
                            const current = pendingChanges[row.id] ?? row.category ?? '';
                            const isPending = pendingChanges[row.id] !== undefined;
                            return (
                              <TableRow key={row.id} className={isPending ? 'bg-primary/5' : ''}>
                                <TableCell className="text-sm">{row.description}</TableCell>
                                <TableCell className="text-right text-sm text-primary">
                                  {formatRp(row.unit_price)}
                                </TableCell>
                                <TableCell className="text-right text-sm">{(row.qty || 1).toFixed(2)}</TableCell>
                                <TableCell className="text-right text-sm font-medium text-primary">
                                  {formatRp(row.amount)}
                                </TableCell>
                                <TableCell>
                                  <Select value={current} onValueChange={(v) => onCategoryChange(row.id, v)}>
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Pilih / ketik akun..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {expenseCategories.map((c) => (
                                        <SelectItem key={c.id} value={c.name}>
                                          {c.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <div className="px-3 py-3 space-y-1 text-sm border-t mt-2">
                        <div className="flex justify-between">
                          <span>Pendapatan</span>
                          <span className="text-primary">{formatRp(g.income)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pengeluaran</span>
                          <span className="text-destructive">{formatRp(total)}</span>
                        </div>
                        <div className="flex justify-between font-semibold">
                          <span className="text-primary">Laba / Rugi</span>
                          <span className={g.income - total >= 0 ? 'text-primary' : 'text-destructive'}>
                            {formatRp(g.income - total)}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
