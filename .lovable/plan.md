# Rencana: Marketing Content Command Center

Hanya halaman `/marketing/content-plan` (`src/pages/marketing/ContentPlan.tsx`) dan tabel `content_plans` yang akan disentuh. Routing, sidebar, dan modul lain tetap.

## 1. Migrasi Database (tabel `content_plans`)

Tambah kolom baru (semua nullable / default aman utk data lama):

- `content_type` text — enum app: `product_review`, `behind_the_scenes`, `promo`, `educational`, `user_story`
- `pillar_title` text default `''`
- `posted_url` text default `''`
- `target_views` integer default 0
- `target_leads` integer default 0
- `engagement_saves` integer default 0
- `engagement_link_clicks` integer default 0

Update CHECK constraint `status`: `'idea','briefing','production','posted','archived'` (mapping data lama: `draft→briefing`, `in_progress→production`, `review→production`).

Tambah CHECK platform: `instagram, tiktok, youtube, linkedin, facebook, x, other`.

RLS, trigger, dan policy yang sudah ada tetap.

## 2. Halaman Baru — `ContentPlan.tsx`

Layout penuh memakai `AppLayout`, container lebar (`max-w-7xl`). Struktur:

```text
┌──────────────────────────────────────────────────────────┐
│ Header: "Marketing Content Command Center" + avatar user │
├──────────────────────────────────────────────────────────┤
│ Filter Bar: DateRange | Platform(multi) | Status(multi)  │
│            | ContentType(multi) | Search                 │
├──────────────────────────────────────────────────────────┤
│ 4 Summary Cards (glassmorphism, teal #22C55E accent)     │
│  • Total Spend + sparkline                               │
│  • Avg Engagement Rate + bar per-platform                │
│  • Content Distribution (donut per platform)             │
│  • CPE Efficiency (min / avg / max)                      │
├──────────────────────────────────────────────────────────┤
│ Accordion: "➕ Add New Content Plan" (form lengkap)      │
├──────────────────────────────────────────────────────────┤
│ Batch Toolbar (muncul saat ada checkbox tercentang)      │
│ Datatable Content Calendar                               │
└──────────────────────────────────────────────────────────┘
```

### 2a. Filter Global
- Date range pakai `Calendar` shadcn di dalam `Popover` (range mode).
- Platform / Status / ContentType: dropdown multi-select (custom popover + `Checkbox` list, tanpa lib baru).
- Search: input controlled, match `contentTitle` & `pillarTitle`.
- Semua state lokal `useState`; hasil filter dipakai utk tabel + 4 widget summary.

### 2b. Summary Widgets
- Card `glass-card` + border teal tipis.
- Pakai `recharts` (sudah dependency shadcn `chart`) untuk:
  - Sparkline (LineChart mini) Total Spend per minggu.
  - Bar mini per platform untuk engagement rate.
  - Donut (PieChart) distribusi platform.
- CPE = `rate_card / totalEngagement` (totalEng = likes+comments+saves+shares+views+linkClicks); tampilkan min/avg/max formatted Rupiah.

### 2c. Form (Accordion)
Pakai `Accordion` shadcn, judul "➕ Add New Content Plan", default closed.
Field: Judul, Platform (7 opsi), Tanggal Jadwal, Status (5 opsi), Rate Card (Rupiah), Content Type, Pillar/Campaign Title, Posted URL, Target Views, Target Leads, Deskripsi.
Tombol "Tambah" warna teal (`bg-[#22C55E] hover:bg-[#16A34A]`).

### 2d. Datatable
Build manual (tanpa lib baru) memakai `<table>` styled + sort state lokal. Kolom:

1. Checkbox (bulk-select, header = select-all hasil filter)
2. Scheduled Date — format `dd-MMM-yyyy` (`date-fns`)
3. Title & Pillar (stack)
4. Platform — ikon lucide (Instagram, Youtube, Facebook, Linkedin, Twitter, Music2 utk TikTok) + label
5. Rate Card (Rupiah)
6. Status — pill berwarna per status (Ide=gray, Briefing=blue, Production=amber, Posted=teal, Archived=muted)
7. Update Status — `Select` quick dropdown
8. Posted Link — ikon `ExternalLink` buka URL baru
9. Engagement Metrics — stack icon+angka (Like/Comment/Save/Share/View/LinkClick) + tombol teal "Input Performance"
10. CPE — Rupiah, warna teal kalau low (≤ avg×0.7), red kalau high (≥ avg×1.3)

Alternating row colors (`even:bg-muted/30`). Sort header click pada Date / Rate Card / CPE.

### 2e. Batch Toolbar
Muncul sticky di atas tabel saat `selectedIds.length > 0`:
- "Update Status → Posted"
- "Archive Selected"
- Tombol "Clear Selection"
Eksekusi batch via `supabase.from('content_plans').update().in('id', ids)`.

### 2f. Modal "Input Performance"
`Dialog` full-width (max-w-2xl), grid input untuk: Likes, Comments, Saves, Shares, Views, Link Clicks. Tombol Simpan teal → update row + refresh.

## 3. Permissions
Tetap pakai `useAuth` + `useMenuPermissions` seperti versi lama (`canEdit`, `canManage`). Tidak mengubah role / RLS.

## 4. Skema Warna
- Primary aksen: `#22C55E` (teal-green) — tombol utama, highlight CPE bagus, header pill Posted.
- Background section: existing `glass-card` + neutral putih/off-white sudah sesuai.
- Status pill colors via `bg-*/15 text-*` Tailwind arbitrary.

## 5. Detail Teknis
- Tidak menambah dependency baru (recharts & date-fns sudah ada).
- Mapping status lama saat fetch: jika `status='draft'` tampil sebagai `briefing`, `in_progress|review` → `production` (juga di-migrate sekali via SQL update).
- `cpe_calc` dihitung di front-end, tidak disimpan.
- Semua perhitungan summary memoized via `useMemo` agar instan saat filter berubah.

## 6. Yang TIDAK Diubah
- `App.tsx` routing, sidebar, menuRegistry.
- Modul lain (inventory, finance, personalia, dll).
- Auth, RLS policy, edge functions.
