import { createServer } from "node:http";
import { createWorkbenchService } from "../lib/workbench-service.mjs";

const port = Number(process.env.WORKBENCH_SERVICE_PORT || 4174);
const vaultRoot = process.env.OBSIDIAN_VAULT_PATH || "/Users/huachao/Documents/Obsidian Vault";
const service = createWorkbenchService({ vaultRoot });

function respond(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "http://localhost:5173" });
  response.end(`${JSON.stringify(body)}\n`);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

createServer(async (request, response) => {
  if (request.method === "OPTIONS") return respond(response, 204, {});
  try {
    if (request.method === "GET" && request.url === "/api/status") return respond(response, 200, await service.status());
    if (request.method === "GET" && request.url === "/api/projects") return respond(response, 200, await service.listProjects());
    if (request.method === "PUT" && request.url === "/api/projects") return respond(response, 200, await service.saveProject(await readJson(request)));
    if (request.method === "POST" && request.url === "/api/runs") return respond(response, 202, await service.runStep(await readJson(request)));
    return respond(response, 404, { error: "Not found" });
  } catch (error) {
    return respond(response, 400, { error: error instanceof Error ? error.message : "Unknown error" });
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`公众号工作台本地服务已启动：http://127.0.0.1:${port}`);
});
