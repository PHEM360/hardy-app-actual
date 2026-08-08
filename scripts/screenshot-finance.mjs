#!/usr/bin/env node
// Screenshots the dev-only, unauthenticated Finance preview page
// (/dev/finance-preview) so it can be reviewed without a real login.
// Usage: node scripts/screenshot-finance.mjs [outFile] [--view=chart|table|summary]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const PORT = process.env.FINANCE_PREVIEW_PORT || "5183";
const previewUrl = `http://localhost:${PORT}/dev/finance-preview`;
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const outFile = path.resolve(args[0] || ".dev-screenshots/finance.png");
const viewArg = process.argv.find((a) => a.startsWith("--view="));
const view = viewArg ? viewArg.split("=")[1] : null;

fs.mkdirSync(path.dirname(outFile), { recursive: true });

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 304) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Dev server didn't come up at ${url} within ${timeoutMs}ms`);
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let devServer = null;
let startedServer = false;
try {
  await fetch(`http://localhost:${PORT}`);
} catch {
  startedServer = true;
  const viteBin = path.join(repoRoot, "node_modules", ".bin", "vite");
  devServer = spawn(viteBin, ["--port", PORT, "--strictPort"], {
    cwd: repoRoot,
    stdio: "ignore",
    detached: true,
  });
}

try {
  await waitForServer(`http://localhost:${PORT}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.goto(previewUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Balance Over Time", { timeout: 20000 });

  if (view === "table") {
    await page.click("text=Table");
    await page.waitForTimeout(300);
  } else if (view === "summary") {
    await page.click("text=Summary");
    await page.waitForTimeout(300);
  }

  await page.screenshot({ path: outFile, fullPage: true });
  await browser.close();

  console.log(`Screenshot saved to ${outFile}`);
  if (consoleErrors.length) {
    console.log(`\n${consoleErrors.length} console error(s):`);
    for (const e of consoleErrors.slice(0, 10)) console.log(" -", e);
  }
} finally {
  if (startedServer && devServer) {
    try {
      process.kill(-devServer.pid);
    } catch {
      // already gone
    }
  }
}
