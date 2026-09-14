import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createWorkbenchService } from "../lib/workbench-service.mjs";
import { createReaderCommitteeService } from "../lib/reader-committee.mjs";
import { createReaderCommitteeSettingsStore } from "../lib/reader-committee-settings.mjs";

const port = Number(process.env.WORKBENCH_SERVICE_PORT || 4174);
const vaultRoot = process.env.OBSIDIAN_VAULT_PATH || "/Users/huachao/Documents/Obsidian Vault";
const hermesEnvPath = "/Users/huachao/.hermes/.env";
const committeeEnvPath = "/Users/huachao/.reader-committee/.env";
const coverSampleRoots = {
  types: "/Users/huachao/Desktop/封面预览",
  palettes: "/Users/huachao/Desktop/封面样板/samples",
  renderings: "/Users/huachao/Desktop/封面样板/samples",
};
const coverSamplePaths = {
  types: { "type-hero.png": new URL("../public/cover-samples/type-hero.png", import.meta.url).pathname },
};
const coverSampleFiles = {
  types: new Set(["type-hero.png", "type-conceptual.png", "type-typography.png", "type-metaphor.png", "type-scene.png", "type-minimal.png"]),
  palettes: new Set(["pal-warm.png", "pal-elegant.png", "pal-cool.png", "pal-dark.png", "pal-earth.png", "pal-vivid.png", "pal-pastel.png", "pal-mono.png", "pal-retro.png", "pal-duotone.png", "pal-macaron.png"]),
  renderings: new Set(["ren-flat-vector.png", "ren-hand-drawn.png", "ren-painterly.png", "ren-digital.png", "ren-pixel.png", "ren-chalk.png", "ren-screen-print.png"]),
};

async function loadHermesApiEnvironment() {
  try {
    const text = await readFile(hermesEnvPath, "utf8");
    const entries = text.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*(API_SERVER_(?:KEY|PORT|HOST|ENABLED))=(.*)\s*$/);
      return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, "")]] : [];
    });
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

async function loadCommitteeEnvironment() {
  try {
    const text = await readFile(committeeEnvPath, "utf8");
    return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*(READER_COMMITTEE_(?:API_URL|API_KEY|MODEL))=(.*)\s*$/);
      return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, "")]] : [];
    }));
  } catch { return {}; }
}

const hermesEnvironment = await loadHermesApiEnvironment();
const service = createWorkbenchService({
  vaultRoot,
  hermesUrl: process.env.HERMES_API_URL || (hermesEnvironment.API_SERVER_ENABLED === "true" ? `http://${hermesEnvironment.API_SERVER_HOST || "127.0.0.1"}:${hermesEnvironment.API_SERVER_PORT || "8642"}` : undefined),
  hermesApiKey: process.env.HERMES_API_KEY || hermesEnvironment.API_SERVER_KEY,
});
const committeeSettings = createReaderCommitteeSettingsStore({ envPath: committeeEnvPath });
async function currentCommittee() {
  const environment = await loadCommitteeEnvironment();
  return createReaderCommitteeService({ vaultRoot, apiUrl: process.env.READER_COMMITTEE_API_URL || environment.READER_COMMITTEE_API_URL, apiKey: process.env.READER_COMMITTEE_API_KEY || environment.READER_COMMITTEE_API_KEY, model: process.env.READER_COMMITTEE_MODEL || environment.READER_COMMITTEE_MODEL || "openai/gpt-5.4-mini" });
}

function respond(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "http://localhost:5173",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(`${JSON.stringify(body)}\n`);
}

async function respondCoverSample(response, category, filename) {
  if (!coverSampleRoots[category] || !coverSampleFiles[category].has(filename)) return respond(response, 404, { error: "Cover sample not found" });
  const projectAsset = coverSamplePaths[category]?.[filename];
  const image = await readFile(projectAsset || join(coverSampleRoots[category], filename));
  response.writeHead(200, { "Content-Type": projectAsset ? "image/png" : "image/jpeg", "Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "http://localhost:5173" });
  response.end(image);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

createServer(async (request, response) => {
  if (request.method === "OPTIONS") return respond(response, 204, {});
  try {
    const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
    const sample = pathname.match(/^\/api\/cover-samples\/(types|palettes|renderings)\/([^/]+)$/);
    if (request.method === "GET" && sample) return respondCoverSample(response, sample[1], sample[2]);
    if (request.method === "GET" && request.url === "/api/status") return respond(response, 200, { ...(await service.status()), committee: await committeeSettings.status() });
    if (request.method === "GET" && request.url === "/api/projects") return respond(response, 200, await service.listProjects());
    if (request.method === "PUT" && request.url === "/api/projects") return respond(response, 200, await service.saveProject(await readJson(request)));
    if (request.method === "POST" && request.url === "/api/runs") return respond(response, 202, await service.runStep(await readJson(request)));
    if (request.method === "GET" && request.url === "/api/reader-committee/models") return respond(response, 200, await committeeSettings.listModels());
    if (request.method === "PUT" && request.url === "/api/reader-committee/settings") return respond(response, 200, await committeeSettings.save(await readJson(request)));
    if (request.method === "POST" && request.url === "/api/reader-committee/files") return respond(response, 200, await (await currentCommittee()).listMarkdownFiles((await readJson(request)).project));
    if (request.method === "POST" && request.url === "/api/reader-committee") return respond(response, 200, await (await currentCommittee()).run(await readJson(request)));
    if (request.method === "GET" && request.url?.startsWith("/api/runs/")) return respond(response, 200, await service.getRunStatus(request.url.slice("/api/runs/".length)));
    return respond(response, 404, { error: "Not found" });
  } catch (error) {
    return respond(response, 400, { error: error instanceof Error ? error.message : "Unknown error" });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`公众号工作台本地服务已启动：http://127.0.0.1:${port}`);
});
