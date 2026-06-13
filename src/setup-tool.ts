import { Schema } from "@executor-js/sdk/core";

import { localApiKeyTemplate } from "./integration.ts";

const SetupLocalInputSchema = Schema.Struct({
  slug: Schema.optional(Schema.String),
  baseURL: Schema.optional(Schema.String),
  defaultContainerTag: Schema.optional(Schema.String),
  owner: Schema.optional(Schema.Literals(["org", "user"])),
  label: Schema.optional(Schema.String),
});

const SetupLocalOutputSchema = Schema.Struct({
  integration: Schema.String,
  handoffUrl: Schema.String,
  instructions: Schema.String,
});

export const setupLocalInputSchema = Schema.toStandardSchemaV1(
  Schema.toStandardJSONSchemaV1(SetupLocalInputSchema),
);
export const setupLocalOutputSchema = Schema.toStandardSchemaV1(
  Schema.toStandardJSONSchemaV1(SetupLocalOutputSchema),
);

export function connectionHandoffUrl(input: {
  readonly webBaseUrl?: string;
  readonly integration: string;
  readonly owner?: "org" | "user";
  readonly label?: string;
}) {
  const search = new URLSearchParams({ addAccount: "1" });
  search.set("owner", input.owner ?? "org");
  search.set("template", String(localApiKeyTemplate));
  search.set("label", input.label ?? "Local Supermemory");
  const path = `/integrations/${encodeURIComponent(input.integration)}?${search.toString()}`;

  if (input.webBaseUrl == null || input.webBaseUrl.length === 0) return path;
  return new URL(
    path,
    input.webBaseUrl.endsWith("/") ? input.webBaseUrl : `${input.webBaseUrl}/`,
  ).toString();
}

export function setupLocalInstructions(input: { readonly handoffUrl: string }) {
  return `Open ${input.handoffUrl} and paste the API key printed by your local Supermemory server.`;
}
