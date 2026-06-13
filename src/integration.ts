import { AuthTemplateSlug } from "@executor-js/sdk/core";

export { supermemoryIconUrl } from "./icon.ts";

export const hostedBaseURL = "https://api.supermemory.ai";
export const localBaseURL = "http://localhost:6767";
export const cloudApiKeyTemplate = AuthTemplateSlug.make("cloud-api-key");
export const localApiKeyTemplate = AuthTemplateSlug.make("local-api-key");
export const localNoAuthTemplate = AuthTemplateSlug.make("local-none");
export const apiKeyTemplate = AuthTemplateSlug.make("api-key");
export const noAuthTemplate = AuthTemplateSlug.make("none");

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

export function supermemoryBaseURLForTemplate(input: {
  readonly template: unknown;
  readonly configBaseURL: string;
}): string {
  const template = String(input.template);
  if (template === String(cloudApiKeyTemplate)) return hostedBaseURL;
  if (template === String(localApiKeyTemplate) || template === String(localNoAuthTemplate)) {
    return localBaseURL;
  }
  return input.configBaseURL;
}

const nonEmpty = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed == null || trimmed.length === 0 ? undefined : trimmed;
};

export function resolveSupermemoryIntegrationConfig(
  input: AddIntegrationInput,
  options: SupermemoryPluginOptions,
  env: NodeJS.ProcessEnv,
): SupermemoryIntegrationConfig {
  const baseURL = (
    nonEmpty(input.baseURL) ??
    nonEmpty(options.baseURL) ??
    nonEmpty(env.SUPERMEMORY_API_URL) ??
    nonEmpty(env.SUPERMEMORY_BASE_URL) ??
    hostedBaseURL
  ).replace(/\/+$/, "");
  const defaultContainerTag =
    nonEmpty(input.defaultContainerTag) ?? nonEmpty(options.defaultContainerTag);

  return {
    kind: "supermemory",
    baseURL,
    ...(defaultContainerTag == null ? {} : { defaultContainerTag }),
    defaults: {
      searchMode: input.defaults?.searchMode ?? options.defaultSearchMode ?? "hybrid",
      limit: input.defaults?.limit ?? options.defaultLimit ?? 10,
      threshold: input.defaults?.threshold ?? options.defaultThreshold ?? 0.6,
    },
  };
}

export function isLocalSupermemoryBaseURL(baseURL: string): boolean {
  const normalized = baseURL.trim();
  if (!URL.canParse(normalized)) return false;
  const url = new URL(normalized);
  return (
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1")
  );
}
