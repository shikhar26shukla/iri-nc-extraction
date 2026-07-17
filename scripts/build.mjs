/**
 * Production build — clears dev cache first to prevent dev/build conflicts.
 */
import { execSync, spawnSync } from "child_process";
import { existsSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const port = process.env.PORT || "3000";
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");

function isDevServerRunning() {
  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -ano | findstr ":${port}"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      return output.includes("LISTENING");
    }
    execSync(`lsof -i:${port}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (isDevServerRunning()) {
  console.error(
    `\nError: Dev server is still running on port ${port}.\n` +
      "Stop it (Ctrl+C in the dev terminal) before running npm run build.\n" +
      "Running build while dev is active corrupts the .next folder on Windows.\n"
  );
  process.exit(1);
}

const nextDir = join(root, ".next");
if (existsSync(nextDir)) {
  rmSync(nextDir, { recursive: true, force: true });
  console.log("Cleared .next before production build");
}

const result = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
