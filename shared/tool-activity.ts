import { z } from "zod";

export const TOOL_KINDS = ["search", "browse", "fetch"] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];
export const usagePeriod = z.enum(["24h", "7d", "30d"]);
export type UsagePeriod = z.infer<typeof usagePeriod>;
const counts = z.object({ search: z.number(), browse: z.number(), fetch: z.number() });
export const activitySchema = z.object({
	start: z.iso.datetime(),
	end: z.iso.datetime(),
	bucket: z.enum(["hour", "day"]),
	total: z.number(),
	by_tool: counts,
	points: z.array(counts.extend({ date: z.iso.datetime() })),
});
export type ToolActivity = z.infer<typeof activitySchema>;
