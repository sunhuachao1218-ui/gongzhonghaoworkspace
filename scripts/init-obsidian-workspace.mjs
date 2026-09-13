import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const OBSIDIAN_VAULT = "/Users/huachao/Documents/Obsidian Vault";
export const WORKSPACE_RELATIVE_PATH = "04-内容创作/公众号/工作台项目";

export function workspacePathFor(vaultRoot = OBSIDIAN_VAULT) {
  const root = resolve(vaultRoot);
  const workspace = resolve(root, WORKSPACE_RELATIVE_PATH);
  if (relative(root, workspace).startsWith("..")) throw new Error("Workspace must remain inside the Obsidian Vault");
  return workspace;
}

export async function initializeWorkspace(vaultRoot = OBSIDIAN_VAULT) {
  const workspace = workspacePathFor(vaultRoot);
  await mkdir(workspace, { recursive: true });
  await writeFile(`${workspace}/.gitkeep`, "", { flag: "a" });
  return workspace;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const workspace = await initializeWorkspace();
  process.stdout.write(`${workspace}\n`);
}
