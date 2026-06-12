import { AuthTemplateSlug } from "@executor-js/sdk/core";

export const hostedBaseURL = "https://api.supermemory.ai";
export const localBaseURL = "http://localhost:6767";
export const apiKeyTemplate = AuthTemplateSlug.make("api-key");

export interface SupermemoryPluginOptions {
  readonly baseURL?: string;
  readonly defaultContainerTag?: string;
  readonly defaultSearchMode?: "hybrid" | "memories" | "documents";
  readonly defaultLimit?: number;
  readonly defaultThreshold?: number;
}

export interface AddIntegrationInput {
  readonly slug?: string;
  readonly description?: string;
  readonly baseURL?: string;
  readonly defaultContainerTag?: string;
  readonly defaults?: {
    readonly searchMode?: "hybrid" | "memories" | "documents";
    readonly limit?: number;
    readonly threshold?: number;
  };
}

export interface SetupLocalInput {
  readonly slug?: string;
  readonly baseURL?: string;
  readonly defaultContainerTag?: string;
  readonly owner?: "org" | "user";
  readonly label?: string;
}

export interface SupermemoryIntegrationConfig {
  readonly kind: "supermemory";
  readonly baseURL: string;
  readonly defaultContainerTag?: string;
  readonly defaults: {
    readonly searchMode: "hybrid" | "memories" | "documents";
    readonly limit: number;
    readonly threshold: number;
  };
}

export function resolveSupermemoryIntegrationConfig(
  input: AddIntegrationInput,
  options: SupermemoryPluginOptions,
  env: NodeJS.ProcessEnv,
): SupermemoryIntegrationConfig {
  const envApiURL = env.SUPERMEMORY_API_URL;
  const envBaseURL = env.SUPERMEMORY_BASE_URL;
  const baseURL = (
    input.baseURL ??
    options.baseURL ??
    (envApiURL == null || envApiURL.trim().length === 0 ? undefined : envApiURL) ??
    (envBaseURL == null || envBaseURL.trim().length === 0 ? undefined : envBaseURL) ??
    hostedBaseURL
  ).replace(/\/+$/, "");
  const defaultContainerTag = input.defaultContainerTag ?? options.defaultContainerTag;

  return {
    kind: "supermemory",
    baseURL,
    ...(defaultContainerTag == null || defaultContainerTag.trim().length === 0
      ? {}
      : { defaultContainerTag }),
    defaults: {
      searchMode: input.defaults?.searchMode ?? options.defaultSearchMode ?? "hybrid",
      limit: input.defaults?.limit ?? options.defaultLimit ?? 10,
      threshold: input.defaults?.threshold ?? options.defaultThreshold ?? 0.6,
    },
  };
}
