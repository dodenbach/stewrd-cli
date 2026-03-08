export type Transport = "stdio" | "npx" | "http" | "http+oauth" | "unknown";

export interface McpServer {
  name: string;
  transport: Transport;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  description?: string;
  oauth?: { clientId?: string; callbackPort?: number };
}

export interface ClientScanResult {
  client: string;
  configPath: string;
  exists: boolean;
  servers: McpServer[];
  error?: string;
}

export interface ScanResult {
  clients: ClientScanResult[];
  totalServers: number;
  timestamp: string;
}
