import { definePlugin } from "@executor-js/sdk/core";

import { supermemoryPlugin } from "../plugin.ts";
import type { SupermemoryPluginOptions } from "../integration.ts";
import { SupermemoryGroup } from "./group.ts";
import { SupermemoryExtensionService, SupermemoryHandlers } from "./handlers.ts";

export { SupermemoryGroup } from "./group.ts";
export { SupermemoryExtensionService, SupermemoryHandlers } from "./handlers.ts";

export const supermemoryHttpPlugin = definePlugin((options: SupermemoryPluginOptions = {}) => ({
  ...supermemoryPlugin(options),
  routes: () => SupermemoryGroup,
  handlers: () => SupermemoryHandlers,
  extensionService: SupermemoryExtensionService,
}));

export default supermemoryHttpPlugin;
