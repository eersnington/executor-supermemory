# executor-supermemory

Executor plugin for Supermemory hosted and local APIs.

## Install

```bash
bun add executor-supermemory
```

## Supermemory Local

```bash
npx supermemory local
# or run
supermemory-server
```

Use the printed API key and `http://localhost:6767`.

## Configure Plugin

```ts
import { supermemoryHttpPlugin } from "executor-supermemory/api";

supermemoryHttpPlugin({
  defaultContainerTag: "project_alpha",
});
```

Set `baseURL: "http://localhost:6767"` only when you also want static local no-auth tools available outside the Connect flow.

## Connect

Open Executor, choose **Connect integration**, then pick **Supermemory**. Add one of these connection types:

- `Cloud API key` for hosted Supermemory.
- `Local no auth` for the local server at `http://localhost:6767`.
- `Local API key` for the local server with its printed API key.

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

## Local Development With Executor Source

When running Executor from source, install this package into the Executor repo and add `supermemoryHttpPlugin(...)` to `apps/local/executor.config.ts`.
