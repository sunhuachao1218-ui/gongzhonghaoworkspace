export function restoreView(projects, savedView) {
  const project = projects.find((item) => item.id === savedView?.projectId);
  if (!project) return { projectId: null, activeStep: null };

  return {
    projectId: project.id,
    activeStep: project.steps?.[savedView?.activeStep] ? savedView.activeStep : project.currentStep,
  };
}
