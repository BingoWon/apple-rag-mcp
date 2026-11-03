export const TOOL_OUTCOMES = [
	"success",
	"degraded",
	"no_content",
	"limited",
	"invalid",
	"failed",
	"unknown",
] as const;

export type ToolOutcome = (typeof TOOL_OUTCOMES)[number];

export function emptyOutcomes(): Record<ToolOutcome, number> {
	return { success: 0, degraded: 0, no_content: 0, limited: 0, invalid: 0, failed: 0, unknown: 0 };
}
