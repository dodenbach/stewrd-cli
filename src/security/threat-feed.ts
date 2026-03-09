/**
 * MCP Threat Feed — known-bad servers, vulnerable versions, and security policies.
 *
 * Ships a bundled threat database and can optionally fetch updates from
 * stewrd.dev/threats.json for the latest advisories.
 */

const THREAT_FEED_URL = "https://stewrd.dev/threats.json";

export type Severity = "critical" | "high" | "medium" | "low";

export interface ThreatEntry {
  /** npm package name or MCP server name */
  name: string;
  /** Affected versions (semver range or "all") */
  versions: string;
  severity: Severity;
  /** Short description of the threat */
  description: string;
  /** Category of threat */
  type:
    | "malicious"
    | "vulnerable"
    | "typosquat"
    | "abandoned"
    | "excessive-permissions";
  /** When this entry was added */
  reportedAt: string;
  /** Reference URL */
  reference?: string;
}

export interface ThreatFeed {
  version: 1;
  updatedAt: string;
  entries: ThreatEntry[];
}

/**
 * Known suspicious patterns in MCP server names (typosquatting).
 * These are common legitimate packages that attackers typosquat.
 */
export const TYPOSQUAT_TARGETS: Record<string, string[]> = {
  "@modelcontextprotocol/server-filesystem": [
    "modelcontextprotocol-server-filesystem",
    "mcp-server-filesystem",
    "@mcp/server-filesystem",
    "mcp-filesystem",
  ],
  "@modelcontextprotocol/server-github": [
    "modelcontextprotocol-server-github",
    "mcp-server-github",
    "mcp-github-server",
  ],
  "@modelcontextprotocol/server-slack": [
    "modelcontextprotocol-server-slack",
    "mcp-server-slack",
    "mcp-slack-server",
  ],
  "@notionhq/mcp-server": [
    "notion-mcp-server",
    "notionhq-mcp-server",
    "@notion/mcp-server",
  ],
  "@playwright/mcp": [
    "playwright-mcp",
    "playwright-mcp-server",
    "mcp-playwright",
  ],
};

/**
 * Bundled threat database — ships with the CLI so it works offline.
 * Updated with each stewrd release.
 */
export const BUNDLED_THREATS: ThreatFeed = {
  version: 1,
  updatedAt: "2026-03-08T00:00:00Z",
  entries: [
    // Seed entries will be added as real threats are discovered.
    // Supply chain risks (unpinned versions, -y flag) are handled
    // by the audit engine's built-in checks, not the threat feed.
  ],
};

/**
 * Suspicious env var names that could indicate data exfiltration.
 * Legitimate servers typically use specific, well-known env var names.
 */
export const SUSPICIOUS_ENV_PATTERNS = [
  /^PATH$/i,
  /^HOME$/i,
  /^USER$/i,
  /^SHELL$/i,
  /^AWS_SESSION_TOKEN$/i,
  /^SSH_AUTH_SOCK$/i,
  /^GPG_/i,
  /^OPENAI_API_KEY$/i, // Cross-provider key access
  /^ANTHROPIC_API_KEY$/i,
];

/**
 * High-risk command patterns — commands that indicate broad system access.
 */
export const HIGH_RISK_COMMANDS = [
  "bash",
  "sh",
  "zsh",
  "/bin/bash",
  "/bin/sh",
  "/bin/zsh",
  "cmd.exe",
  "powershell",
  "pwsh",
];

/**
 * Known trusted publishers on npm (official MCP ecosystem).
 */
export const TRUSTED_PUBLISHERS = [
  "@modelcontextprotocol/",
  "@anthropic/",
  "@playwright/",
  "@supabase/",
  "@stripe/",
  "@cloudflare/",
  "@sentry/",
  "@notionhq/",
  "@datadog/",
  "@vercel/",
  "@upstash/",
];

/**
 * Try to fetch the latest threat feed from stewrd.dev.
 * Falls back to bundled data on failure.
 */
export async function fetchThreatFeed(): Promise<ThreatFeed> {
  try {
    const res = await fetch(THREAT_FEED_URL, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return (await res.json()) as ThreatFeed;
    }
  } catch {
    // Network error — use bundled
  }
  return BUNDLED_THREATS;
}

/**
 * Check if a package name looks like a typosquat of a known package.
 */
export function checkTyposquat(packageName: string): string | null {
  for (const [legit, squats] of Object.entries(TYPOSQUAT_TARGETS)) {
    if (squats.includes(packageName)) {
      return `Possible typosquat of ${legit}`;
    }
  }
  return null;
}

/**
 * Check if a package is from a trusted publisher.
 */
export function isTrustedPublisher(packageName: string): boolean {
  return TRUSTED_PUBLISHERS.some((prefix) => packageName.startsWith(prefix));
}
