import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { setDefaultResultOrder } from "node:dns";

setDefaultResultOrder("ipv4first");

function loadLocalEnv() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  } catch { /* CI and hosted environments can provide variables directly. */ }
}

function option(name, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function percentile(values, percent) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil((percent / 100) * sorted.length) - 1)];
}

function formatMs(value) {
  return `${Math.round(value)} ms`;
}

function errorLabel(error) {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause;
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "";
  return code ? `${error.message} (${code})` : error.message;
}

loadLocalEnv();
const token = option("token");
const rpcOnly = process.argv.includes("--rpc-only");
const pageUrl = option("page-url", "https://waystudia.github.io/vakha.studia/");
const stages = option("stages", "10,25,50,100,150").split(",").map(Number).filter((value) => Number.isInteger(value) && value > 0);
const timeoutMs = Number(option("timeout-ms", "20000"));
const pauseMs = Number(option("pause-ms", "1200"));
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!token || (!rpcOnly && !pageUrl) || !supabaseUrl || !publishableKey || !stages.length) {
  console.error("Usage: npm run load:public -- --token=<public-token> [--stages=10,25,50,100,150] [--page-url=https://…] [--rpc-only]");
  process.exit(2);
}

const rpcUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_public_class`;

async function readResponse(response) {
  const body = await response.arrayBuffer();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return body.byteLength;
}

async function openPublicClass() {
  const started = performance.now();
  let pageBytes = 0;
  let pageMs = 0;
  if (!rpcOnly) {
    const pageStarted = performance.now();
    const pageResponse = await fetch(pageUrl, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    pageBytes = await readResponse(pageResponse);
    pageMs = performance.now() - pageStarted;
  }
  const rpcStarted = performance.now();
  const rpcResponse = await fetch(rpcUrl, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: token }),
  });
  const rpcBytes = await readResponse(rpcResponse);
  return { totalMs: performance.now() - started, pageMs, rpcMs: performance.now() - rpcStarted, bytes: pageBytes + rpcBytes };
}

console.log(`Read-only ${rpcOnly ? "catalog RPC" : "public opening"} test: ${stages.join(" → ")} simultaneous users`);
console.log("Stage | OK | Errors | total p50 | total p95 | RPC p95 | traffic");
let failed = false;
for (const concurrency of stages) {
  const results = await Promise.all(Array.from({ length: concurrency }, async () => {
    try { return { ok: true, value: await openPublicClass() }; }
    catch (error) { return { ok: false, error: errorLabel(error) }; }
  }));
  const successful = results.flatMap((result) => result.ok ? [result.value] : []);
  const errors = results.length - successful.length;
  const errorSummary = [...new Set(results.flatMap((result) => result.ok ? [] : [result.error]))].slice(0, 3).join(", ");
  const totalTimes = successful.map((result) => result.totalMs);
  const rpcTimes = successful.map((result) => result.rpcMs);
  const bytes = successful.reduce((sum, result) => sum + result.bytes, 0);
  console.log(`${String(concurrency).padStart(5)} | ${String(successful.length).padStart(3)} | ${String(errors).padStart(6)} | ${formatMs(percentile(totalTimes, 50)).padStart(9)} | ${formatMs(percentile(totalTimes, 95)).padStart(9)} | ${formatMs(percentile(rpcTimes, 95)).padStart(7)} | ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  if (errorSummary) console.log(`      errors: ${errorSummary}`);
  if (errors > 0 || (concurrency <= 100 && percentile(totalTimes, 95) > 5000)) failed = true;
  if (pauseMs > 0 && concurrency !== stages.at(-1)) await new Promise((resolvePause) => setTimeout(resolvePause, pauseMs));
}

const baselineThrough = Math.max(...stages.filter((stage) => stage <= 100), 0);
if (failed) {
  console.error("Load test did not meet the baseline: zero errors and p95 <= 5 s through 100 users.");
  process.exit(1);
}
console.log(`Baseline passed: zero errors and p95 <= 5 s through ${baselineThrough || stages.at(-1)} simultaneous users.`);
