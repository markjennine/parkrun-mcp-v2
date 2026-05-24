import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  athleteTools,
  eventTools,
  handleAthleteTool,
  handleEventTool,
} from './tools/index';

const server = new Server(
  { name: 'parkrun-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Register all tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [...athleteTools, ...eventTools],
}));

// Dispatch tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const toolArgs = args as Record<string, unknown>;

  try {
    let text: string;

    const athleteToolNames = new Set(athleteTools.map((t) => t.name));
    const eventToolNames = new Set(eventTools.map((t) => t.name));

    if (athleteToolNames.has(name)) {
      text = await handleAthleteTool(name, toolArgs);
    } else if (eventToolNames.has(name)) {
      text = await handleEventTool(name, toolArgs);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return { content: [{ type: 'text', text }] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr only — stdout is reserved for MCP protocol messages
  process.stderr.write('parkrun-mcp server started\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
