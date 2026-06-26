"use client";

import { type FormEvent, useState, useTransition } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createIntegrationTokenAction,
  revokeIntegrationTokenAction,
} from "./actions";

export type IntegrationTokenView = {
  id: string;
  name: string;
  kind: string;
  scopes: string[];
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
};

const TOKEN_KINDS = [
  { id: "a2a", label: "A2A client", defaultName: "A2A client" },
  { id: "public_api", label: "Public API", defaultName: "Public API client" },
  { id: "mcp", label: "MCP server", defaultName: "MCP client" },
] as const;

const SCOPE_OPTIONS: Record<string, Array<{ id: string; label: string }>> = {
  a2a: [
    { id: "a2a:read", label: "Read tasks" },
    { id: "a2a:message", label: "Start runs" },
  ],
  public_api: [{ id: "public_api:read", label: "Read campaigns" }],
  mcp: [{ id: "mcp:read", label: "Read MCP tools" }],
};

export function IntegrationTokensForm({
  tokens,
}: {
  tokens: IntegrationTokenView[];
}) {
  const [kind, setKind] = useState<(typeof TOKEN_KINDS)[number]["id"]>("a2a");
  const [name, setName] = useState("A2A client");
  const [scopes, setScopes] = useState<string[]>(["a2a:read"]);
  const [createdToken, setCreatedToken] = useState("");
  const [pending, startTransition] = useTransition();

  const scopeOptions = SCOPE_OPTIONS[kind];

  function toggleScope(scope: string, checked: boolean) {
    setScopes((current) =>
      checked
        ? current.includes(scope)
          ? current
          : [...current, scope]
        : current.filter((item) => item !== scope),
    );
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      try {
        const result = await createIntegrationTokenAction({
          kind,
          name,
          scopes,
        });
        setCreatedToken(result.plaintext);
        toast.success("Integration token created.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not create token.",
        );
      }
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      try {
        await revokeIntegrationTokenAction(id);
        toast.success("Token revoked.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not revoke token.",
        );
      }
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="integration-token-kind">Token type</Label>
          <select
            id="integration-token-kind"
            value={kind}
            onChange={(event) => {
              const nextKind = event.target.value as typeof kind;
              const tokenKind = TOKEN_KINDS.find((item) => item.id === nextKind);
              setKind(nextKind);
              setName(tokenKind?.defaultName ?? "Integration client");
              setScopes([SCOPE_OPTIONS[nextKind]?.[0]?.id ?? ""]);
              setCreatedToken("");
            }}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {TOKEN_KINDS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="integration-token-name">Token name</Label>
          <Input
            id="integration-token-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {scopeOptions.map((scope) => (
            <label
              key={scope.id}
              className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-primary"
                checked={scopes.includes(scope.id)}
                onChange={(event) => toggleScope(scope.id, event.target.checked)}
              />
              {scope.label}
            </label>
          ))}
        </div>
        <Button type="submit" disabled={pending}>
          <KeyRound className="size-4" aria-hidden />
          Create token
        </Button>
      </form>

      {createdToken ? (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">New token</p>
          <Input value={createdToken} readOnly />
          <p className="text-muted-foreground text-xs">
            This value is shown once.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        {tokens.length === 0 ? (
          <p className="text-muted-foreground text-sm">No integration tokens.</p>
        ) : (
          tokens.map((token) => (
            <div
              key={token.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm"
            >
              <span className="font-medium">{token.name}</span>
              <Badge variant={token.status === "active" ? "default" : "outline"}>
                {token.status}
              </Badge>
              {token.scopes.map((scope) => (
                <Badge key={scope} variant="secondary">
                  {scope}
                </Badge>
              ))}
              <span className="text-muted-foreground ml-auto text-xs">
                Last used {token.lastUsedAt ? formatDate(token.lastUsedAt) : "never"}
              </span>
              {token.status === "active" ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => revoke(token.id)}
                  disabled={pending}
                  aria-label={`Revoke ${token.name}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
