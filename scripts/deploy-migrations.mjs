import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const maxAttempts = 5;
const initialRetryDelayMs = 2_000;

function runMigrationDeploy() {
  return new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawn(command, ["prisma", "migrate", "deploy"], {
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let output = "";

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

export function isAdvisoryLockTimeout(output) {
  return output.includes("P1002") && /timed out trying to acquire a postgres advisory lock/i.test(output);
}

async function main() {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await runMigrationDeploy();
    if (result.code === 0) return;

    if (!isAdvisoryLockTimeout(result.output) || attempt === maxAttempts) {
      process.exitCode = result.code;
      return;
    }

    const delayMs = initialRetryDelayMs * 2 ** (attempt - 1);
    console.warn(`Prisma migration is waiting on another deployment's advisory lock. Retrying in ${delayMs / 1000}s (${attempt}/${maxAttempts - 1})…`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Could not run Prisma migrations:", error);
    process.exitCode = 1;
  });
}