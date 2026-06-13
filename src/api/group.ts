import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { IntegrationAlreadyExistsError, InternalError } from "@executor-js/sdk/shared";

const IntegrationParams = {
  slug: Schema.String,
};

const AddIntegrationPayload = Schema.Struct({
  baseURL: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  defaultContainerTag: Schema.optional(Schema.String),
  defaults: Schema.optional(
    Schema.Struct({
      searchMode: Schema.optional(Schema.Literals(["hybrid", "memories", "documents"])),
      limit: Schema.optional(Schema.Number),
      threshold: Schema.optional(Schema.Number),
    }),
  ),
});

const AddIntegrationResponse = Schema.Struct({
  slug: Schema.String,
  name: Schema.String,
});

const SupermemoryErrors = [InternalError, IntegrationAlreadyExistsError] as const;

export const SupermemoryGroup = HttpApiGroup.make("supermemory")
  .add(
    HttpApiEndpoint.post("addIntegration", "/supermemory/integrations", {
      payload: AddIntegrationPayload,
      success: AddIntegrationResponse,
      error: SupermemoryErrors,
    }),
  )
  .add(
    HttpApiEndpoint.get("getIntegration", "/supermemory/integrations/:slug", {
      params: IntegrationParams,
      success: Schema.NullOr(Schema.Unknown),
      error: SupermemoryErrors,
    }),
  );
