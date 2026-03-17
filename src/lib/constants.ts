/**
 * Application Constants
 * Centralized configuration values
 */

// Admin authentication
export const ADMIN_PASSWORD_HEADER = "X-Admin-Password" as const;
export const ADMIN_SESSION_KEY = "adminPassword" as const;

// API endpoints
export const API_ENDPOINTS = {
	ADMIN: {
		USERS: "/admin/users",
		MCP_TOKENS: "/admin/mcp-tokens",
		USAGE_LOGS: "/admin/usage-logs",
	},
} as const;
