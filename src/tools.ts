import { Schema, ToolName } from "@executor-js/sdk/core";
import type { ToolDef } from "@executor-js/sdk/core";

const Metadata = Schema.Record(
  Schema.String,
  Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Array(Schema.String)]),
);

const SearchMode = Schema.Literals(["hybrid", "memories", "documents"]);

export const SaveMemoryInput = Schema.Struct({
  content: Schema.String,
  containerTag: Schema.optional(Schema.String),
  customId: Schema.optional(Schema.String),
  metadata: Schema.optional(Metadata),
  taskType: Schema.optional(Schema.Literals(["memory", "superrag"])),
});
export type SaveMemoryInput = typeof SaveMemoryInput.Type;

export const ForgetMemoryInput = Schema.Struct({
  containerTag: Schema.optional(Schema.String),
  id: Schema.optional(Schema.String),
  content: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
});
export type ForgetMemoryInput = typeof ForgetMemoryInput.Type;

export const RecallInput = Schema.Struct({
  query: Schema.String,
  containerTag: Schema.optional(Schema.String),
  includeProfile: Schema.optional(Schema.Boolean),
  limit: Schema.optional(Schema.Number),
  threshold: Schema.optional(Schema.Number),
  searchMode: Schema.optional(SearchMode),
});
export type RecallInput = typeof RecallInput.Type;

export const ProfileInput = Schema.Struct({
  containerTag: Schema.optional(Schema.String),
  query: Schema.optional(Schema.String),
  threshold: Schema.optional(Schema.Number),
});
export type ProfileInput = typeof ProfileInput.Type;

export const ProjectsListInput = Schema.Struct({});
export type ProjectsListInput = typeof ProjectsListInput.Type;

export const toolDefinitions = [
  {
    name: ToolName.make("memory.save"),
    description:
      "Save memory-worthy user information, preferences, facts, project context, links, or notes to Supermemory.",
    annotations: {
      requiresApproval: true,
      approvalDescription: "Save information to Supermemory",
    },
    inputSchema: Schema.toStandardJSONSchemaV1(SaveMemoryInput),
  },
  {
    name: ToolName.make("memory.forget"),
    description:
      "Forget a specific memory by id or exact content match when information is outdated or the user requests removal.",
    annotations: {
      requiresApproval: true,
      approvalDescription: "Forget a Supermemory memory",
    },
    inputSchema: Schema.toStandardJSONSchemaV1(ForgetMemoryInput),
  },
  {
    name: ToolName.make("recall"),
    description:
      "Search Supermemory for relevant memories. By default, also returns profile context for the query.",
    inputSchema: Schema.toStandardJSONSchemaV1(RecallInput),
  },
  {
    name: ToolName.make("profile"),
    description:
      "Fetch the Supermemory profile for a container tag, optionally with query results.",
    inputSchema: Schema.toStandardJSONSchemaV1(ProfileInput),
  },
  {
    name: ToolName.make("projects.list"),
    description: "List Supermemory projects/container tags available to this connection.",
    inputSchema: Schema.toStandardJSONSchemaV1(ProjectsListInput),
  },
] as const satisfies readonly ToolDef[];
