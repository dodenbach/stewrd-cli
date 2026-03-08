import chalk from "chalk";
import { REGISTRY, CATEGORIES } from "../registry/servers.js";
import type { RegistryEntry } from "../registry/servers.js";

interface SearchOptions {
  category?: string;
  list?: boolean;
}

function matchScore(entry: RegistryEntry, query: string): number {
  const q = query.toLowerCase();
  let score = 0;

  if (entry.name.toLowerCase() === q) score += 100;
  if (entry.name.toLowerCase().includes(q)) score += 50;
  if (entry.package.toLowerCase().includes(q)) score += 30;
  if (entry.description.toLowerCase().includes(q)) score += 20;
  if (entry.category.toLowerCase() === q) score += 40;
  if (entry.category.toLowerCase().includes(q)) score += 15;

  return score;
}

function renderEntry(entry: RegistryEntry): void {
  const verified = entry.verified ? chalk.green(" ✓") : "";
  const name = chalk.bold.white(entry.name.padEnd(24));
  const cat = chalk.dim(entry.category.padEnd(14));
  const desc = chalk.gray(entry.description);
  console.log(`  ${name} ${cat} ${desc}${verified}`);
}

export async function search(
  query: string | undefined,
  options: SearchOptions
): Promise<void> {
  // List categories
  if (options.list) {
    console.log(`\n  ${chalk.bold("Available categories:")}\n`);
    for (const cat of CATEGORIES) {
      const count = REGISTRY.filter((e) => e.category === cat).length;
      console.log(`  ${chalk.bold(cat.padEnd(16))} ${chalk.dim(`${count} server${count === 1 ? "" : "s"}`)}`);
    }
    console.log(
      chalk.dim(`\n  ${REGISTRY.length} servers in registry\n`)
    );
    return;
  }

  let results: RegistryEntry[];

  if (!query && options.category) {
    // Filter by category only
    results = REGISTRY.filter(
      (e) => e.category.toLowerCase() === options.category!.toLowerCase()
    );
  } else if (query) {
    // Search by query, optionally filtered by category
    let pool = REGISTRY;
    if (options.category) {
      pool = pool.filter(
        (e) => e.category.toLowerCase() === options.category!.toLowerCase()
      );
    }

    const scored = pool
      .map((e) => ({ entry: e, score: matchScore(e, query) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    results = scored.map((s) => s.entry);
  } else {
    // No query, no category — show everything
    results = [...REGISTRY].sort((a, b) => a.category.localeCompare(b.category));
  }

  if (results.length === 0) {
    console.log(
      chalk.yellow(`\n  No servers found for "${query}"\n`)
    );
    console.log(
      chalk.dim("  Try: stewrd search --list to see categories\n")
    );
    return;
  }

  console.log(
    `\n  ${chalk.bold("stewrd search")}${query ? ` ${chalk.dim(query)}` : ""} ${chalk.dim(`— ${results.length} result${results.length === 1 ? "" : "s"}`)}\n`
  );

  // Group by category if showing all
  if (!query && !options.category) {
    let currentCat = "";
    for (const entry of results) {
      if (entry.category !== currentCat) {
        currentCat = entry.category;
        console.log(chalk.dim(`\n  ── ${currentCat} ──`));
      }
      renderEntry(entry);
    }
  } else {
    for (const entry of results) {
      renderEntry(entry);
    }
  }

  console.log(
    chalk.dim(`\n  Install: stewrd install <name> --client claude-code\n`)
  );
}
