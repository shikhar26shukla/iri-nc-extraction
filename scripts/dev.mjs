/**
 * Stable dev server startup for Windows (especially paths containing "&").
 * - Stops any process already bound to the dev port
 * - Clears stale .next cache before each start
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

function freePort(targetPort) {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr ":${targetPort}"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const pids = new Set();
      for (const line of output.split("\n")) {
        if (!line.includes("LISTENING")) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== "0") pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
          console.log(`Stopped process ${pid} on port ${targetPort}`);
        } catch {
          // Process may have already exited
        }
      }
      return;
    }

    execSync(`lsof -ti:${targetPort} | xargs kill -9 2>/dev/null || true`, {
      shell: true,
      stdio: "ignore",
    });
  } catch {
    // Port is free or netstat found nothing
  }
}

function clearNextCache() {
  const nextDir = join(root, ".next");
  if (existsSync(nextDir)) {
    rmSync(nextDir, { recursive: true, force: true });
    console.log("Cleared .next cache");
  }
}

freePort(port);
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
