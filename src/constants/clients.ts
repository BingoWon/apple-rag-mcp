import { INSTALL_CLIENTS, PROMPT_CLIENTS } from "./mcpClients";

export const SUPPORTED_CLIENTS = [
	...PROMPT_CLIENTS.slice(0, -2),
	...INSTALL_CLIENTS.filter((client) => client.key !== "vscode-insiders"),
	// Keep the final two prompt clients last on the homepage as well.
	...PROMPT_CLIENTS.slice(-2),
];
