import {
  Effect,
  IntegrationDetectionResult,
  IntegrationSlug,
  ToolResult,
  definePlugin,
} from "@executor-js/sdk/core";
import type { InvokeToolInput, PluginCtx } from "@executor-js/sdk/core";

import { apiKeyTemplate, resolveSupermemoryIntegrationConfig } from "./integration.ts";
import type {
  AddIntegrationInput,
  SupermemoryIntegrationConfig,
  SupermemoryPluginOptions,
} from "./integration.ts";
import { executeSupermemoryRequest } from "./supermemory-http.ts";
import { planSupermemoryRequest } from "./tool-request.ts";
import { toolDefinitions } from "./tools.ts";

export const supermemoryPlugin = definePlugin((options: SupermemoryPluginOptions = {}) => ({
  id: "supermemory" as const,
  packageName: "executor-supermemory",
  storage: () => ({}),
  extension: (ctx: PluginCtx) => ({
    addIntegration: (input: AddIntegrationInput = {}) => {
      const config = resolveSupermemoryIntegrationConfig(input, options, process.env);

      return ctx.core.integrations.register({
        slug: IntegrationSlug.make(input.slug ?? "supermemory"),
        description: input.description ?? "Supermemory memory API",
        config,
        canRemove: true,
        canRefresh: true,
      });
    },
    getIntegration: (slug = "supermemory") => ctx.core.integrations.get(IntegrationSlug.make(slug)),
  }),
  integrationPresets: [
    {
      id: "supermemory",
      name: "Supermemory",
      summary: "Hosted or local Supermemory memory API",
      url: options.baseURL,
      endpoint: options.baseURL,
      featured: true,
      transport: "remote" as const,
    },
  ],
  describeAuthMethods: () => [
    {
      id: apiKeyTemplate,
      label: "Supermemory API key",
      kind: "apikey" as const,
      template: apiKeyTemplate,
      placements: [
        {
          carrier: "header" as const,
          name: "Authorization",
          prefix: "Bearer ",
          variable: "token",
        },
      ],
    },
  ],
  describeIntegrationDisplay: (integration: { readonly config: unknown }) => {
    const config = integration.config as SupermemoryIntegrationConfig;
    return { url: config.baseURL };
  },
  detect: ({ url }: { readonly url: string }) =>
    Effect.succeed(
      /supermemory/i.test(url) || /localhost:6767/.test(url)
        ? IntegrationDetectionResult.make({
            kind: "supermemory",
            slug: "supermemory",
            name: "Supermemory",
            confidence: "medium",
            endpoint: url,
          })
        : null,
    ),
  resolveTools: () => Effect.succeed({ tools: toolDefinitions }),
  invokeTool: ({ ctx, toolRow, credential, args }: InvokeToolInput) =>
    Effect.gen(function* () {
      const config = credential.config as SupermemoryIntegrationConfig;
      const apiKey = credential.value;
      if (apiKey == null || apiKey.trim().length === 0) {
        return ToolResult.fail({
          code: "supermemory_missing_api_key",
          message:
            "The Supermemory connection did not resolve an API key. Reconnect this integration with a hosted Supermemory key or the key printed by the local Supermemory server. No request was sent.",
        });
      }

      const request = planSupermemoryRequest({
        toolName: String(toolRow.name),
        args,
        config,
      });
      if (!request.ok) return request;

      return yield* executeSupermemoryRequest({
        httpClientLayer: ctx.httpClientLayer,
        baseURL: config.baseURL,
        apiKey,
        request: request.data,
      });
    }),
}));

export default supermemoryPlugin;
