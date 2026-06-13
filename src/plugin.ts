import {
  Effect,
  IntegrationDetectionResult,
  IntegrationSlug,
  Schema,
  type StorageFailure,
  ToolResult,
  definePlugin,
  tool,
} from "@executor-js/sdk/core";
import type { InvokeToolInput, PluginCtx, StaticToolExecuteContext } from "@executor-js/sdk/core";

import {
  cloudApiKeyTemplate,
  hostedBaseURL,
  isLocalSupermemoryBaseURL,
  localBaseURL,
  localApiKeyTemplate,
  localNoAuthTemplate,
  noAuthTemplate,
  resolveSupermemoryIntegrationConfig,
  supermemoryBaseURLForTemplate,
  supermemoryIconUrl,
} from "./integration.ts";
import type {
  AddIntegrationInput,
  SetupLocalInput,
  SupermemoryIntegrationConfig,
  SupermemoryPluginOptions,
} from "./integration.ts";
import {
  connectionHandoffUrl,
  setupLocalInputSchema,
  setupLocalInstructions,
  setupLocalOutputSchema,
} from "./setup-tool.ts";
import { executeSupermemoryRequest } from "./supermemory-http.ts";
import { planSupermemoryRequest } from "./tool-request.ts";
import {
  ForgetMemoryInput,
  ProfileInput,
  ProjectsListInput,
  RecallInput,
  SaveMemoryInput,
  toolDefinitions,
} from "./tools.ts";

type SupermemoryStore = Record<never, never>;
type ExistingIntegration = Readonly<Record<string, unknown>>;

const SaveMemoryInputStaticSchema = Schema.toStandardSchemaV1(
  Schema.toStandardJSONSchemaV1(SaveMemoryInput),
);
const ForgetMemoryInputStaticSchema = Schema.toStandardSchemaV1(
  Schema.toStandardJSONSchemaV1(ForgetMemoryInput),
);
const RecallInputStaticSchema = Schema.toStandardSchemaV1(
  Schema.toStandardJSONSchemaV1(RecallInput),
);
const ProfileInputStaticSchema = Schema.toStandardSchemaV1(
  Schema.toStandardJSONSchemaV1(ProfileInput),
);
const ProjectsListInputStaticSchema = Schema.toStandardSchemaV1(
  Schema.toStandardJSONSchemaV1(ProjectsListInput),
);

function invokeSupermemoryTool(input: {
  readonly ctx: PluginCtx<SupermemoryStore>;
  readonly toolName: string;
  readonly args: unknown;
  readonly config: SupermemoryIntegrationConfig;
  readonly apiKey?: string;
}) {
  const request = planSupermemoryRequest({
    toolName: input.toolName,
    args: input.args,
    config: input.config,
  });
  if (!request.ok) return Effect.succeed(request);

  return executeSupermemoryRequest({
    httpClientLayer: input.ctx.httpClientLayer,
    baseURL: input.config.baseURL,
    ...(input.apiKey == null ? {} : { apiKey: input.apiKey }),
    request: request.data,
  });
}

const cloudApiKeyAuthMethod = {
  id: cloudApiKeyTemplate,
  label: "Cloud API key",
  kind: "apikey" as const,
  template: cloudApiKeyTemplate,
  placements: [
    {
      carrier: "header" as const,
      name: "Authorization",
      prefix: "Bearer ",
      variable: "token",
    },
  ],
};

const localApiKeyAuthMethod = {
  id: localApiKeyTemplate,
  label: "Local API key",
  kind: "apikey" as const,
  template: localApiKeyTemplate,
  placements: cloudApiKeyAuthMethod.placements,
};

const localNoAuthMethod = {
  id: localNoAuthTemplate,
  label: "Local no auth",
  kind: "none" as const,
  template: localNoAuthTemplate,
};

function localSupermemoryTools(config: SupermemoryIntegrationConfig) {
  const execute =
    (toolName: string) =>
    (args: unknown, { ctx }: StaticToolExecuteContext<SupermemoryStore>) =>
      invokeSupermemoryTool({ ctx, toolName, args, config });

  return [
    tool({
      name: "memory.save",
      description:
        "Save memory-worthy user information, preferences, facts, project context, links, or notes to local Supermemory.",
      annotations: {
        requiresApproval: true,
        approvalDescription: "Save information to local Supermemory",
      },
      inputSchema: SaveMemoryInputStaticSchema,
      execute: execute("memory.save"),
    }),
    tool({
      name: "memory.forget",
      description:
        "Forget a specific local Supermemory memory by id or exact content match when information is outdated or the user requests removal.",
      annotations: {
        requiresApproval: true,
        approvalDescription: "Forget a local Supermemory memory",
      },
      inputSchema: ForgetMemoryInputStaticSchema,
      execute: execute("memory.forget"),
    }),
    tool({
      name: "recall",
      description:
        "Search local Supermemory for relevant memories. By default, also returns profile context for the query.",
      inputSchema: RecallInputStaticSchema,
      execute: execute("recall"),
    }),
    tool({
      name: "profile",
      description:
        "Fetch the local Supermemory profile for a container tag, optionally with query results.",
      inputSchema: ProfileInputStaticSchema,
      execute: execute("profile"),
    }),
    tool({
      name: "projects.list",
      description: "List local Supermemory projects/container tags.",
      inputSchema: ProjectsListInputStaticSchema,
      execute: execute("projects.list"),
    }),
  ];
}

export interface SupermemoryPluginExtension {
  readonly addIntegration: (input?: AddIntegrationInput) => Effect.Effect<void, StorageFailure>;
  readonly getIntegration: (
    slug?: string,
  ) => Effect.Effect<ExistingIntegration | null, StorageFailure>;
  readonly setupLocal: (input?: SetupLocalInput) => Effect.Effect<
    {
      readonly integration: string;
      readonly handoffUrl: string;
      readonly instructions: string;
    },
    StorageFailure
  >;
}

export const supermemoryPlugin = definePlugin((options: SupermemoryPluginOptions = {}) => ({
  id: "supermemory" as const,
  packageName: "executor-supermemory",
  storage: (): SupermemoryStore => ({}),
  extension: (ctx: PluginCtx<SupermemoryStore>): SupermemoryPluginExtension => {
    const addIntegration = (
      input: AddIntegrationInput = {},
    ): Effect.Effect<void, StorageFailure> => {
      const config = resolveSupermemoryIntegrationConfig(input, options, process.env);

      return ctx.core.integrations.register({
        slug: IntegrationSlug.make(input.slug ?? "supermemory"),
        description: input.description ?? "Supermemory memory API",
        config,
        canRemove: true,
        canRefresh: true,
      });
    };

    const getIntegration = (
      slug = "supermemory",
    ): Effect.Effect<ExistingIntegration | null, StorageFailure> =>
      ctx.core.integrations.get(IntegrationSlug.make(slug));

    return {
      addIntegration,
      getIntegration,
      setupLocal: (input: SetupLocalInput = {}) =>
        Effect.gen(function* () {
          const integration = {
            slug: input.slug ?? "supermemory",
            baseURL: input.baseURL ?? options.baseURL ?? localBaseURL,
            defaultContainerTag: input.defaultContainerTag ?? options.defaultContainerTag,
          };
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
  staticSources: (self: SupermemoryPluginExtension) => {
    const localConfig = resolveSupermemoryIntegrationConfig({}, options, process.env);
    const localTools = isLocalSupermemoryBaseURL(localConfig.baseURL)
      ? localSupermemoryTools(localConfig)
      : [];

    return [
      {
        id: "supermemory",
        kind: "executor",
        name: "Supermemory",
        url: "https://supermemory.ai",
        tools: [
          tool({
            name: "setupLocal",
            description:
              "Register a local Supermemory integration and return the browser URL for adding its API key.",
            inputSchema: setupLocalInputSchema,
            outputSchema: setupLocalOutputSchema,
            execute: (input: SetupLocalInput) => self.setupLocal(input),
          }),
          ...localTools,
        ],
      },
    ];
  },
  integrationPresets: [
    {
      id: "supermemory",
      name: "Supermemory",
      summary: "Hosted or local Supermemory memory API",
      url: "https://supermemory.ai",
      endpoint: hostedBaseURL,
      icon: supermemoryIconUrl,
      featured: true,
      transport: "remote" as const,
    },
  ],
  describeAuthMethods: () => [cloudApiKeyAuthMethod, localNoAuthMethod, localApiKeyAuthMethod],
  describeIntegrationDisplay: (integration: { readonly config: unknown }) => {
    const config = integration.config as SupermemoryIntegrationConfig;
    return { url: "https://supermemory.ai", icon: supermemoryIconUrl, endpoint: config.baseURL };
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
      const apiKey = credential.value?.trim();
      const baseURL = supermemoryBaseURLForTemplate({
        template: credential.template,
        configBaseURL: config.baseURL,
      });
      const allowLocalNoAuth =
        (String(credential.template) === String(localNoAuthTemplate) ||
          String(credential.template) === String(noAuthTemplate)) &&
        isLocalSupermemoryBaseURL(baseURL);
      if ((apiKey == null || apiKey.length === 0) && !allowLocalNoAuth) {
        return ToolResult.fail({
          code: "supermemory_missing_api_key",
          message:
            "The Supermemory connection did not resolve an API key. Reconnect this integration with a hosted Supermemory key, or use local no-auth only with a localhost Supermemory server. No request was sent.",
        });
      }

      return yield* invokeSupermemoryTool({
        ctx,
        toolName: String(toolRow.name),
        args,
        config: { ...config, baseURL },
        ...(apiKey == null || apiKey.length === 0 ? {} : { apiKey }),
      });
    }),
}));

export default supermemoryPlugin;
