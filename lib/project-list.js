export function mergeProjects(localProjects, vaultProjects) {
  const projects = new Map(localProjects.map((project) => [project.id, project]));
  for (const project of vaultProjects) projects.set(project.id, project);
  return [...projects.values()];
}
