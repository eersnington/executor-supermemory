import { useState } from "react";
import type { SyntheticEvent } from "react";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Predicate from "effect/Predicate";
import {
  createPluginAtomClient,
  defineClientPlugin,
  useAtomSet,
  type IntegrationPlugin,
} from "@executor-js/sdk/client";

import { SupermemoryGroup } from "./api/group.ts";
import { supermemoryIconUrl } from "./icon.ts";

const integrationWriteKeys = ["integrations", "tools"] as const;

const SupermemoryClient = createPluginAtomClient(SupermemoryGroup);
const addSupermemoryIntegration = SupermemoryClient.mutation("supermemory", "addIntegration");

const supermemoryPresets = [
  {
    id: "supermemory",
    name: "Supermemory",
    summary: "Connect Supermemory Cloud or a local Supermemory server.",
    url: "https://supermemory.ai",
    icon: supermemoryIconUrl,
    featured: true,
  },
] as const;

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function addErrorMessage(exit: Exit.Exit<unknown, unknown>, slug: string): string {
  return Option.match(Exit.findErrorOption(exit), {
    onNone: () => "Failed to add the Supermemory integration. The catalog was not changed.",
    onSome: (error) =>
      Predicate.isTagged("IntegrationAlreadyExistsError")(error)
        ? `An integration named "${slug}" already exists. Open it from the integrations list or choose a different namespace.`
        : "Failed to add the Supermemory integration. Check the URL and try again.",
  });
}

function AddSupermemoryIntegration(props: {
  readonly onComplete: (slug?: string) => void;
  readonly onCancel: () => void;
  readonly initialUrl?: string;
  readonly initialNamespace?: string;
}) {
  const [name, setName] = useState("Supermemory");
  const [slug, setSlug] = useState(props.initialNamespace ?? "supermemory");
  const [defaultContainerTag, setDefaultContainerTag] = useState("project_alpha");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doAddIntegration = useAtomSet(addSupermemoryIntegration, { mode: "promiseExit" });

  const resolvedSlug = slugify(slug) || "supermemory";
  const displayName = name.trim() || "Supermemory";
  const canSubmit = resolvedSlug.length > 0 && !submitting;

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);

    const containerTag = defaultContainerTag.trim();
    const exit = await doAddIntegration({
      payload: {
        slug: resolvedSlug,
        name: displayName,
        ...(containerTag.length > 0 ? { defaultContainerTag: containerTag } : {}),
      },
      reactivityKeys: integrationWriteKeys,
    });

    if (Exit.isFailure(exit)) {
      setError(addErrorMessage(exit, resolvedSlug));
      setSubmitting(false);
      return;
    }

    props.onComplete(exit.value.slug);
  };

  return (
    <form onSubmit={(event) => void handleSubmit(event)} style={{ display: "grid", gap: 24 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 650 }}>Add Supermemory</h1>
        <p style={{ margin: 0, maxWidth: 640, color: "var(--muted-foreground)", fontSize: 14 }}>
          Register Supermemory in Executor. Choose Cloud API key, Local no auth, or Local API key
          when you add a connection after this step.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: 18,
          border: "1px solid var(--border)",
          borderRadius: 16,
          padding: 20,
          background: "var(--card)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Display name</span>
            <input
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              placeholder="Supermemory"
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 12px",
                background: "var(--background)",
                color: "var(--foreground)",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Namespace</span>
            <input
              value={slug}
              onChange={(event) => setSlug(slugify(event.currentTarget.value))}
              placeholder="supermemory"
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "10px 12px",
                background: "var(--background)",
                color: "var(--foreground)",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 13,
              }}
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Default container tag</span>
          <input
            value={defaultContainerTag}
            onChange={(event) => setDefaultContainerTag(event.currentTarget.value)}
            placeholder="project_alpha"
            style={{
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "10px 12px",
              background: "var(--background)",
              color: "var(--foreground)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 13,
            }}
          />
          <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>
            Used when memory tools do not receive an explicit container tag.
          </span>
        </label>
      </div>

      {error && (
        <div
          style={{
            border: "1px solid color-mix(in srgb, var(--destructive) 35%, transparent)",
            borderRadius: 12,
            padding: "10px 12px",
            color: "var(--destructive)",
            background: "color-mix(in srgb, var(--destructive) 8%, transparent)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <button
          type="button"
          onClick={props.onCancel}
          disabled={submitting}
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "9px 14px",
            background: "var(--background)",
            color: "var(--foreground)",
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            border: "1px solid var(--primary)",
            borderRadius: 10,
            padding: "9px 14px",
            background: "var(--primary)",
            color: "var(--primary-foreground)",
            opacity: canSubmit ? 1 : 0.55,
          }}
        >
          {submitting ? "Adding..." : "Add integration"}
        </button>
      </div>
    </form>
  );
}

function EditSupermemoryIntegration(props: {
  readonly sourceId: string;
  readonly onSave: () => void;
}) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 650 }}>Supermemory</h1>
      <p style={{ margin: 0, color: "var(--muted-foreground)", fontSize: 14 }}>
        Supermemory integration settings for <code>{props.sourceId}</code> are managed through the
        standard Executor accounts and connection flow.
      </p>
      <button
        type="button"
        onClick={props.onSave}
        style={{
          justifySelf: "start",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "9px 14px",
          background: "var(--background)",
          color: "var(--foreground)",
        }}
      >
        Done
      </button>
    </div>
  );
}

const supermemoryIntegrationPlugin: IntegrationPlugin = {
  key: "supermemory",
  label: "Supermemory",
  add: AddSupermemoryIntegration,
  edit: EditSupermemoryIntegration,
  presets: supermemoryPresets,
};

export default defineClientPlugin({
  id: "supermemory" as const,
  integrationPlugin: supermemoryIntegrationPlugin,
});
