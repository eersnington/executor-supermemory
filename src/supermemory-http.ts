import { Effect, Layer, ToolResult, isToolResult } from "@executor-js/sdk/core";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";

import type { SupermemoryRequestPlan } from "./tool-request.ts";

export function executeSupermemoryRequest(input: {
  readonly httpClientLayer: Layer.Layer<HttpClient.HttpClient>;
  readonly baseURL: string;
  readonly apiKey: string;
  readonly request: SupermemoryRequestPlan;
}) {
  return Effect.gen(function* () {
    const client = yield* Effect.service(HttpClient.HttpClient).pipe(
      Effect.provide(input.httpClientLayer),
    );
    let request = HttpClientRequest.make(input.request.method)(
      `${input.baseURL.replace(/\/+$/, "")}${input.request.path}`,
    ).pipe(
      HttpClientRequest.setHeaders({
        Authorization: `Bearer ${input.apiKey}`,
        "x-sm-source": "executor-supermemory",
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }

    if (response.status < 200 || response.status >= 300) {
      let message = `Supermemory returned HTTP ${response.status}. Check the request, credentials, and Supermemory server logs before retrying.`;
      if (parsed != null && typeof parsed === "object") {
        const error = (parsed as Record<string, unknown>).error;
        const parsedMessage = (parsed as Record<string, unknown>).message;
        const details = (parsed as Record<string, unknown>).details;
        if (typeof error === "string") message = error;
        if (typeof parsedMessage === "string") message = parsedMessage;
        if (typeof details === "string") message = `${message}: ${details}`;
      } else if (typeof parsed === "string" && parsed.length > 0) {
        message = parsed;
      }
      return ToolResult.fail({
        code: "supermemory_http_error",
        status: response.status,
        message,
        details: parsed,
      });
    }

    if (typeof parsed === "string") {
      return ToolResult.fail({
        code: "supermemory_invalid_response",
        status: response.status,
        message:
          "Supermemory returned a successful response that was not valid JSON. The request may have succeeded, but the plugin could not parse the result.",
        details: parsed,
      });
    }

    return ToolResult.ok(parsed);
  });
}
