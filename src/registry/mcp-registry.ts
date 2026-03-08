/**
 * Client for the official MCP Registry at registry.modelcontextprotocol.io
 * stewrd pulls from the official registry — we don't compete with it, we use it.
 */

import type { McpServer, Transport } from "../types.js";

const REGISTRY_BASE = "https://registry.modelcontextprotocol.io/v0.1";

export interface RegistryServerEntry {
  server: {
    name: string;
    description?: string;
    title?: string;
    version?: string;
    websiteUrl?: string;
    repository?: {
      url?: string;
      source?: string;
    };
    packages?: Array<{
      registryType: string;
      identifier: string;
      version?: string;
      transport?: { type: string };
      environmentVariables?: Array<{
        name: string;
        description?: string;
        isRequired?: boolean;
        isSecret?: boolean;
      }>;
      arguments?: Array<{
        positional?: string[];
        named?: Record<string, string>;
      }>;
    }>;
    remotes?: Array<{
      type: string;
      url: string;
      headers?: Array<{
        name: string;
        value?: string;
        isRequired?: boolean;
        isSecret?: boolean;
      }>;
    }>;
  };
  _meta?: Record<string, unknown>;
}

export interface SearchResult {
  servers: RegistryServerEntry[];
  metadata: {
    nextCursor?: string;
    count: number;
  };
}

export async function searchOfficialRegistry(
  query: string,
  limit = 20
): Promise<SearchResult> {
  const url = `${REGISTRY_BASE}/servers?search=${encodeURIComponent(query)}&version=latest&limit=${limit}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Registry search failed: ${res.status}`);
  }

  return res.json();
}

export async function getServerFromRegistry(
  name: string
): Promise<RegistryServerEntry | null> {
  const url = `${REGISTRY_BASE}/servers/${encodeURIComponent(name)}/versions/latest`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Registry fetch failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Convert an official registry entry to our local McpServer format
 * so it can be written to any client config.
 */
export function registryEntryToMcpServer(
  entry: RegistryServerEntry
): McpServer | null {
  const s = entry.server;
  // Use the short name (part after the slash) for the config key
  const shortName = s.name.includes("/")
    ? s.name.split("/").pop()!
    : s.name;

  // Prefer packages (local/stdio) over remotes (http)
  if (s.packages && s.packages.length > 0) {
    const pkg = s.packages[0];
    const transport: Transport =
      pkg.registryType === "npm" ? "npx" : "stdio";

    const server: McpServer = {
      name: shortName,
      transport,
      description: s.description || s.title,
    };

    if (pkg.registryType === "npm") {
      server.command = "npx";
      server.args = ["-y", pkg.identifier];
      if (pkg.version) {
        server.args = ["-y", `${pkg.identifier}@${pkg.version}`];
      }
    }

    if (pkg.environmentVariables && pkg.environmentVariables.length > 0) {
      const env: Record<string, string> = {};
      for (const v of pkg.environmentVariables) {
        env[v.name] = `\${${v.name}}`;
      }
      server.env = env;
    }

    return server;
  }

  // Fall back to remotes
  if (s.remotes && s.remotes.length > 0) {
    const remote = s.remotes[0];
    const server: McpServer = {
      name: shortName,
      transport: "http",
      url: remote.url,
      description: s.description || s.title,
    };
    return server;
  }

  return null;
}

/**
 * Format a registry entry for display
 */
export function formatRegistryEntry(entry: RegistryServerEntry): {
  name: string;
  shortName: string;
  description: string;
  transport: string;
  package: string;
  repo: string;
} {
  const s = entry.server;
  const shortName = s.name.includes("/")
    ? s.name.split("/").pop()!
    : s.name;

  let transport = "unknown";
  let pkg = "";

  if (s.packages && s.packages.length > 0) {
    transport = s.packages[0].registryType || "npm";
    pkg = s.packages[0].identifier || "";
  } else if (s.remotes && s.remotes.length > 0) {
    transport = s.remotes[0].type || "http";
    pkg = s.remotes[0].url || "";
  }

  return {
    name: s.name,
    shortName,
    description: s.description || s.title || "",
    transport,
    package: pkg,
    repo: s.repository?.url || "",
  };
}
