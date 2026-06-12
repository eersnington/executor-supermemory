# executor-supermemory

Executor plugin for Supermemory hosted and local APIs.

## Install

```bash
bun add executor-supermemory
```

## Supermemory Local

```bash
npx supermemory local
```

Use the printed API key and `http://localhost:6767`.

## Configure Plugin

```ts
import { supermemoryPlugin } from "executor-supermemory";

supermemoryPlugin({
  baseURL: "http://localhost:6767",
  defaultContainerTag: "project_alpha",
});
```

## Register Connection

```ts
await executor.supermemory.addIntegration({
  slug: "supermemory",
  baseURL: "http://localhost:6767",
  defaultContainerTag: "project_alpha",
});

await executor.connections.create({
  owner: "org",
  name: "main",
  integration: "supermemory",
  template: "api-key",
  value: process.env.SUPERMEMORY_API_KEY!,
});
```

API keys are stored in Executor connections, not plugin options.

## Tools

Tools are resolved per Executor connection:

| Tool name       | Address example                            | Purpose                                                |
| --------------- | ------------------------------------------ | ------------------------------------------------------ |
| `memory.save`   | `tools.supermemory.org.main.memory.save`   | Save memory-worthy content through `/v3/documents`.    |
| `memory.forget` | `tools.supermemory.org.main.memory.forget` | Forget a memory through `DELETE /v4/memories`.         |
| `recall`        | `tools.supermemory.org.main.recall`        | Recall profile-backed context, or search `/v4/search`. |
| `profile`       | `tools.supermemory.org.main.profile`       | Fetch profile context through `/v4/profile`.           |
| `projects.list` | `tools.supermemory.org.main.projects.list` | List projects/container tags through `/v3/projects`.   |

Write and destructive tools require Executor approval. API keys are read from the Executor connection credential and are never stored in plugin options.

## Examples

Search project memory:

```ts
import { ToolAddress } from "@executor-js/sdk";

await executor.execute(ToolAddress.make("tools.supermemory.org.main.recall"), {
  query: "deployment errors",
});
```

## Local Development With Executor Source

When running Executor from source, install this package into the Executor repo and add `supermemoryPlugin(...)` to `apps/local/executor.config.ts`.
