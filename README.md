# executor-supermemory

Executor plugin for [Supermemory](https://supermemory.ai), including hosted and local/self-hosted Supermemory.

## Configure Executor

Add the plugin to `executor.config.ts`:

```ts
import { defineExecutorConfig } from "@executor-js/sdk";
import { supermemoryPlugin } from "executor-supermemory";

export default defineExecutorConfig({
  plugins: () =>
    [
      supermemoryPlugin({
        baseURL: process.env.SUPERMEMORY_API_URL,
        defaultContainerTag: process.env.SUPERMEMORY_CONTAINER_TAG,
      }),
    ] as const,
});
```

API keys are stored in Executor connections, not in plugin options.

## Add Integration

Register the Supermemory integration, then create a connection with a hosted or local API key:

```ts
import { AuthTemplateSlug, ConnectionName, IntegrationSlug } from "@executor-js/sdk";

await executor.supermemory.addIntegration({
  slug: "supermemory",
  baseURL: "https://api.supermemory.ai",
  defaultContainerTag: "project_alpha",
});

await executor.connections.create({
  owner: "org",
  name: ConnectionName.make("main"),
  integration: IntegrationSlug.make("supermemory"),
  template: AuthTemplateSlug.make("api-key"),
  value: process.env.SUPERMEMORY_API_KEY!,
});
```

For local Supermemory, use the local server URL:

```ts
await executor.supermemory.addIntegration({
  slug: "supermemory-local",
  baseURL: "http://localhost:6767",
  defaultContainerTag: "project_alpha",
});
```

## Local Setup

Run Supermemory local:

```bash
npx supermemory local
```

Or run the installed server directly:

```bash
supermemory-server
```

First boot prints a local API key. Store that key in the Executor connection.

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

Add memory to a configured project container:

```ts
await executor.execute(ToolAddress.make("tools.supermemory.org.main.memory.save"), {
  content: "This project packages with vp pack before release.",
  metadata: { type: "project-config" },
});
```

Override the configured container per call:

```ts
await executor.execute(ToolAddress.make("tools.supermemory.org.main.profile"), {
  containerTag: "user_alpha",
  query: "coding preferences",
});
```
