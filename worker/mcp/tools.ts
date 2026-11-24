import type { CallToolResult } from "@modelcontextprotocol/server";
import { type Operation, ToolService } from "../services/tool-service.js";
import type { AuthContext, Services } from "../services/types.js";
import {
	createSuccessResult,
	createToolErrorResult,
	formatBrowseResponse,
	formatFetchResponse,
	formatRAGResponse,
} from "./formatters/response-formatter.js";

export async function executeMcpTool(
	name: Operation,
	args: unknown,
	services: Services,
	auth: AuthContext,
	request: Request,
	signal = request.signal,
): Promise<CallToolResult> {
	const result = await new ToolService(services).execute(name, args, auth, request, "mcp", signal);
	if (!result.ok) return createToolErrorResult(result);
	if (name === "search") {
		return createSuccessResult(
			formatRAGResponse(result as Extract<typeof result, { query: string }>, auth.isAuthenticated),
			result,
		);
	}
	if (name === "browse") {
		return createSuccessResult(
			formatBrowseResponse(
				result as Extract<typeof result, { items: unknown }>,
				auth.isAuthenticated,
			),
			result,
		);
	}
	return createSuccessResult(
		formatFetchResponse(
			result as Extract<typeof result, { requested_url: string }>,
			auth.isAuthenticated,
		),
		result,
	);
}
