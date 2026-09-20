# SPB FARM OS — V1

A local-first, mobile-first SPB Goat Farm application.

## Core V1 flow

Dashboard → RFID/Search → Goat 360° → Add Weight → automatic growth calculation.

## Storage

No Supabase and no cloud database are used. Farm data is stored in the browser using localStorage.

Use the browser's developer storage or the future Settings/Backup module to export/import JSON backups.

## Run

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
npm run preview
```

## Seed TEST data

- SPB-TEST-F-0001 — Raja
- SPB-TEST-F-0002 — Lakshmi
- SPB-TEST-M-0001 — Arjun

The app starts in TEST MODE and seeds six weight records.

## Acceptance test

1. Open RFID / Search.
2. Search `Lakshmi`.
3. Open Lakshmi's Goat 360°.
4. Select Add Weight.
5. Enter `2026-09-20` and `20.0 kg`.
6. Save.
7. Confirm current weight = 20.0 kg, previous = 19.0 kg, gain = +1.0 kg and ADG = 100 g/day.

## Important

This is V1 Core. It deliberately does not implement the complete 34-sheet workbook. Future modules can be added without replacing the core identity and calculation engine.
