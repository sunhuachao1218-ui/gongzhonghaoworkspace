import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { basename, join, normalize, relative, resolve } from "node:path";

const DEFAULT_WORKSPACE = "04-内容创作/公众号/工作台项目";
const BODY_FIELDS = new Set(["body", "content", "materials", "sources"]);

export function createVaultStore({ vaultRoot, workspaceRelativePath = DEFAULT_WORKSPACE }) {
  const root = resolve(vaultRoot);
  const workspace = resolve(root, workspaceRelativePath);

  if (relative(root, workspace).startsWith("..")) throw new Error("Workspace must be within the vault");

  function projectDirectory(project) {
    const declared = project.obsidianPath || join(workspaceRelativePath, project.id);
    const target = resolve(root, declared);
    if (relative(workspace, target).startsWith("..") || target === workspace) {
      throw new Error("Project path must remain within the workspace");
    }
    return target;
  }

  return {
    async saveProject(project) {
      if (!project?.id || !project?.title) throw new Error("Project requires id and title");
      const directory = projectDirectory(project);
      const metadata = Object.fromEntries(Object.entries(project).filter(([key]) => !BODY_FIELDS.has(key)));
      metadata.obsidianPath = relative(root, directory);
      await mkdir(directory, { recursive: true });
      const target = join(directory, "project.json");
      const temporary = join(directory, ".project.json.tmp");
      await writeFile(temporary, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
      await rename(temporary, target);
      return metadata;
    },
    async getProject(id) {
      const text = await readFile(join(workspace, id, "project.json"), "utf8");
      return JSON.parse(text);
    },
    async listProjects() {
      try {
        const names = await readdir(workspace);
        const projects = await Promise.all(names.filter((name) => !name.startsWith(".")).map((id) => this.getProject(id)));
        return projects.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
      } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
      }
    },
    workspacePath: workspace,
    projectFileName: (project) => join(projectDirectory(project), "project.json"),
  };
}
