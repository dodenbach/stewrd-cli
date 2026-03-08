# stewrd

The package manager for MCP servers.

Discover, install, and sync MCP servers across Claude Code, Claude Desktop, Cursor, Windsurf, and VS Code — from one CLI.

## Why?

You have MCP servers scattered across multiple AI clients. Different JSON files, different formats, no visibility into what's configured where. Add a server in Claude Code, manually copy the config to Cursor, then Windsurf, then Claude Desktop. Forget one? It silently doesn't work.

**stewrd fixes this.** One command to see everything. One command to sync everywhere.

## Install

```bash
npm install -g stewrd
```

## Commands

### `stewrd scan`

See every MCP server on your machine, across all clients.

```
$ stewrd scan

  stewrd scan — MCP servers on this machine

  ● Claude Code (3 servers)
  ├─ pencil                   stdio      /Applications/Pencil.app/...
  ├─ supabase                 http       https://mcp.supabase.com/mcp
  └─ github                   http       https://api.githubcopilot.com/mcp/

  ● Cursor (1 server)
  └─ supabase                 http       https://mcp.supabase.com/mcp

  ○ Claude Desktop (none)

  ─────────────────────────────────────────────────
  4 servers across 3 clients
  3 unique, 1 shared across clients
```

### `stewrd sync`

Sync servers across all your clients. Servers configured in one client get added to all others.

```bash
# Preview what would be synced
stewrd sync --dry-run

# Sync everything
stewrd sync
```

### `stewrd add <server>`

Add a server to a specific client.

```bash
# Add an npx-based server to Claude Code
stewrd add @modelcontextprotocol/server-filesystem

# Add to a specific client
stewrd add my-server --client cursor --command npx --args "-y @my/mcp-server"

# Add an HTTP server
stewrd add my-api --url https://mcp.example.com/mcp --client claude-desktop
```

### `stewrd remove <server>`

Remove a server from a client.

```bash
stewrd remove my-server --client claude-code
```

### `stewrd doctor`

Check your MCP configs for security issues and misconfigurations.

```
$ stewrd doctor

  stewrd doctor — MCP health check

  ⚠ WARNINGS (2)
    ⚠ my-server (Claude Code)
      Unpinned npm package version
      Fix: stewrd add my-server --command npx --args "-y @my/server@1.2.0"
    ⚠ custom-tool (Cursor)
      Plaintext secret in env: API_TOKEN
      Fix: Use environment variable reference: ${API_TOKEN}

  ℹ INFO (1)
    ℹ supabase (Claude Code)
      Only configured in Claude Code — missing from 2 other clients
      Fix: stewrd sync
```

## Supported Clients

| Client | Config Location | Status |
|---|---|---|
| Claude Code | `~/.claude/.mcp.json` | ✅ |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` | ✅ |
| Cursor | `~/.cursor/mcp.json` | ✅ |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` | ✅ |
| VS Code | VS Code `settings.json` | ✅ |

## How It Works

stewrd reads the MCP configuration files from each supported client, normalizes the server definitions, and can write them back in the correct format for each client. When you `sync`, it takes the union of all servers across all clients and adds missing ones where they belong.

All writes create `.bak` backups of your original config files before modifying them.

## License

MIT
