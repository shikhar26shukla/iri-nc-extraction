import net from "net";

function parseDatabaseUrl(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname || "localhost",
    port: parsed.port ? parseInt(parsed.port, 10) : 3306,
  };
}

function tryConnect(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port }, () => {
      socket.end();
      resolve(undefined);
    });
    socket.on("error", reject);
    socket.setTimeout(5000, () => {
      socket.destroy();
      reject(new Error("connection timeout"));
    });
  });
}

async function waitForMysql(maxAttempts = 30, delayMs = 2000) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const { host, port } = parseDatabaseUrl(url);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await tryConnect(host, port);
      console.log(`MySQL reachable at ${host}:${port}`);
      return;
    } catch {
      console.log(`Waiting for MySQL at ${host}:${port} (${attempt}/${maxAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.error(`MySQL not reachable at ${host}:${port} after ${maxAttempts} attempts`);
  process.exit(1);
}

waitForMysql();
