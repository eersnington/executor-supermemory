import { ToolResult } from "@executor-js/sdk/core";

import type { SupermemoryIntegrationConfig } from "./integration.ts";
import type { ForgetMemoryInput, ProfileInput, RecallInput, SaveMemoryInput } from "./tools.ts";

export interface SupermemoryRequestPlan {
  readonly method: "GET" | "POST" | "DELETE";
  readonly path: string;
  readonly body?: unknown;
}

const missingContainerTag = () =>
  ToolResult.fail({
    code: "supermemory_missing_container_tag",
    message:
      "Supermemory container tag is missing. Pass containerTag or configure defaultContainerTag on the integration. No request was sent.",
  });

function resolveContainerTag(input: {
  readonly containerTag?: string;
  readonly config: SupermemoryIntegrationConfig;
}) {
  const containerTag = input.containerTag ?? input.config.defaultContainerTag;
  const trimmed = containerTag?.trim();
  return trimmed == null || trimmed.length === 0 ? undefined : trimmed;
}

export function planSupermemoryRequest(input: {
  readonly toolName: string;
  readonly args: unknown;
  readonly config: SupermemoryIntegrationConfig;
}) {
  switch (input.toolName) {
    case "memory.save": {
      const toolInput = input.args as SaveMemoryInput;
      const containerTag = resolveContainerTag({
        containerTag: toolInput.containerTag,
        config: input.config,
      });
      if (containerTag == null) return missingContainerTag();

      return ToolResult.ok({
        method: "POST",
        path: "/v3/documents",
        body: {
          content: toolInput.content,
          containerTag,
          ...(toolInput.customId === undefined ? {} : { customId: toolInput.customId }),
          ...(toolInput.metadata === undefined ? {} : { metadata: toolInput.metadata }),
          ...(toolInput.taskType === undefined ? {} : { taskType: toolInput.taskType }),
        },
      } satisfies SupermemoryRequestPlan);
    }

    case "memory.forget": {
      const toolInput = input.args as ForgetMemoryInput;
      if (toolInput.id == null && toolInput.content == null) {
        return ToolResult.fail({
          code: "supermemory_missing_memory_identifier",
          message:
            "Forgetting a Supermemory memory requires either id or exact content. No request was sent.",
        });
      }
      const containerTag = resolveContainerTag({
        containerTag: toolInput.containerTag,
        config: input.config,
      });
      if (containerTag == null) return missingContainerTag();

      return ToolResult.ok({
        method: "DELETE",
        path: "/v4/memories",
        body: {
          containerTag,
          ...(toolInput.id === undefined ? {} : { id: toolInput.id }),
          ...(toolInput.content === undefined ? {} : { content: toolInput.content }),
          ...(toolInput.reason === undefined ? {} : { reason: toolInput.reason }),
        },
      } satisfies SupermemoryRequestPlan);
    }

    case "recall": {
      const toolInput = input.args as RecallInput;
      const containerTag = resolveContainerTag({
        containerTag: toolInput.containerTag,
        config: input.config,
      });
      if (containerTag == null) return missingContainerTag();

      if (toolInput.includeProfile === false) {
        return ToolResult.ok({
          method: "POST",
          path: "/v4/search",
          body: {
            q: toolInput.query,
            containerTag,
            searchMode: toolInput.searchMode ?? input.config.defaults.searchMode,
            limit: toolInput.limit ?? input.config.defaults.limit,
            threshold: toolInput.threshold ?? input.config.defaults.threshold,
          },
        } satisfies SupermemoryRequestPlan);
      }

      return ToolResult.ok({
        method: "POST",
        path: "/v4/profile",
        body: {
          containerTag,
          q: toolInput.query,
          ...(toolInput.threshold === undefined ? {} : { threshold: toolInput.threshold }),
        },
      } satisfies SupermemoryRequestPlan);
    }

    case "profile": {
      const toolInput = input.args as ProfileInput;
      const containerTag = resolveContainerTag({
        containerTag: toolInput.containerTag,
        config: input.config,
      });
      if (containerTag == null) return missingContainerTag();

      return ToolResult.ok({
        method: "POST",
        path: "/v4/profile",
        body: {
          containerTag,
          ...(toolInput.query === undefined ? {} : { q: toolInput.query }),
          ...(toolInput.threshold === undefined ? {} : { threshold: toolInput.threshold }),
        },
      } satisfies SupermemoryRequestPlan);
    }

    case "projects.list":
      return ToolResult.ok({
        method: "GET",
        path: "/v3/projects",
      } satisfies SupermemoryRequestPlan);

    default:
      return ToolResult.fail({
        code: "supermemory_unknown_tool",
        message: `Supermemory tool ${input.toolName} is not implemented. Refresh the connection tools and retry.`,
      });
  }
}
