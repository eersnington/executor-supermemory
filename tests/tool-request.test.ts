import { expect, test } from "@voidzero-dev/vite-plus-test";

import type { SupermemoryIntegrationConfig } from "../src/integration.ts";
import { planSupermemoryRequest } from "../src/tool-request.ts";

const config = {
  kind: "supermemory",
  baseURL: "http://localhost:6767",
  defaultContainerTag: "project_alpha",
  defaults: { searchMode: "hybrid", limit: 5, threshold: 0.6 },
} as const satisfies SupermemoryIntegrationConfig;

test("plans memory.save with default container and optional fields", () => {
  expect(
    planSupermemoryRequest({
      toolName: "memory.save",
      args: {
        content: "Save this",
        customId: "doc_1",
        metadata: { type: "note" },
        taskType: "memory",
      },
      config,
    }),
  ).toEqual({
    ok: true,
    data: {
      method: "POST",
      path: "/v3/documents",
      body: {
        content: "Save this",
        containerTag: "project_alpha",
        customId: "doc_1",
        metadata: { type: "note" },
        taskType: "memory",
      },
    },
  });
});

test("memory.forget requires an id or content", () => {
  expect(
    planSupermemoryRequest({
      toolName: "memory.forget",
      args: {},
      config,
    }),
  ).toMatchObject({ ok: false, error: { code: "supermemory_missing_memory_identifier" } });
});

test("recall defaults to profile-backed context", () => {
  expect(
    planSupermemoryRequest({
      toolName: "recall",
      args: { query: "deploy errors" },
      config,
    }),
  ).toEqual({
    ok: true,
    data: {
      method: "POST",
      path: "/v4/profile",
      body: { containerTag: "project_alpha", q: "deploy errors" },
    },
  });
});

test("recall can search without profile context", () => {
  expect(
    planSupermemoryRequest({
      toolName: "recall",
      args: { query: "deploy errors", includeProfile: false },
      config,
    }),
  ).toEqual({
    ok: true,
    data: {
      method: "POST",
      path: "/v4/search",
      body: {
        q: "deploy errors",
        containerTag: "project_alpha",
        searchMode: "hybrid",
        limit: 5,
        threshold: 0.6,
      },
    },
  });
});

test("profile maps query to q", () => {
  expect(
    planSupermemoryRequest({
      toolName: "profile",
      args: { query: "coding preferences" },
      config,
    }),
  ).toEqual({
    ok: true,
    data: {
      method: "POST",
      path: "/v4/profile",
      body: { containerTag: "project_alpha", q: "coding preferences" },
    },
  });
});

test("projects.list uses v3 projects without a body", () => {
  expect(
    planSupermemoryRequest({
      toolName: "projects.list",
      args: {},
      config,
    }),
  ).toEqual({ ok: true, data: { method: "GET", path: "/v3/projects" } });
});

test("missing container tag returns a structured failure", () => {
  expect(
    planSupermemoryRequest({
      toolName: "memory.save",
      args: { content: "Save this" },
      config: { ...config, defaultContainerTag: undefined },
    }),
  ).toMatchObject({ ok: false, error: { code: "supermemory_missing_container_tag" } });
});

test("unknown tool returns a structured failure", () => {
  expect(
    planSupermemoryRequest({
      toolName: "memory.nope",
      args: {},
      config,
    }),
  ).toMatchObject({ ok: false, error: { code: "supermemory_unknown_tool" } });
});
