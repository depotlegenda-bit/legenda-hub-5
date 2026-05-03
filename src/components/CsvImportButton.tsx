import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Upload, FileDown, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  parseCSVtoObjects, downloadCSVTemplate, readFileAsText,
} from '@/lib/csvImport';
import { useToast } from '@/hooks/use-toast';

export interface CsvImportRow {
  raw: Record<string, string>;
  errors: string[];
}

export interface CsvImportButtonProps<TParsed> {
  /** Label for the dialog and toast */
  entityLabel: string; // e.g. "Item Katalog"
  /** Headers (in order) for the template & expected CSV */
  headers: string[];
  /** Filename used when downloading the template (without extension) */
  templateFilename: string;
  /** Optional sample rows for the template */
  sampleRows?: (string | number)[][];
  /** Validate/transform a row to the final shape; return the value, return undefined to skip the row, or throw an Error */
  parseRow: (row: Record<string, string>, index: number) => TParsed | undefined;
  /** Called with all valid rows when user confirms import. Should perform the insert. */
  onImport: (rows: TParsed[]) => Promise<{ success: number; failed: number; message?: string }>;
  /** Called after successful import (e.g. to refresh data) */
  onImported?: () => void;
  /** Optional helper text displayed in dialog */
  helperText?: string;
}

export function CsvImportButton<TParsed>(props: CsvImportButtonProps<TParsed>) {
  const {
    entityLabel, headers, templateFilename, sampleRows,
    parseRow, onImport, onImported, helperText,
  } = props;
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<{ valid: TParsed[]; invalid: { row: number; raw: Record<string, string>; error: string }[]; skipped: number }>(
    { valid: [], invalid: [], skipped: 0 },
  );
  const [importing, setImporting] = useState(false);

  const handleDownloadTemplate = () => {
    downloadCSVTemplate(templateFilename, headers, sampleRows);
    toast({ title: 'Template diunduh', description: `${templateFilename}.csv` });
  };

  const handlePickFile = () => fileRef.current?.click();

  const handleFile = async (file: File) => {
    try {
      const text = await readFileAsText(file);
      const rawRows = parseCSVtoObjects(text);
      if (rawRows.length === 0) {
        toast({ title: 'CSV kosong', variant: 'destructive' });
        return;
      }
      const valid: TParsed[] = [];
      const invalid: { row: number; raw: Record<string, string>; error: string }[] = [];
      rawRows.forEach((raw, i) => {
        try {
          valid.push(parseRow(raw, i));
        } catch (e: any) {
          invalid.push({ row: i + 2, raw, error: e?.message || 'Invalid row' }); // +2 = header row + 1-indexed
        }
      });
      setParsed({ valid, invalid });
      setOpen(true);
    } catch (e: any) {
      toast({ title: 'Gagal membaca file', description: e?.message, variant: 'destructive' });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleConfirm = async () => {
    if (parsed.valid.length === 0) return;
    setImporting(true);
    try {
      const result = await onImport(parsed.valid);
      if (result.failed > 0) {
        toast({
          title: `Import selesai: ${result.success} berhasil, ${result.failed} gagal`,
          description: result.message,
          variant: result.success === 0 ? 'destructive' : 'default',
        });
      } else {
        toast({
          title: `${result.success} ${entityLabel.toLowerCase()} berhasil diimport`,
          description: result.message,
        });
      }
      setOpen(false);
      setParsed({ valid: [], invalid: [] });
      onImported?.();
    } catch (e: any) {
      toast({ title: 'Import gagal', description: e?.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
        <FileDown className="w-4 h-4 mr-1" /> Template CSV
      </Button>
      <Button variant="outline" size="sm" onClick={handlePickFile}>
        <Upload className="w-4 h-4 mr-1" /> Import CSV
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Preview Import {entityLabel}</DialogTitle>
            <DialogDescription>
              {helperText || `Periksa data sebelum import. Hanya baris valid akan diimport.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md border bg-primary/5 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{parsed.valid.length}</p>
                  <p className="text-xs text-muted-foreground">baris valid</p>
                </div>
              </div>
              <div className="p-3 rounded-md border bg-destructive/5 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{parsed.invalid.length}</p>
                  <p className="text-xs text-muted-foreground">baris error</p>
                </div>
              </div>
            </div>

            {parsed.invalid.length > 0 && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 sticky top-0">
                    <tr><th className="p-2 text-left">Baris</th><th className="p-2 text-left">Error</th></tr>
                  </thead>
                  <tbody>
                    {parsed.invalid.slice(0, 50).map((e) => (
                      <tr key={e.row} className="border-t">
                        <td className="p-2 font-mono">#{e.row}</td>
                        <td className="p-2 text-destructive">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsed.invalid.length > 50 && (
                  <p className="text-xs text-muted-foreground text-center p-2">
                    +{parsed.invalid.length - 50} error lainnya
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>
              Batal
            </Button>
            <Button onClick={handleConfirm} disabled={importing || parsed.valid.length === 0}>
              {importing ? 'Mengimport...' : `Import ${parsed.valid.length} ${entityLabel}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
