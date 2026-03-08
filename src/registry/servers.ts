export interface RegistryEntry {
  name: string;
  package: string;
  description: string;
  transport: "npx" | "stdio" | "http";
  category: string;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  repo?: string;
  verified?: boolean;
}

// Curated registry of popular MCP servers
// Source: GitHub, npm, official MCP server lists
export const REGISTRY: RegistryEntry[] = [
  // --- Databases ---
  {
    name: "supabase",
    package: "@supabase/mcp-server",
    description: "Supabase database, auth, and storage",
    transport: "http",
    category: "database",
    url: "https://mcp.supabase.com/mcp",
    repo: "supabase/mcp",
    verified: true,
  },
  {
    name: "postgres",
    package: "@modelcontextprotocol/server-postgres",
    description: "Query PostgreSQL databases",
    transport: "npx",
    category: "database",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    env: { POSTGRES_CONNECTION_STRING: "${POSTGRES_CONNECTION_STRING}" },
    repo: "modelcontextprotocol/servers",
    verified: true,
  },
  {
    name: "sqlite",
    package: "@modelcontextprotocol/server-sqlite",
    description: "Read and write SQLite databases",
    transport: "npx",
    category: "database",
    args: ["-y", "@modelcontextprotocol/server-sqlite"],
    repo: "modelcontextprotocol/servers",
    verified: true,
  },
  {
    name: "redis",
    package: "@modelcontextprotocol/server-redis",
    description: "Redis key-value store operations",
    transport: "npx",
    category: "database",
    args: ["-y", "@modelcontextprotocol/server-redis"],
    repo: "modelcontextprotocol/servers",
    verified: true,
  },

  // --- File & Code ---
  {
    name: "filesystem",
    package: "@modelcontextprotocol/server-filesystem",
    description: "Read, write, and manage local files",
    transport: "npx",
    category: "files",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    repo: "modelcontextprotocol/servers",
    verified: true,
  },
  {
    name: "git",
    package: "mcp-server-git",
    description: "Git repository operations",
    transport: "npx",
    category: "code",
    args: ["-y", "mcp-server-git"],
    repo: "modelcontextprotocol/servers",
    verified: true,
  },

  // --- Web & Browser ---
  {
    name: "playwright",
    package: "@playwright/mcp",
    description: "Browser automation with Playwright",
    transport: "npx",
    category: "browser",
    args: ["-y", "@playwright/mcp@latest"],
    repo: "microsoft/playwright-mcp",
    verified: true,
  },
  {
    name: "puppeteer",
    package: "@modelcontextprotocol/server-puppeteer",
    description: "Browser automation with Puppeteer",
    transport: "npx",
    category: "browser",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    repo: "modelcontextprotocol/servers",
    verified: true,
  },
  {
    name: "fetch",
    package: "@modelcontextprotocol/server-fetch",
    description: "Fetch and parse web content",
    transport: "npx",
    category: "web",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    repo: "modelcontextprotocol/servers",
    verified: true,
  },

  // --- Developer Tools ---
  {
    name: "github",
    package: "@modelcontextprotocol/server-github",
    description: "GitHub repos, issues, PRs, and actions",
    transport: "npx",
    category: "devtools",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_PERSONAL_ACCESS_TOKEN}" },
    repo: "modelcontextprotocol/servers",
    verified: true,
  },
  {
    name: "gitlab",
    package: "@modelcontextprotocol/server-gitlab",
    description: "GitLab repos, issues, and merge requests",
    transport: "npx",
    category: "devtools",
    args: ["-y", "@modelcontextprotocol/server-gitlab"],
    env: { GITLAB_PERSONAL_ACCESS_TOKEN: "${GITLAB_PERSONAL_ACCESS_TOKEN}" },
    repo: "modelcontextprotocol/servers",
    verified: true,
  },
  {
    name: "linear",
    package: "linear-mcp-server",
    description: "Linear issue tracking and project management",
    transport: "http",
    category: "devtools",
    url: "https://mcp.linear.app/mcp",
    repo: "linear/linear-mcp-server",
    verified: true,
  },
  {
    name: "sentry",
    package: "@sentry/mcp-server",
    description: "Sentry error tracking and performance monitoring",
    transport: "npx",
    category: "devtools",
    args: ["-y", "@sentry/mcp-server"],
    env: { SENTRY_AUTH_TOKEN: "${SENTRY_AUTH_TOKEN}" },
    repo: "getsentry/sentry-mcp",
    verified: true,
  },

  // --- Communication ---
  {
    name: "slack",
    package: "@modelcontextprotocol/server-slack",
    description: "Slack channels, messages, and threads",
    transport: "npx",
    category: "communication",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    env: { SLACK_BOT_TOKEN: "${SLACK_BOT_TOKEN}" },
    repo: "modelcontextprotocol/servers",
    verified: true,
  },
  {
    name: "discord",
    package: "mcp-server-discord",
    description: "Discord server and channel management",
    transport: "npx",
    category: "communication",
    args: ["-y", "mcp-server-discord"],
    env: { DISCORD_TOKEN: "${DISCORD_TOKEN}" },
  },

  // --- Cloud & Infrastructure ---
  {
    name: "aws",
    package: "aws-mcp-server",
    description: "AWS services — S3, Lambda, EC2, and more",
    transport: "npx",
    category: "cloud",
    args: ["-y", "aws-mcp-server"],
    repo: "aws/aws-mcp-servers",
  },
  {
    name: "firebase",
    package: "firebase-tools",
    description: "Firebase/GCP project management",
    transport: "npx",
    category: "cloud",
    args: ["-y", "firebase-tools@latest"],
    repo: "firebase/firebase-tools",
    verified: true,
  },
  {
    name: "cloudflare",
    package: "@cloudflare/mcp-server-cloudflare",
    description: "Cloudflare Workers, KV, R2, and DNS",
    transport: "npx",
    category: "cloud",
    args: ["-y", "@cloudflare/mcp-server-cloudflare"],
    repo: "cloudflare/mcp-server-cloudflare",
    verified: true,
  },
  {
    name: "vercel",
    package: "@vercel/mcp",
    description: "Vercel deployments and project management",
    transport: "npx",
    category: "cloud",
    args: ["-y", "@vercel/mcp"],
    repo: "vercel/mcp",
    verified: true,
  },

  // --- Data & Search ---
  {
    name: "brave-search",
    package: "@modelcontextprotocol/server-brave-search",
    description: "Web search via Brave Search API",
    transport: "npx",
    category: "search",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: { BRAVE_API_KEY: "${BRAVE_API_KEY}" },
    repo: "modelcontextprotocol/servers",
    verified: true,
  },
  {
    name: "exa",
    package: "exa-mcp-server",
    description: "AI-powered web search via Exa",
    transport: "npx",
    category: "search",
    args: ["-y", "exa-mcp-server"],
    env: { EXA_API_KEY: "${EXA_API_KEY}" },
  },

  // --- Productivity ---
  {
    name: "notion",
    package: "@notionhq/mcp-server",
    description: "Notion pages, databases, and blocks",
    transport: "npx",
    category: "productivity",
    args: ["-y", "@notionhq/mcp-server"],
    env: { NOTION_API_KEY: "${NOTION_API_KEY}" },
    repo: "makenotion/notion-mcp-server",
    verified: true,
  },
  {
    name: "google-drive",
    package: "@modelcontextprotocol/server-gdrive",
    description: "Google Drive file access and search",
    transport: "npx",
    category: "productivity",
    args: ["-y", "@modelcontextprotocol/server-gdrive"],
    repo: "modelcontextprotocol/servers",
    verified: true,
  },
  {
    name: "google-maps",
    package: "@modelcontextprotocol/server-google-maps",
    description: "Google Maps geocoding, directions, and places",
    transport: "npx",
    category: "productivity",
    args: ["-y", "@modelcontextprotocol/server-google-maps"],
    env: { GOOGLE_MAPS_API_KEY: "${GOOGLE_MAPS_API_KEY}" },
    repo: "modelcontextprotocol/servers",
    verified: true,
  },
  {
    name: "asana",
    package: "asana-mcp-server",
    description: "Asana tasks and project management",
    transport: "http",
    category: "productivity",
    url: "https://mcp.asana.com/sse",
    verified: true,
  },
  {
    name: "todoist",
    package: "todoist-mcp-server",
    description: "Todoist task management",
    transport: "npx",
    category: "productivity",
    args: ["-y", "todoist-mcp-server"],
    env: { TODOIST_API_TOKEN: "${TODOIST_API_TOKEN}" },
  },

  // --- AI & Reasoning ---
  {
    name: "sequential-thinking",
    package: "@modelcontextprotocol/server-sequential-thinking",
    description: "Structured step-by-step reasoning for complex problems",
    transport: "npx",
    category: "ai",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    repo: "modelcontextprotocol/servers",
    verified: true,
  },
  {
    name: "context7",
    package: "@upstash/context7-mcp",
    description: "Up-to-date library documentation for AI coding",
    transport: "npx",
    category: "ai",
    args: ["-y", "@upstash/context7-mcp"],
    repo: "upstash/context7",
    verified: true,
  },

  // --- Monitoring & Analytics ---
  {
    name: "datadog",
    package: "@datadog/mcp-server",
    description: "Datadog metrics, logs, and APM",
    transport: "npx",
    category: "monitoring",
    args: ["-y", "@datadog/mcp-server"],
    env: { DD_API_KEY: "${DD_API_KEY}", DD_APP_KEY: "${DD_APP_KEY}" },
  },

  // --- Payments ---
  {
    name: "stripe",
    package: "@stripe/mcp",
    description: "Stripe payments, subscriptions, and billing",
    transport: "http",
    category: "payments",
    url: "https://mcp.stripe.com",
    repo: "stripe/agent-toolkit",
    verified: true,
  },
];

export const CATEGORIES = [
  ...new Set(REGISTRY.map((s) => s.category)),
].sort();
