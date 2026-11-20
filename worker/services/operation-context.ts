import {
	MCP_CLIENT_HEADER,
	type MCPClientId,
	reportedMCPClient,
} from "../../shared/mcp-clients.js";
import type { AuthContext } from "./types.js";

export interface OperationContext {
	channel: "mcp" | "cli";
	credentialId?: string;
	sessionId?: string;
	authMethod: string;
	requestId: string;
	clientName?: string;
	clientVersion?: string;
	reportedClient?: MCPClientId;
}

export function operationContext(
	auth: AuthContext,
	request: Request,
	channel: "mcp" | "cli",
): OperationContext {
	return {
		channel,
		credentialId: auth.credentialId,
		sessionId: auth.sessionId,
		authMethod: auth.authMethod ?? (auth.isAuthenticated ? "token" : "anonymous"),
		requestId: crypto.randomUUID(),
		// Client labels are diagnostic; the entry channel and credential come from the server.
		reportedClient:
			channel === "mcp" ? reportedMCPClient(request.headers.get(MCP_CLIENT_HEADER)) : undefined,
		clientName: request.headers.get("User-Agent")?.slice(0, 128),
		clientVersion: request.headers.get("X-Apple-RAG-Version")?.slice(0, 32),
	};
}
