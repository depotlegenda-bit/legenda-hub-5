import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Input angka dengan thousand separator (format Indonesia: 1.000.000).
 *
 * - Menyimpan nilai sebagai number murni di state (via onChange).
 * - Menampilkan dengan titik pemisah ribuan saat tidak fokus & saat mengetik.
 * - Mendukung backspace, paste, dan input desimal opsional.
 *
 * Pakai untuk: harga, qty (qty boleh juga, tapi biasanya qty kecil — opsional).
 */
export interface MoneyInputProps
  extends Omit<React.ComponentProps<'input'>, 'onChange' | 'value' | 'type'> {
  value: number | null | undefined;
  onChange: (value: number) => void;
  /** Tampilkan prefix "Rp " di placeholder (default true). */
  showRpPrefix?: boolean;
  /** Bolehkan desimal (default false — angka uang biasanya integer di IDR). */
  allowDecimal?: boolean;
}

const formatID = (n: number, allowDecimal: boolean): string => {
  if (!Number.isFinite(n)) return '';
  if (allowDecimal) return n.toLocaleString('id-ID');
  return Math.trunc(n).toLocaleString('id-ID');
};

const parseID = (s: string, allowDecimal: boolean): number => {
  if (!s) return 0;
  // Buang semua titik (separator ribuan ID); koma -> titik untuk desimal.
  let cleaned = s.replace(/\./g, '');
  if (allowDecimal) cleaned = cleaned.replace(',', '.');
  else cleaned = cleaned.replace(/[,]/g, '');
  // Sisakan hanya digit, minus, titik desimal.
  cleaned = cleaned.replace(/[^\d.\-]/g, '');
  // Izinkan input parsial minus (hanya "-" atau "-." sementara) tanpa NaN.
  if (cleaned === '-' || cleaned === '-.' || cleaned === '-,') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, className, placeholder, showRpPrefix = true, allowDecimal = false, ...rest }, ref) => {
    const [focused, setFocused] = React.useState(false);
    const [draft, setDraft] = React.useState<string>('');

    const display = focused
      ? draft
      : value === null || value === undefined || value === 0
        ? ''
        : formatID(Number(value), allowDecimal);

    return (
      <Input
        {...rest}
        ref={ref}
        type="text"
        inputMode={allowDecimal ? 'decimal' : 'numeric'}
        className={cn(className)}
        placeholder={placeholder ?? (showRpPrefix ? 'Rp 0' : '0')}
        value={display}
        onFocus={(e) => {
          setFocused(true);
          setDraft(value ? formatID(Number(value), allowDecimal) : '');
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          const num = parseID(raw, allowDecimal);
          // Jaga tampilan: format ulang dengan separator saat mengetik.
          setDraft(num === 0 && raw.trim() === '' ? '' : formatID(num, allowDecimal));
          onChange(num);
        }}
      />
    );
  },
);
MoneyInput.displayName = 'MoneyInput';
