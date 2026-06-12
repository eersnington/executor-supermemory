import {
  Effect,
  IntegrationDetectionResult,
  IntegrationSlug,
  ToolResult,
  definePlugin,
  tool,
} from "@executor-js/sdk/core";
import type { InvokeToolInput, PluginCtx } from "@executor-js/sdk/core";

import { apiKeyTemplate, resolveSupermemoryIntegrationConfig } from "./integration.ts";
import type {
  AddIntegrationInput,
  SetupLocalInput,
  SupermemoryIntegrationConfig,
  SupermemoryPluginOptions,
} from "./integration.ts";
import {
  connectionHandoffUrl,
  localSetupIntegrationInput,
  setupLocalInputSchema,
  setupLocalInstructions,
  setupLocalOutputSchema,
} from "./setup-tool.ts";
import { executeSupermemoryRequest } from "./supermemory-http.ts";
import { planSupermemoryRequest } from "./tool-request.ts";
import { toolDefinitions } from "./tools.ts";

interface SupermemoryPluginExtension {
  readonly addIntegration: (input?: AddIntegrationInput) => Effect.Effect<void, unknown>;
  readonly getIntegration: (slug?: string) => Effect.Effect<unknown, unknown>;
  readonly setupLocal: (input?: SetupLocalInput) => Effect.Effect<
    {
      readonly integration: string;
      readonly handoffUrl: string;
      readonly instructions: string;
    },
    unknown,
    unknown
  >;
}

export const supermemoryPlugin = definePlugin((options: SupermemoryPluginOptions = {}) => ({
  id: "supermemory" as const,
  packageName: "executor-supermemory",
  storage: () => ({}),
  extension: (ctx: PluginCtx): SupermemoryPluginExtension => {
    const addIntegration = (input: AddIntegrationInput = {}) => {
      const config = resolveSupermemoryIntegrationConfig(input, options, process.env);

      return ctx.core.integrations.register({
        slug: IntegrationSlug.make(input.slug ?? "supermemory"),
        description: input.description ?? "Supermemory memory API",
        config,
        canRemove: true,
        canRefresh: true,
      });
    };

    return {
      addIntegration,
      getIntegration: (slug = "supermemory") =>
        ctx.core.integrations.get(IntegrationSlug.make(slug)),
      setupLocal: (input: SetupLocalInput = {}) =>
        Effect.gen(function* () {
          const integration = localSetupIntegrationInput(input, options);
          yield* addIntegration(integration);
          const handoffUrl = connectionHandoffUrl({
            webBaseUrl: process.env.EXECUTOR_WEB_BASE_URL,
            integration: integration.slug,
            owner: input.owner,
            label: input.label,
          });

          return {
            integration: integration.slug,
            handoffUrl,
            instructions: setupLocalInstructions({ handoffUrl }),
          };
        }),
    };
  },
  staticSources: (self: SupermemoryPluginExtension) => [
    {
      id: "supermemory",
      kind: "executor",
      name: "Supermemory",
      tools: [
        tool({
          name: "setupLocal",
          description:
            "Register a local Supermemory integration and return the browser URL for adding its API key.",
          inputSchema: setupLocalInputSchema,
          outputSchema: setupLocalOutputSchema,
          execute: (input: SetupLocalInput) => self.setupLocal(input),
        }),
      ],
    },
  ],
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
