export const TOOL_CHANNELS = ["mcp", "cli", "unknown"] as const;
export type ToolChannel = (typeof TOOL_CHANNELS)[number];
