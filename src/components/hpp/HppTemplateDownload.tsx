import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HppTemplateDownload({ mode }: { mode: 'materials' | 'products' }) {
  const filename = mode === 'materials' ? 'template_bahan_baku_hpp.csv' : 'template_resep_menu_hpp.csv';
  return <Button asChild variant="outline" className="h-auto min-h-10 whitespace-normal text-center">
    <a href={`/downloads/${filename}`} download={filename}>
      <Download />Unduh Template CSV {mode === 'materials' ? 'Bahan Baku' : 'Resep'}
    </a>
  </Button>;
}