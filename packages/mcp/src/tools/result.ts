import { toPublicError } from "@trading/core";

// MCP's SDK does not own our public error policy; use the shared classifier before serializing thrown values.
// oxlint-disable-next-line anti-slop/no-unknown-parameters
export function toolError(error: unknown) {
  return {
    content: [{ type: "text" as const, text: `Error: ${toPublicError(error).message}` }],
    isError: true,
  };
}
