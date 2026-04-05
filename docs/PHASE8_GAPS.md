# Phase 8 — Data Viewing & UI (§12, §13, §18) Gap Checklist

## Compliant Items (already working)
1. ✅ Server-side pagination in DataTable (page numbers, prev/next, "Showing X–Y of Z")
2. ✅ Standalone Pagination component with first/last/prev/next, page-size selector, page numbers
3. ✅ Column sorting (click headers, asc/desc indicators)
4. ✅ Row selection with checkboxes + bulk actions bar
5. ✅ Color system — all 9 palettes defined as CSS custom properties (light + dark mode)
6. ✅ Quick filters on admin dashboard (Today, Yesterday, This Week, etc.)
7. ✅ Skeleton loading states (TableSkeleton, EmptyState)
8. ✅ Data table with striped rows, sticky header, compact mode options
9. ✅ @tanstack/react-virtual installed in package.json
10. ✅ xlsx package installed for export

## Gaps to Implement

| # | Gap | Severity | File(s) |
|---|-----|----------|---------|
| 1 | DataTable missing rows-per-page selector — Pagination component has it but not integrated into DataTable | HIGH | data-table.tsx |
| 2 | DataTable missing First/Last page buttons — only has prev/next; standalone Pagination has them | HIGH | data-table.tsx |
| 3 | Typography wrong — uses Geist instead of Plus Jakarta Sans (primary) and JetBrains Mono (monospace) | HIGH | layout.tsx, tailwind.config.ts |
| 4 | Virtualization not active — @tanstack/react-virtual installed but DataTable doesn't use it for 50+ rows | MEDIUM | data-table.tsx |
| 5 | Quick Export button missing from DataTable — each page does custom export instead of reusable table-level button | MEDIUM | data-table.tsx |
| 6 | View type toggle missing — no table/card view switch on any data page | LOW | data-table.tsx (new prop) |
