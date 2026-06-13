import { Effect, Layer, ToolResult, isToolResult } from "@executor-js/sdk/core";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import type { SupermemoryRequestPlan } from "./tool-request.ts";

export function executeSupermemoryRequest(input: {
  readonly httpClientLayer: Layer.Layer<HttpClient.HttpClient>;
  readonly baseURL: string;
  readonly apiKey?: string;
  readonly request: SupermemoryRequestPlan;
}) {
  return Effect.gen(function* () {
    const apiKey = input.apiKey?.trim();
    const client = yield* Effect.service(HttpClient.HttpClient).pipe(
      Effect.provide(input.httpClientLayer),
    );
    let request = HttpClientRequest.make(input.request.method)(
      `${input.baseURL.replace(/\/+$/, "")}${input.request.path}`,
    ).pipe(
      HttpClientRequest.setHeaders({
        "x-sm-source": "executor-supermemory",
        ...(apiKey == null || apiKey.length === 0 ? {} : { Authorization: `Bearer ${apiKey}` }),
      }),
    );
    if (input.request.body !== undefined) {
      request = HttpClientRequest.bodyJsonUnsafe(request, input.request.body);
    }

    const response = yield* client.execute(request).pipe(
      Effect.catch((details) =>
        Effect.succeed(
          ToolResult.fail({
            code: "supermemory_network_error",
            message:
              "Supermemory request failed before a response was received. Check that the server is reachable and retry.",
            details,
          }),
        ),
      ),
    );
    if (isToolResult(response)) return response;

    const text = yield* response.text.pipe(
      Effect.catch((details) =>
        Effect.succeed(
          ToolResult.fail({
            code: "supermemory_invalid_response",
            message:
              "Supermemory returned a response body that could not be read. The request may have succeeded, but the plugin could not parse the result.",
            status: response.status,
            details,
          }),
        ),
      ),
    );
    if (isToolResult(text)) return text;

    if (text.length === 0) {
      if (response.status >= 200 && response.status < 300) return ToolResult.ok(null);
      return ToolResult.fail({
        code: "supermemory_http_error",
        status: response.status,
        message: `Supermemory returned HTTP ${response.status}. Check the request, credentials, and Supermemory server logs before retrying.`,
      });
    }

    if (response.status < 200 || response.status >= 300) {
      const message = `Supermemory returned HTTP ${response.status}. Check the request, credentials, and Supermemory server logs before retrying.`;
      return ToolResult.fail({
        code: "supermemory_http_error",
        status: response.status,
        message: text.length === 0 ? message : text,
        ...(text.length === 0 ? {} : { details: text }),
      });
    }

    return yield* Effect.try({
      try: () => JSON.parse(text) as unknown,
      catch: () => undefined,
    }).pipe(
      Effect.match({
        onFailure: () =>
          ToolResult.fail({
            code: "supermemory_invalid_response",
            status: response.status,
            message:
              "Supermemory returned a successful response that was not valid JSON. The request may have succeeded, but the plugin could not parse the result.",
            details: text,
          }),
        onSuccess: (parsed) => ToolResult.ok(parsed),
      }),
    );
  });
}
