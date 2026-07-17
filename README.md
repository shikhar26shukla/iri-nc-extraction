# IRIS & Nominal Code Extractor

Internal web tool for accountants to upload Excel/CSV files and extract IRIS codes or Nominal Codes using hybrid local matching + Claude AI fallback.

## Setup (local)

```bash
npm install
cp .env.example .env.local
# Add ANTHROPIC_API_KEY and DATABASE_URL to .env.local
npm run db:init
npm run db:import
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Workflow

1. **Create or select a company** (Companies page or `[+]` on IRIS/NC/Skill Bases)
2. **Upload skill bases** per company on Skill Bases page
3. **Upload single-sheet files** on IRIS or NC (row 1 = headers, like `test7033.xlsx`)
4. Download coded output

Company data is stored in **MySQL** (`iris_nc` database). Seed JSON for first import lives in `data/seed/companies/`.

## Scripts

- `npm run dev` — start development server
- `npm run db:init` — create database and tables
- `npm run db:import` — import seed companies from `data/seed/companies/`
- `npm run migrate` — migrate legacy knowledge-base to company `7033`
- `npm run seed` — seed company `7033` from spreadsheets
- `npm run validate` — run pipelines against `test7033.xlsx`
- `npm run build` — production build
- `npm run build:docker` — production build for Docker (no dev-server check)

## Routes

- `/companies` — list and select companies
- `/iris` — IRIS bank statement extraction (company required)
- `/nc` — Nominal code extraction (company required)
- `/skill-bases` — per-company lookup tables
- `/settings` — app configuration (API key via env only)

## Coolify deployment

### 1. MySQL

On your Coolify MySQL server, create a **separate database** `iris_nc` (do not use other app databases like `booksly-cowork`). Create a MySQL user with privileges on `iris_nc` only.

Use Coolify's **internal MySQL hostname** in `DATABASE_URL`, not the phpMyAdmin public URL.

### 2. Application

1. New resource → GitHub repo → Build pack: **Dockerfile**
2. Expose container port **3000**
3. Set environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | `mysql://USER:PASSWORD@MYSQL_INTERNAL_HOST:3306/iris_nc` |
| `MYSQL_POOL_SIZE` | `3` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` |
| `MATCH_CONFIDENCE_THRESHOLD` | `0.85` |
| `MAX_AI_BATCH_SIZE` | `25` |
| `RUN_DB_IMPORT` | `true` on **first deploy only**, then `false` |
| `SEED_COMPANIES_DIR` | Optional; defaults to `data/seed/companies` |
| `PORT` | `3000` |

### 3. First deploy

On first deploy the container will:

1. Wait for MySQL
2. Run schema init (`db:init`)
3. Import seed companies 7033 + 7547 (`db:import`) when `RUN_DB_IMPORT=true`
4. Start the Next.js server

### 4. After first deploy

Set `RUN_DB_IMPORT=false` and redeploy so restarts do not overwrite live data.

### 5. Verify

Open `/companies` and `/skill-bases` — companies **7033** and **7547** should appear with their skill base entries.

## Docker (local test)

```bash
docker build -t iris-nc .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=mysql://root:password@host.docker.internal:3307/iris_nc \
  -e ANTHROPIC_API_KEY=your-key \
  -e RUN_DB_IMPORT=true \
  iris-nc
```
