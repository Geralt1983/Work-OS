import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";

export class ClickUpMCPClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnected = false;

  async connect() {
    if (this.isConnected) {
      return;
    }

    const serverProcess = spawn("npx", [
      "-y",
      "@djclarkson/clickup-mcp-server@latest"
    ], {
      env: {
        ...process.env,
        CLICKUP_API_KEY: process.env.CLICKUP_API_KEY,
        CLICKUP_TEAM_ID: process.env.CLICKUP_TEAM_ID,
      },
    });

    if (!process.env.CLICKUP_API_KEY || !process.env.CLICKUP_TEAM_ID) {
      throw new Error("CLICKUP_API_KEY and CLICKUP_TEAM_ID environment variables are required");
    }

    this.transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "@djclarkson/clickup-mcp-server@latest"],
      env: {
        CLICKUP_API_KEY: process.env.CLICKUP_API_KEY,
        CLICKUP_TEAM_ID: process.env.CLICKUP_TEAM_ID,
      },
    });

    this.client = new Client(
      {
        name: "clickup-assistant-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    await this.client.connect(this.transport);
    this.isConnected = true;
    console.log("✅ Connected to ClickUp MCP Server");
  }

  async listTools() {
    if (!this.client) {
      throw new Error("Client not connected");
    }

    const response = await this.client.listTools();
    return response.tools;
  }

  async callTool(name: string, args: Record<string, unknown>) {
    if (!this.client) {
      throw new Error("Client not connected");
    }

    const response = await this.client.callTool({
      name,
      arguments: args,
    });

    return response;
  }

  async disconnect() {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
    this.client = null;
    this.isConnected = false;
  }

  isReady() {
    return this.isConnected;
  }
}

export const mcpClient = new ClickUpMCPClient();
