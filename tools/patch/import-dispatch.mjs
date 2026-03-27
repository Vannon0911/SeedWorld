import { readFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const opts = { file: "", server: "http://127.0.0.1:3000", actor: "terminal-dispatch" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--") && !opts.file) {
      opts.file = a;
      continue;
    }
    if (a === "--server") {
      opts.server = argv[++i] || opts.server;
      continue;
    }
    if (a === "--actor") {
      opts.actor = argv[++i] || opts.actor;
    }
  }
  return opts;
}

async function callApi(server, route, body) {
  const res = await fetch(`${server}${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

async function toBase64(absPath) {
  const data = await readFile(absPath);
  return data.toString("base64");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.file) {
    throw new Error("Usage: node tools/patch/import-dispatch.mjs <manifest.json|manifest.zip> [--server URL] [--actor name]");
  }

  const abs = path.isAbsolute(opts.file) ? opts.file : path.resolve(process.cwd(), opts.file);
  const ext = path.extname(abs).toLowerCase();
  const fileName = path.basename(abs);
  const payloadBase64 = await toBase64(abs);

  let inputType = "";
  if (ext === ".zip") inputType = "zip";
  if (ext === ".json") inputType = "manifest";
  if (!inputType) {
    throw new Error("Only .json or .zip supported.");
  }

  const started = await callApi(opts.server, "/api/start-session", {
    inputType,
    fileName,
    payloadBase64,
    actor: opts.actor
  });

  console.log(`[PATCH_DISPATCH] session started: ${started.sessionId}`);
}

main().catch((error) => {
  console.error(`[PATCH_DISPATCH][FAIL] ${error.message}`);
  process.exit(1);
});
