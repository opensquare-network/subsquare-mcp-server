import { fetchProjectDetails } from "./fetch.js";
import { listTreasuryProjects } from "./list.js";

export async function getTreasuryProjectDetail({ project_id: projectId } = {}) {
  if (typeof projectId !== "string" || !projectId) {
    throw new Error("Treasury project_id is required");
  }

  const projects = await listTreasuryProjects();
  const project = projects.find(({ id }) => id === projectId);
  if (!project) {
    throw new Error("Treasury project not found: " + projectId);
  }

  return fetchProjectDetails(project);
}
