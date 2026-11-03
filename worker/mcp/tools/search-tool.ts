import type { CallToolResult } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { searchInputSchema } from "../../../shared/contracts.js";
import { ToolService } from "../../services/tool-service.js";
import type { AuthContext, Services } from "../../services/types.js";
import {
	createSuccessResult,
	createToolErrorResult,
	formatRAGResponse,
} from "../formatters/response-formatter.js";

export const SEARCH_TOOL_INPUT_SCHEMA = searchInputSchema;
export type SearchToolArgs = z.infer<typeof searchInputSchema>;
export class SearchTool {
	constructor(private services: Services) {}
	async handle(
		args: SearchToolArgs,
		auth: AuthContext,
		request: Request,
		signal = request.signal,
	): Promise<CallToolResult> {
		const result = await new ToolService(this.services).execute(
			"search",
			args,
			auth,
			request,
			"mcp",
			signal,
		);
		return result.ok
			? createSuccessResult(formatRAGResponse(result, auth.isAuthenticated), result)
			: createToolErrorResult(result);
	}
}
