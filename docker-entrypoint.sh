#!/bin/sh
set -e

echo "Waiting for MySQL..."
node scripts/wait-for-mysql.mjs

echo "Initializing database schema..."
node scripts/init-db.mjs

if [ "$RUN_DB_IMPORT" = "true" ]; then
  echo "Importing seed companies from ${SEED_COMPANIES_DIR:-data/seed/companies}..."
  node ./node_modules/tsx/dist/cli.mjs scripts/import-json-to-mysql.ts
else
  echo "Skipping seed import (RUN_DB_IMPORT is not true)"
fi

echo "Starting Next.js on port ${PORT:-3000}..."
exec node server.js
