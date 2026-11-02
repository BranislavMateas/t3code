import {
  ProjectId,
  type ContextMenuItem,
  type ScopedThreadRef,
  type EnvironmentId,
} from "@t3tools/contracts";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import { useServerConfigs, useProjects } from "../state/entities";
import { threadEnvironment } from "../state/threads";
import { useOrchestrationCommand } from "../state/use-orchestration-command";
import { toastManager } from "../components/ui/toast";
import type { ThreadActionMenuId } from "../components/threadActionMenu.logic";

export function useMoveThreadToProject() {
  const projects = useProjects();
  const configs = useServerConfigs();
  const updateMetadata = useOrchestrationCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  const destinations = (thread: {
    readonly projectId: ProjectId;
    readonly environmentId: EnvironmentId;
  }): ReadonlyArray<ContextMenuItem<ThreadActionMenuId>> | undefined =>
    configs.get(thread.environmentId)?.environment.capabilities.threadProjectMove !== true
      ? undefined
      : projects
          .filter(
            (project) =>
              project.environmentId === thread.environmentId && project.id !== thread.projectId,
          )
          .map((project) => ({
            id: `move-project:${project.id}` as const,
            label: project.isScratch ? "No project" : project.title,
            icon: "folder",
          }));
  const hasWorktree = (thread: {
    readonly projectId: ProjectId;
    readonly environmentId: EnvironmentId;
    readonly worktreePath: string | null;
  }) =>
    thread.worktreePath !== null &&
    !projects.some(
      (project) =>
        project.environmentId === thread.environmentId &&
        project.id === thread.projectId &&
        project.isScratch,
    );
  const move = async (threadRef: ScopedThreadRef, action: string) => {
    const result = await updateMetadata({
      environmentId: threadRef.environmentId,
      input: {
        threadId: threadRef.threadId,
        projectId: ProjectId.make(action.slice("move-project:".length)),
      },
    });
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      const error = squashAtomCommandFailure(result);
      toastManager.add({
        type: "error",
        title: "Could not move thread",
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };
  return { destinations, move, hasWorktree };
}
