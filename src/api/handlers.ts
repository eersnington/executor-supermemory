import { randomUUID } from "node:crypto";
import {
  Context,
  Effect,
  HttpApi,
  HttpApiBuilder,
  IntegrationAlreadyExistsError,
  IntegrationSlug,
  InternalError,
  isStorageFailure,
} from "@executor-js/sdk/core";

import type { SupermemoryPluginExtension } from "../plugin.ts";
import { SupermemoryGroup } from "./group.ts";

export class SupermemoryExtensionService extends Context.Service<
  SupermemoryExtensionService,
  SupermemoryPluginExtension
>()("SupermemoryExtensionService") {}

const SupermemoryApi = HttpApi.make("supermemory").add(SupermemoryGroup);

const failInternal = Effect.fnUntraced(function* (operation: string, cause: unknown) {
  const traceId = randomUUID();
  yield* Effect.logError(`Supermemory ${operation} failed`, cause).pipe(
    Effect.annotateLogs({ operation, traceId }),
  );
  return yield* new InternalError({ traceId });
});

const internalizeStorage = <A, E, R>(operation: string, effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.catchIf(isStorageFailure, (cause) => failInternal(operation, cause)));

export const SupermemoryHandlers = HttpApiBuilder.group(SupermemoryApi, "supermemory", (handlers) =>
  handlers
    .handle("addIntegration", ({ payload }) =>
      Effect.gen(function* () {
        const ext = yield* SupermemoryExtensionService;
        const slug = IntegrationSlug.make(payload.slug ?? "supermemory");
        const existing = yield* internalizeStorage(
          "get integration before add",
          ext.getIntegration(String(slug)),
        );
        if (existing) {
          return yield* new IntegrationAlreadyExistsError({ slug });
        }

        yield* internalizeStorage(
          "add integration",
          ext.addIntegration({
            slug: String(slug),
            description: payload.name,
            baseURL: payload.baseURL,
            defaultContainerTag: payload.defaultContainerTag,
            defaults: payload.defaults,
          }),
        );

        return { slug: String(slug), name: payload.name?.trim() || "Supermemory" };
      }),
    )
    .handle("getIntegration", ({ params }) =>
      Effect.gen(function* () {
        const ext = yield* SupermemoryExtensionService;
        return yield* internalizeStorage("get integration", ext.getIntegration(params.slug));
      }),
    ),
);
