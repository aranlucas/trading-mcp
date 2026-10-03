import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export async function connectTestTools(register: (server: McpServer) => void) {
  const server = new McpServer({ name: "offline-test", version: "1.0.0" });
  const client = new Client({ name: "offline-test-client", version: "1.0.0" });
  register(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  const listed = await client.listTools();

  const tools = new Map(
    listed.tools.map((tool) => [
      tool.name,
      {
        handler: async (args: Record<string, z.infer<ReturnType<typeof z.json>>>) =>
          CallToolResultSchema.parse(await client.callTool({ name: tool.name, arguments: args })),
      },
    ]),
  );

  return {
    tools,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

export const ToolTextSchema = z
  .object({
    content: z.array(z.object({ type: z.literal("text"), text: z.string() })).min(1),
  })
  .transform((value) => value.content[0]!.text);
