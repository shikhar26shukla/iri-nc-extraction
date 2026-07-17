import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

type SqlParams = (string | number | boolean | null | Date | Buffer)[];

function parseDatabaseUrl(url: string): mysql.PoolOptions {
  const parsed = new URL(url);
  if (parsed.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use mysql:// scheme");
  }
  return {
    host: parsed.hostname || "localhost",
    port: parsed.port ? parseInt(parsed.port, 10) : 3306,
    user: decodeURIComponent(parsed.username || "root"),
    password: decodeURIComponent(parsed.password || ""),
    database: parsed.pathname.replace(/^\//, ""),
    waitForConnections: true,
    connectionLimit: parseInt(process.env.MYSQL_POOL_SIZE || "3", 10),
    enableKeepAlive: true,
  };
}

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (e.g. mysql://root:@localhost:3307/iris_nc)"
    );
  }
  return url;
}

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(parseDatabaseUrl(getDatabaseUrl()));
  }
  return pool;
}

export async function query<T>(
  sql: string,
  params: SqlParams = []
): Promise<T[]> {
  const [rows] = await getPool().query(sql, params);
  return rows as T[];
}

export async function execute(
  sql: string,
  params: SqlParams = []
): Promise<mysql.ResultSetHeader> {
  const [result] = await getPool().execute(sql, params);
  return result as mysql.ResultSetHeader;
}

export async function withTransaction<T>(
  fn: (conn: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
