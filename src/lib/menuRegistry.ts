import {
  Users,
  ClipboardList,
  CalendarCheck,
  Banknote,
  AlertTriangle,
  CalendarDays,
  DollarSign,
  FileText,
  TrendingUp,
  Package,
  ShoppingCart,
  Beaker,
  Send,
  Megaphone,
  UserCircle,
  BarChart3,
  ShieldCheck,
  Activity,
  Camera,
  Image as ImageIcon,
  Settings as SettingsIcon,
  ClipboardCheck,
  Calculator,
} from 'lucide-react';
import type { AppRole } from '@/hooks/useAuth';

export interface MenuItemDef {
  key: string; // unique stable key used in role_menu_permissions
  to: string;
  icon: any;
  label: string;
  defaultRoles: AppRole[];
}

export interface MenuGroupDef {
  key: string;
  label: string;
  icon: any;
  items: MenuItemDef[];
}

export const MENU_GROUPS: MenuGroupDef[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: BarChart3,
    items: [
      { key: 'dashboard.analytics', to: '/dashboard', icon: BarChart3, label: 'Dashboard Analytics', defaultRoles: ['admin', 'management'] },
    ],
  },
  {
    key: 'personalia',
    label: 'Personalia',
    icon: Users,
    items: [
      { key: 'personalia.checkin', to: '/attendance/check-in', icon: Camera, label: 'Absen Sekarang (Selfie)', defaultRoles: ['admin', 'management', 'pic', 'crew', 'stockman', 'staff'] },
      { key: 'personalia.staff', to: '/personalia/staff', icon: Users, label: 'Data Karyawan', defaultRoles: ['admin', 'management', 'pic'] },
      { key: 'personalia.performance', to: '/personalia/performance', icon: ClipboardList, label: 'Penilaian Kinerja', defaultRoles: ['admin', 'management', 'pic'] },
      { key: 'personalia.attendance', to: '/personalia/attendance', icon: CalendarCheck, label: 'Rekapan Absensi', defaultRoles: ['admin', 'management', 'pic'] },
      { key: 'personalia.cashbon', to: '/personalia/cashbon', icon: Banknote, label: 'Cashbon', defaultRoles: ['admin', 'management', 'pic', 'crew', 'stockman', 'staff'] },
      { key: 'personalia.punishment', to: '/personalia/punishment', icon: AlertTriangle, label: 'Punishment & SP', defaultRoles: ['admin', 'management', 'pic'] },
      { key: 'personalia.leave', to: '/personalia/leave', icon: CalendarDays, label: 'Verifikasi Cuti', defaultRoles: ['admin', 'management', 'pic'] },
      { key: 'personalia.payroll', to: '/personalia/payroll', icon: DollarSign, label: 'Payroll', defaultRoles: ['admin', 'management', 'pic'] },
      { key: 'personalia.profile', to: '/profile', icon: UserCircle, label: 'Profil Saya', defaultRoles: ['admin', 'management', 'pic', 'crew', 'stockman', 'staff'] },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: TrendingUp,
    items: [
      { key: 'finance.daily', to: '/finance/daily-recap', icon: FileText, label: 'Laporan Harian Finance', defaultRoles: ['admin', 'management', 'pic'] },
      { key: 'finance.profit_loss', to: '/finance/profit-loss', icon: TrendingUp, label: 'Laporan Laba Rugi', defaultRoles: ['admin', 'management', 'pic'] },
      { key: 'finance.invoice', to: '/finance/invoice', icon: FileText, label: 'Invoice', defaultRoles: ['admin', 'management', 'pic'] },
      { key: 'finance.note_archive', to: '/finance/note-archive', icon: ImageIcon, label: 'Galeri Arsip Nota', defaultRoles: ['admin', 'management', 'pic'] },
    ],
  },
  {
    key: 'inventory',
    label: 'Stok & Inventaris',
    icon: Package,
    items: [
      { key: 'inventory.daily', to: '/inventory/daily-stock', icon: Package, label: 'Input Stok Harian', defaultRoles: ['admin', 'management', 'pic', 'stockman', 'staff'] },
      { key: 'inventory.shopping', to: '/inventory/shopping-list', icon: ShoppingCart, label: 'Rekomendasi Belanja', defaultRoles: ['admin', 'management', 'pic', 'stockman'] },
      { key: 'inventory.material', to: '/inventory/material-control', icon: Beaker, label: 'Kontrol Bahan Baku', defaultRoles: ['admin', 'management', 'pic', 'stockman'] },
    ],
  },
  {
    key: 'daily_report',
    label: 'Laporan Harian Outlet',
    icon: Send,
    items: [
      { key: 'daily_report.input', to: '/daily-report', icon: Send, label: 'Input Laporan Closing', defaultRoles: ['admin', 'management', 'pic', 'crew', 'stockman', 'staff'] },
    ],
  },
  {
    key: 'pic_daily',
    label: 'Laporan Harian PIC',
    icon: ClipboardCheck,
    items: [
      { key: 'pic_daily.report', to: '/pic-daily-report', icon: ClipboardCheck, label: 'Laporan Harian PIC', defaultRoles: ['admin', 'management', 'pic'] },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    items: [
      { key: 'marketing.content', to: '/marketing/content-plan', icon: Megaphone, label: 'Content Plan', defaultRoles: ['admin', 'management', 'pic'] },
    ],
  },
  {
    key: 'hpp',
    label: 'HPP',
    icon: Calculator,
    items: [
      { key: 'hpp.calculator', to: '/hpp', icon: Calculator, label: 'HPP', defaultRoles: ['admin', 'management', 'pic'] },
    ],
  },
  {
    key: 'roles',
    label: 'Kelola Role & Akses',
    icon: ShieldCheck,
    items: [
      { key: 'roles.manage', to: '/personalia/roles', icon: ShieldCheck, label: 'Kelola Role & Akses', defaultRoles: ['admin', 'management'] },
    ],
  },
  {
    key: 'activity',
    label: 'Log Kegiatan',
    icon: Activity,
    items: [
      { key: 'personalia.activity', to: '/activity-log', icon: Activity, label: 'Log Kegiatan', defaultRoles: ['admin', 'management'] },
    ],
  },
  {
    key: 'settings',
    label: 'Pengaturan',
    icon: SettingsIcon,
    items: [
      { key: 'settings.appearance', to: '/settings', icon: SettingsIcon, label: 'Pengaturan Tampilan', defaultRoles: ['admin', 'management'] },
    ],
  },
];

export const ALL_MENU_ITEMS: MenuItemDef[] = MENU_GROUPS.flatMap((g) => g.items);
