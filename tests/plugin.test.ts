import {
  AuthTemplateSlug,
  ConnectionName,
  Effect,
  IntegrationSlug,
  Layer,
  ToolName,
} from "@executor-js/sdk/core";
import type { Owner } from "@executor-js/sdk/core";
import { HttpBody, HttpClient, HttpClientResponse } from "effect/unstable/http";
import { expect, test } from "@voidzero-dev/vite-plus-test";

import { supermemoryPlugin } from "../src/index.ts";

interface CapturedRequest {
  readonly method: string;
  readonly url: string;
  readonly body: unknown;
  readonly authorization: string | undefined;
}

const config = {
  kind: "supermemory",
  baseURL: "http://localhost:6767",
  defaultContainerTag: "project_alpha",
  defaults: { searchMode: "hybrid", limit: 5, threshold: 0.6 },
} as const;

const owner = "org" as Owner;

const staticSourcesFor = (plugin: ReturnType<typeof supermemoryPlugin>) =>
  plugin.staticSources!({ setupLocal: () => Effect.succeed(null) } as never);

test("supermemory exposes a local setup tool for Executor CLI users", () => {
  const plugin = supermemoryPlugin();
  const sources = staticSourcesFor(plugin);

  expect(sources).toHaveLength(1);
  expect(sources[0]).toMatchObject({ id: "supermemory", kind: "executor", name: "Supermemory" });
  expect(sources[0]?.tools.map((tool: { readonly name: string }) => tool.name)).toEqual([
    "setupLocal",
  ]);
});

test("local Supermemory options expose static no-auth memory tools", () => {
  const plugin = supermemoryPlugin({
    baseURL: "http://localhost:6767",
    defaultContainerTag: "project_alpha",
  });
  const sources = staticSourcesFor(plugin);

  expect(sources[0]?.tools.map((tool: { readonly name: string }) => tool.name).sort()).toEqual([
    "memory.forget",
    "memory.save",
    "profile",
    "projects.list",
    "recall",
    "setupLocal",
  ]);
});

test("setupLocal registers a local Supermemory integration and returns handoff URL", async () => {
  const registered: unknown[] = [];
  const plugin = supermemoryPlugin({ defaultContainerTag: "project_alpha" });
  const extension = plugin.extension!({
    core: {
      integrations: {
        register: (input: unknown) =>
          Effect.sync(() => {
            registered.push(input);
          }),
      },
    },
  } as never);

  const result = await Effect.runPromise(
    extension.setupLocal({ label: "Local Supermemory" }) as Effect.Effect<unknown>,
  );

  expect(registered).toEqual([
    {
      slug: IntegrationSlug.make("supermemory"),
      description: "Supermemory memory API",
      config: {
        kind: "supermemory",
        baseURL: "http://localhost:6767",
        defaultContainerTag: "project_alpha",
        defaults: { searchMode: "hybrid", limit: 10, threshold: 0.6 },
      },
      canRemove: true,
      canRefresh: true,
    },
  ]);
  expect(result).toEqual({
    integration: "supermemory",
    handoffUrl:
      "/integrations/supermemory?addAccount=1&owner=org&template=local-api-key&label=Local+Supermemory",
    instructions:
      "Open /integrations/supermemory?addAccount=1&owner=org&template=local-api-key&label=Local+Supermemory and paste the API key printed by your local Supermemory server.",
  });
});

test("supermemory connection resolves focused dynamic tools", async () => {
  const plugin = supermemoryPlugin();
  const resolved = await Effect.runPromise(
    plugin.resolveTools!({ config } as never) as Effect.Effect<{
      readonly tools: readonly { readonly name: string }[];
    }>,
  );

  expect(resolved.tools.map((tool) => String(tool.name)).sort()).toEqual([
    "memory.forget",
    "memory.save",
    "profile",
    "projects.list",
    "recall",
  ]);
});

test("memory.save posts a document to Supermemory v3", async () => {
  const requests: CapturedRequest[] = [];
  const result = await invoke(
    "memory.save",
    { content: "This project packages with vp pack.", metadata: { type: "project-config" } },
    requests,
  );

  expect(result).toEqual({ ok: true, data: { id: "doc_1", status: "queued" } });
  expect(requests).toEqual([
    {
      method: "POST",
      url: "http://localhost:6767/v3/documents",
      authorization: "Bearer sm_test",
      body: {
        content: "This project packages with vp pack.",
        containerTag: "project_alpha",
        metadata: { type: "project-config" },
      },
    },
  ]);
});

test("memory.forget uses documented DELETE v4 memories body", async () => {
  const requests: CapturedRequest[] = [];
  const result = await invoke("memory.forget", { id: "mem_1", reason: "outdated" }, requests);

  expect(result).toEqual({ ok: true, data: { id: "mem_1", forgotten: true } });
  expect(requests[0]).toEqual({
    method: "DELETE",
    url: "http://localhost:6767/v4/memories",
    authorization: "Bearer sm_test",
    body: { containerTag: "project_alpha", id: "mem_1", reason: "outdated" },
  });
});

test("recall defaults to profile-backed context", async () => {
  const requests: CapturedRequest[] = [];
  const result = await invoke("recall", { query: "deploy errors" }, requests);

  expect(result).toEqual({ ok: true, data: { profile: "Uses Vite+", results: [] } });
  expect(requests[0]).toEqual({
    method: "POST",
    url: "http://localhost:6767/v4/profile",
    authorization: "Bearer sm_test",
    body: { containerTag: "project_alpha", q: "deploy errors" },
  });
});

test("recall can search without profile context", async () => {
  const requests: CapturedRequest[] = [];
  const result = await invoke(
    "recall",
    { query: "deploy errors", includeProfile: false },
    requests,
    {
      status: 200,
      body: { results: [], timing: 1, total: 0 },
    },
  );

  expect(result).toEqual({ ok: true, data: { results: [], timing: 1, total: 0 } });
  expect(requests[0]).toEqual({
    method: "POST",
    url: "http://localhost:6767/v4/search",
    authorization: "Bearer sm_test",
    body: {
      q: "deploy errors",
      containerTag: "project_alpha",
      searchMode: "hybrid",
      limit: 5,
      threshold: 0.6,
    },
  });
});

test("profile posts to Supermemory v4 profile", async () => {
  const requests: CapturedRequest[] = [];
  const result = await invoke("profile", { query: "coding preferences" }, requests);

  expect(result).toEqual({ ok: true, data: { profile: "Uses Vite+", results: [] } });
  expect(requests[0]).toEqual({
    method: "POST",
    url: "http://localhost:6767/v4/profile",
    authorization: "Bearer sm_test",
    body: { containerTag: "project_alpha", q: "coding preferences" },
  });
});

test("projects.list gets Supermemory v3 projects", async () => {
  const requests: CapturedRequest[] = [];
  const result = await invoke("projects.list", {}, requests);

  expect(result).toEqual({ ok: true, data: { projects: [{ containerTag: "project_alpha" }] } });
  expect(requests[0]).toEqual({
    method: "GET",
    url: "http://localhost:6767/v3/projects",
    authorization: "Bearer sm_test",
    body: null,
  });
});

test("static local recall omits Authorization for localhost auto-auth", async () => {
  const requests: CapturedRequest[] = [];
  const plugin = supermemoryPlugin({
    baseURL: "http://localhost:6767",
    defaultContainerTag: "project_alpha",
  });
  const source = staticSourcesFor(plugin)[0]!;
  const recall = source.tools.find((tool: { readonly name: string }) => tool.name === "recall")!;

  const result = await Effect.runPromise(
    recall.handler({
      args: { query: "deploy errors" },
      ctx: { httpClientLayer: fakeHttpClient(requests, responseFor("recall")) } as never,
      elicit: (() => Effect.die("not used")) as never,
    }),
  );

  expect(result).toEqual({ ok: true, data: { profile: "Uses Vite+", results: [] } });
  expect(requests[0]).toEqual({
    method: "POST",
    url: "http://localhost:6767/v4/profile",
    authorization: undefined,
    body: { containerTag: "project_alpha", q: "deploy errors" },
  });
});

test("dynamic no-auth connection omits Authorization for local Supermemory", async () => {
  const requests: CapturedRequest[] = [];
  const result = await invoke(
    "recall",
    { query: "deploy errors" },
    requests,
    responseFor("recall"),
    {
      template: AuthTemplateSlug.make("local-none"),
      value: null,
      values: {},
    },
  );

  expect(result).toEqual({ ok: true, data: { profile: "Uses Vite+", results: [] } });
  expect(requests[0]?.authorization).toBe(undefined);
});

test("cloud API key connections call hosted Supermemory", async () => {
  const requests: CapturedRequest[] = [];
  await invoke("projects.list", {}, requests, responseFor("projects.list"), {
    template: AuthTemplateSlug.make("cloud-api-key"),
  });

  expect(requests[0]?.url).toBe("https://api.supermemory.ai/v3/projects");
  expect(requests[0]?.authorization).toBe("Bearer sm_test");
});

test("local API key connections call local Supermemory", async () => {
  const requests: CapturedRequest[] = [];
  await invoke("projects.list", {}, requests, responseFor("projects.list"), {
    template: AuthTemplateSlug.make("local-api-key"),
  });

  expect(requests[0]?.url).toBe("http://localhost:6767/v3/projects");
  expect(requests[0]?.authorization).toBe("Bearer sm_test");
});

test("non-2xx text response returns a structured http error", async () => {
  const requests: CapturedRequest[] = [];
  const result = await invoke("recall", { query: "deploy errors" }, requests, {
    status: 401,
    body: "invalid api key",
  });

  expect(result).toEqual({
    ok: false,
    error: {
      code: "supermemory_http_error",
      status: 401,
      message: "invalid api key",
      details: "invalid api key",
    },
  });
});

async function invoke(
  toolName: string,
  args: unknown,
  requests: CapturedRequest[],
  response: { readonly status: number; readonly body: unknown } = responseFor(toolName),
  credentialOverrides: Partial<{
    readonly template: AuthTemplateSlug;
    readonly value: string | null;
    readonly values: Record<string, string | null>;
  }> = {},
) {
  const plugin = supermemoryPlugin();
  return await Effect.runPromise(
    plugin.invokeTool!({
      ctx: { httpClientLayer: fakeHttpClient(requests, response) } as never,
      toolRow: { name: ToolName.make(toolName) } as never,
      credential: {
        owner,
        integration: IntegrationSlug.make("supermemory"),
        connection: ConnectionName.make("main"),
        template: AuthTemplateSlug.make("api-key"),
        value: "sm_test",
        values: { token: "sm_test" },
        config,
        ...credentialOverrides,
      },
      args,
      elicit: (() => Effect.die("not used")) as never,
    }),
  );
}

function fakeHttpClient(
  requests: CapturedRequest[],
  response: { readonly status: number; readonly body: unknown },
) {
  const client = HttpClient.make((request) => {
    requests.push({
      method: request.method,
      url: request.url,
      authorization: request.headers.authorization,
      body: requestBody(request.body),
    });

    return Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        new Response(
          typeof response.body === "string" ? response.body : JSON.stringify(response.body),
          { status: response.status },
        ),
      ),
    );
  });

  return Layer.succeed(HttpClient.HttpClient, client);
}

function requestBody(body: HttpBody.HttpBody) {
  if (body._tag === "Empty") return null;
  if (body._tag === "Uint8Array") return JSON.parse(new TextDecoder().decode(body.body));
  if (body._tag === "Raw" && typeof body.body === "string") return JSON.parse(body.body);
  return body;
}

function responseFor(toolName: string) {
  switch (toolName) {
    case "memory.save":
      return { status: 200, body: { id: "doc_1", status: "queued" } };
    case "memory.forget":
      return { status: 200, body: { id: "mem_1", forgotten: true } };
    case "recall":
      return { status: 200, body: { profile: "Uses Vite+", results: [] } };
    case "profile":
      return { status: 200, body: { profile: "Uses Vite+", results: [] } };
    case "projects.list":
      return { status: 200, body: { projects: [{ containerTag: "project_alpha" }] } };
    default:
      return { status: 200, body: null };
  }
}
