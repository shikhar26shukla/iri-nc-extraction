import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const envPath = path.join(root, ".env.local");
  try {
    const content = fsSync.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // .env.local optional for init — defaults below
  }
}

function parseDatabaseUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parsed.port ? parseInt(parsed.port, 10) : 3306,
    user: decodeURIComponent(parsed.username || "root"),
    password: decodeURIComponent(parsed.password || ""),
    database: parsed.pathname.replace(/^\//, ""),
  };
}

async function main() {
  loadEnvLocal();
  const databaseUrl =
    process.env.DATABASE_URL || "mysql://root:@localhost:3307/iris_nc";
  const { host, port, user, password, database } = parseDatabaseUrl(databaseUrl);

  console.log(`Connecting to MySQL at ${host}:${port}...`);
  const conn = await mysql.createConnection({ host, port, user, password });

  console.log(`Creating database ${database} if not exists...`);
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await conn.query(`USE \`${database}\``);

  const schemaPath = path.join(root, "lib", "db", "schema.sql");
  const schema = await fs.readFile(schemaPath, "utf-8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`Running ${statements.length} schema statements...`);
  for (const statement of statements) {
    await conn.query(statement);
  }

  await conn.end();
  console.log(`Database ${database} initialized successfully.`);
}

main().catch((err) => {
  console.error("db:init failed:", err.message || err);
  process.exit(1);
});
