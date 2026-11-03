import type { z } from "zod";
import type { AuthContext, Services } from "../mcp-types/index.js";
import { extractClientInfo } from "../mcp-utils/request-info.js";

// Observe the SDK's validation without parsing request bodies or changing discovery schemas.
export function loggedToolInput<T extends z.ZodObject>(
	name: "search" | "fetch",
	schema: T,
	services: Services,
	auth: AuthContext,
	request: Request,
) {
	return {
		"~standard": {
			...schema["~standard"],
			validate(input: unknown) {
				const result = schema.safeParse(input);
				if (result.success) return { value: result.data };
				const { ip, country } = extractClientInfo(request);
				const common = {
					userId: auth.userId || `anon_${ip}`,
					mcpToken: auth.token ?? null,
					ipAddress: ip,
					countryCode: country,
					responseTimeMs: 0,
					statusCode: 400,
					outcome: "invalid" as const,
					reason: "INVALID_ARGUMENTS",
				};
				const args = input && typeof input === "object" ? input : {};
				if (name === "search") {
					const query =
						"query" in args && typeof args.query === "string" ? args.query.slice(0, 10000) : "";
					services.logger?.logSearch({
						...common,
						requestedQuery: query,
						actualQuery: query,
						resultCount: 0,
					});
				} else {
					const url = "url" in args && typeof args.url === "string" ? args.url.slice(0, 2048) : "";
					services.logger?.logFetch({ ...common, requestedUrl: url, actualUrl: url });
				}
				return { issues: result.error.issues };
			},
		},
	};
}
