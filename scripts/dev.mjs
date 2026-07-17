/**
 * Stable dev server startup for Windows (especially paths containing "&").
 * - Does NOT kill an existing dev server unless --force is passed
 * - Clears stale .next cache before each fresh start
 * - Uses webpack dev (not Turbopack) to avoid ENOENT manifest races
 */
import { execSync, spawn } from "child_process";
import { existsSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const port = process.env.PORT || "3000";
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const force =
  process.argv.includes("--force") || process.env.DEV_FORCE === "1";

function getListeningPids(targetPort) {
  const pids = new Set();
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr ":${targetPort}"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      for (const line of output.split("\n")) {
        if (!line.includes("LISTENING")) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
      }
      return pids;
    }

    const output = execSync(`lsof -ti:${targetPort}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    for (const pid of output.trim().split("\n")) {
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
  } catch {
    // Port is free or netstat/lsof found nothing
  }
  return pids;
}

function isPortInUse(targetPort) {
  const pids = getListeningPids(targetPort);
  const pid = pids.size > 0 ? [...pids][0] : undefined;
  return { inUse: pids.size > 0, pid };
}

function freePort(targetPort) {
  const pids = getListeningPids(targetPort);
  for (const pid of pids) {
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
      } else {
        execSync(`kill -9 ${pid}`, { stdio: "ignore" });
      }
      console.log(`Stopped process ${pid} on port ${targetPort}`);
    } catch {
      // Process may have already exited
    }
  }
}

function clearNextCache() {
  const nextDir = join(root, ".next");
  if (existsSync(nextDir)) {
    rmSync(nextDir, { recursive: true, force: true });
    console.log("Cleared .next cache");
  }
}

const { inUse, pid } = isPortInUse(port);

if (inUse && !force) {
  console.log(
    `Dev server already running on http://localhost:${port}` +
      (pid ? ` (PID ${pid})` : "") +
      ".\nLeave that terminal open. To force restart: npm run dev:restart"
  );
  process.exit(0);
}

if (inUse && force) {
  console.log(`Force restart: stopping existing process on port ${port}...`);
  freePort(port);
}

clearNextCache();

console.log(`Starting Next.js dev server on http://localhost:${port}`);

const child = spawn(process.execPath, [nextBin, "dev", "-p", port], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PORT: port },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
