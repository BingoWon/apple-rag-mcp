import type { CallToolResult } from "@modelcontextprotocol/server";
import type { z } from "zod";
import { fetchInputSchema } from "../../../shared/contracts.js";
import { ToolService } from "../../services/tool-service.js";
import type { AuthContext, Services } from "../../services/types.js";
import {
	createSuccessResult,
	createToolErrorResult,
	formatFetchResponse,
} from "../formatters/response-formatter.js";

export const FETCH_TOOL_INPUT_SCHEMA = fetchInputSchema;
export type FetchToolArgs = z.infer<typeof fetchInputSchema>;
export class FetchTool {
	constructor(private services: Services) {}
	async handle(
		args: FetchToolArgs,
		auth: AuthContext,
		request: Request,
		signal = request.signal,
	): Promise<CallToolResult> {
		const result = await new ToolService(this.services).execute(
			"fetch",
			args,
			auth,
			request,
			"mcp",
			signal,
		);
		return result.ok
			? createSuccessResult(formatFetchResponse(result, auth.isAuthenticated), result)
			: createToolErrorResult(result);
	}
}
