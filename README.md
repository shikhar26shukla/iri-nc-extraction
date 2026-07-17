# IRIS & Nominal Code Extractor

Internal web tool for accountants to upload Excel/CSV files and extract IRIS codes or Nominal Codes using hybrid local matching + Claude AI fallback.

## Setup

```bash
npm install
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY to .env.local
npm run migrate
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Workflow

1. **Create or select a company** (Companies page or `[+]` on IRIS/NC/Skill Bases)
2. **Upload skill bases** per company on Skill Bases page
3. **Upload single-sheet files** on IRIS or NC (row 1 = headers, like `test7033.xlsx`)
4. Download coded output

Company data is stored in `data/companies/{id}/iris.json` and `nc.json`.

## Scripts

- `npm run dev` — start development server
- `npm run migrate` — migrate legacy knowledge-base to company `7033`
- `npm run seed` — seed company `7033` from spreadsheets in `data/seed/`
- `npm run validate` — run pipelines against `test7033.xlsx`
- `npm run build` — production build

## Routes

- `/companies` — list and select companies
- `/iris` — IRIS bank statement extraction (company required)
- `/nc` — Nominal code extraction (company required)
- `/skill-bases` — per-company lookup tables
- `/settings` — app configuration (API key via env only)
