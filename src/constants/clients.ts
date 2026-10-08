import { INSTALL_CLIENTS, PROMPT_CLIENTS } from "./mcpClients";

export const SUPPORTED_CLIENTS = [
	...PROMPT_CLIENTS,
	...INSTALL_CLIENTS.filter((client) => client.key !== "vscode-insiders"),
];
