import chalk from "chalk";
import ora from "ora";
import {
  searchOfficialRegistry,
  formatRegistryEntry,
} from "../registry/mcp-registry.js";

interface SearchOptions {
  limit?: string;
}

export async function search(
  query: string | undefined,
  options: SearchOptions
): Promise<void> {
  if (!query) {
    console.log(
      chalk.yellow("\n  Usage: stewrd search <query>")
    );
    console.log(
      chalk.dim("  Example: stewrd search filesystem\n")
    );
    return;
  }

  const spinner = ora(`Searching MCP registry for "${query}"...`).start();
  const limit = options.limit ? parseInt(options.limit, 10) : 20;

  try {
    const result = await searchOfficialRegistry(query, limit);
    spinner.stop();

    if (result.servers.length === 0) {
      console.log(
        chalk.yellow(`\n  No servers found for "${query}"`)
      );
      console.log(
        chalk.dim(
          "  Search the full registry: https://registry.modelcontextprotocol.io\n"
        )
      );
      return;
    }

    console.log(
      `\n  ${chalk.bold("stewrd search")} ${chalk.dim(query)} ${chalk.dim(`— ${result.servers.length} result${result.servers.length === 1 ? "" : "s"}`)}\n`
    );

    for (const entry of result.servers) {
      const info = formatRegistryEntry(entry);
      const name = chalk.bold.white(info.shortName.padEnd(28));
      const transport = chalk.dim(info.transport.padEnd(10));
      const desc = chalk.gray(
        info.description.length > 60
          ? info.description.slice(0, 57) + "..."
          : info.description
      );
      console.log(`  ${name} ${transport} ${desc}`);
    }

    console.log(
      chalk.dim(`\n  Install: stewrd install <name>\n`)
    );
  } catch (e) {
    spinner.fail(`Search failed: ${e}`);
    process.exit(1);
  }
}
