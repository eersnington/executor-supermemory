# executor-supermemory

Executor plugin for [Supermemory](https://supermemory.ai), including hosted and local/self-hosted Supermemory.

## Local Supermemory

Setup Supermemory local:

```bash
npx supermemory local
```

Or run the installed server directly:

```bash
supermemory-server
```

First boot prints a local API key. The local API runs at `http://localhost:6767`.

## Programmatic Executor Usage

Add the plugin when creating an Executor:

```ts
import { createExecutor } from "@executor-js/sdk";
import { fileSecretsPlugin } from "@executor-js/plugin-file-secrets";
import { supermemoryPlugin } from "executor-supermemory";

const executor = await createExecutor({
  onElicitation: "accept-all",
  plugins: [
    fileSecretsPlugin(),
    supermemoryPlugin({
      baseURL: "http://localhost:6767",
      defaultContainerTag: "project_alpha",
    }),
  ] as const,
});
```

API keys are stored in Executor connections, not in plugin options.

## Add Integration

Register the Supermemory integration, then create a connection with a hosted or local API key:

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

## Executor From Source

Run Executor from a source clone and add the plugin to Local Executor's static plugin list.

```bash
cd ~/Development
git clone https://github.com/RhysSullivan/executor.git
cd executor
bun install
bun add executor-supermemory
bun dev
```

For local package development, install this repository by path instead of from npm.

Edit `apps/local/executor.config.ts` in the Executor repo:

```ts
import { supermemoryPlugin } from "executor-supermemory";

export default defineExecutorConfig({
  plugins: () =>
    [
      // existing Local Executor plugins...
      supermemoryPlugin({
        baseURL: "http://localhost:6767",
        defaultContainerTag: "project_alpha",
      }),
    ] as const,
});
```

You can also run the source CLI with an isolated dev data directory:

```bash
bun run dev:cli -- web
bun run dev:cli -- daemon run --foreground
```

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
