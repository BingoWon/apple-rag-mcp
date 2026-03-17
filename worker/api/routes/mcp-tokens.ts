/**
 * MCP Tokens Management Routes - Modernized
 * Handles MCP token creation, management, and validation
 */

import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import { ApiErrorCode } from "../constants/error-codes";
import { authMiddleware } from "../middleware/auth";
import type { User } from "../types";
import type { AppEnv } from "../types/hono";
import { logger } from "../utils/logger";
import { createMCPTokenSchema } from "../utils/validation";

const app = new OpenAPIHono<AppEnv>();

// MCP Token response schema (per database-schema.md)
const MCPTokenResponseSchema = z.object({
	id: z.string(),
	name: z.string(),
	mcp_token: z.string(), // MCP token value
	last_used_at: z.string().datetime().nullable(),
	created_at: z.string().datetime(),
});

// Health check endpoint (no auth required)
const healthCheckRoute = createRoute({
	method: "get",
	path: "/health",
	responses: {
		200: {
			description: "Service is healthy",
			content: {
				"application/json": {
					schema: z.object({
						status: z.string(),
						timestamp: z.string(),
					}),
				},
			},
		},
	},
	tags: ["Health"],
});

app.openapi(healthCheckRoute, async (c) => {
	return c.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
	});
});

// List MCP tokens (modernized)
const listMCPTokensRoute = createRoute({
	method: "get",
	path: "/",
	middleware: [authMiddleware],
	responses: {
		200: {
			description: "MCP tokens retrieved successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.array(MCPTokenResponseSchema),
					}),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
		500: {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
	},
	tags: ["MCP Tokens"],
});

app.openapi(listMCPTokensRoute, async (c) => {
	const user = c.get("user") as User;

	try {
		logger.info(`Fetching MCP tokens for user ${user.id}`);

		// Query user's MCP tokens from database
		const tokens = await c.env.DB.prepare(
			`SELECT id, name, mcp_token, last_used_at, created_at
       FROM mcp_tokens
       WHERE user_id = ?
       ORDER BY created_at DESC`,
		)
			.bind(user.id)
			.all();

		// Transform database results to API format
		// Include token value for user convenience (consider encryption in production)
		const formattedTokens = (tokens.results || []).map((token: any) => ({
			id: token.id,
			name: token.name,
			mcp_token: token.mcp_token, // Include token for user access
			last_used_at: token.last_used_at,
			created_at: token.created_at,
		}));

		return c.json({ success: true, data: formattedTokens }, 200);
	} catch (error) {
		await logger.error(
			`Failed to fetch MCP tokens for user ${user.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to fetch MCP tokens",
				},
			},
			500,
		);
	}
});

// Create new MCP token (modernized)
const createMCPTokenRoute = createRoute({
	method: "post",
	path: "/",
	middleware: [authMiddleware],
	request: {
		body: {
			content: {
				"application/json": {
					schema: createMCPTokenSchema,
				},
			},
		},
	},
	responses: {
		201: {
			description: "MCP token created successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: MCPTokenResponseSchema,
					}),
				},
			},
		},
		400: {
			description: "Bad request",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
		500: {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
	},
	tags: ["MCP Tokens"],
});

app.openapi(createMCPTokenRoute, async (c) => {
	try {
		const user = c.get("user") as User;
		const { name } = c.req.valid("json");

		logger.info(`Creating MCP token "${name}" for user ${user.id}`);

		// Check if user already has 10 tokens (limit enforcement)
		const existingCount = await c.env.DB.prepare(
			"SELECT COUNT(*) as count FROM mcp_tokens WHERE user_id = ?",
		)
			.bind(user.id)
			.first();

		if (existingCount && (existingCount as any).count >= 10) {
			return c.json(
				{
					success: false,
					error: {
						code: ApiErrorCode.VALIDATION_ERROR,
						message: "Maximum 10 MCP tokens allowed per user",
					},
				},
				400,
			);
		}

		// Generate unique token ID and token
		const tokenId = crypto.randomUUID();
		const token = `at_${crypto.randomUUID().replace(/-/g, "")}`;

		// Store MCP token in database
		const now = new Date().toISOString();
		await c.env.DB.prepare(
			`INSERT INTO mcp_tokens (id, user_id, name, mcp_token, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
		)
			.bind(tokenId, user.id, name, token, now, now)
			.run();

		// Get the created token data from database to ensure consistent format
		const createdToken = await c.env.DB.prepare(
			"SELECT id, name, mcp_token, last_used_at, created_at FROM mcp_tokens WHERE id = ?",
		)
			.bind(tokenId)
			.first();

		// Return token data with the actual token (only on creation)
		const tokenData = {
			id: String(createdToken?.id || tokenId),
			name: String(createdToken?.name || name),
			mcp_token: token,
			last_used_at: createdToken?.last_used_at ? String(createdToken.last_used_at) : null,
			created_at: String(createdToken?.created_at || now),
		};

		return c.json({ success: true, data: tokenData }, 201);
	} catch (error) {
		await logger.error(
			`Failed to create MCP token for user ${c.get("user")?.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to create token",
				},
			},
			500,
		);
	}
});

// Update MCP token name (modernized)
const updateMCPTokenRoute = createRoute({
	method: "put",
	path: "/{id}",
	middleware: [authMiddleware],
	request: {
		params: z.object({
			id: z.string(),
		}),
		body: {
			content: {
				"application/json": {
					schema: z.object({
						name: z.string().min(1).max(100),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "MCP token updated successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: MCPTokenResponseSchema.omit({ mcp_token: true }),
					}),
				},
			},
		},
		400: {
			description: "Bad request",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
		404: {
			description: "Token not found",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
		500: {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
	},
	tags: ["MCP Tokens"],
});

app.openapi(updateMCPTokenRoute, async (c) => {
	try {
		const user = c.get("user") as User;
		const { id } = c.req.valid("param");
		const { name } = c.req.valid("json");

		logger.info(`Updating MCP token ${id} to "${name}" for user ${user.id}`);

		// Check if token exists and belongs to user
		const existingToken = await c.env.DB.prepare(
			`SELECT id, name FROM mcp_tokens WHERE id = ? AND user_id = ?`,
		)
			.bind(id, user.id)
			.first();

		if (!existingToken) {
			return c.json(
				{
					success: false,
					error: {
						code: ApiErrorCode.TOKEN_NOT_FOUND,
						message: "Token not found",
					},
				},
				404,
			);
		}

		// Update token name
		await c.env.DB.prepare(
			`UPDATE mcp_tokens SET name = ?, updated_at = ? WHERE id = ? AND user_id = ?`,
		)
			.bind(name, new Date().toISOString(), id, user.id)
			.run();

		// Return updated token data (without token value)
		const updatedToken = {
			id: id,
			name: name,
			last_used_at: existingToken.last_used_at,
			created_at: existingToken.created_at,
		};

		return c.json({ success: true, data: updatedToken }, 200);
	} catch (error) {
		await logger.error(
			`Failed to update MCP token for user ${c.get("user")?.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to update token",
				},
			},
			500,
		);
	}
});

// Delete MCP token (modernized)
const deleteMCPTokenRoute = createRoute({
	method: "delete",
	path: "/{id}",
	middleware: [authMiddleware],
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		200: {
			description: "MCP token deleted successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						message: z.string(),
					}),
				},
			},
		},
		401: {
			description: "Unauthorized",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
		404: {
			description: "Token not found",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
		500: {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
	},
	tags: ["MCP Tokens"],
});

app.openapi(deleteMCPTokenRoute, async (c) => {
	try {
		const user = c.get("user") as User;
		const { id } = c.req.valid("param");

		logger.info(`Deleting MCP token ${id} for user ${user.id}`);

		// Check if token exists and belongs to user
		const existingToken = await c.env.DB.prepare(
			`SELECT id FROM mcp_tokens WHERE id = ? AND user_id = ?`,
		)
			.bind(id, user.id)
			.first();

		if (!existingToken) {
			return c.json(
				{
					success: false,
					error: {
						code: ApiErrorCode.TOKEN_NOT_FOUND,
						message: "Token not found",
					},
				},
				404,
			);
		}

		// Delete token permanently for security
		await c.env.DB.prepare(`DELETE FROM mcp_tokens WHERE id = ? AND user_id = ?`)
			.bind(id, user.id)
			.run();

		return c.json(
			{
				success: true,
				data: { message: "Token deleted successfully" },
			},
			200,
		);
	} catch (error) {
		await logger.error(
			`Failed to delete MCP token for user ${c.get("user")?.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Failed to delete token",
				},
			},
			500,
		);
	}
});

// Validate MCP token (for MCP server integration - no auth required)
const validateMCPTokenRoute = createRoute({
	method: "post",
	path: "/validate",
	request: {
		body: {
			content: {
				"application/json": {
					schema: z.object({
						token: z.string(),
					}),
				},
			},
		},
	},
	responses: {
		200: {
			description: "Token validation successful",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z
							.object({
								userId: z.string(),
								email: z.string(),
								name: z.string(),
								plan_type: z.string(),
							})
							.optional(),
					}),
				},
			},
		},
		401: {
			description: "Invalid token",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
		500: {
			description: "Internal server error",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						error: z.object({
							code: z.string(),
							message: z.string(),
						}),
					}),
				},
			},
		},
	},
});

app.openapi(validateMCPTokenRoute, async (c) => {
	try {
		const { token } = c.req.valid("json");

		logger.info(`Validating MCP token ${token.substring(0, 8)}...`);

		// Query token and user data
		const tokenData = await c.env.DB.prepare(
			`SELECT
         t.id, t.user_id, t.name as token_name,
         u.email, u.name
       FROM mcp_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE t.mcp_token = ?`,
		)
			.bind(token)
			.first();

		if (!tokenData) {
			return c.json(
				{
					success: false,
					error: {
						code: ApiErrorCode.UNAUTHORIZED,
						message: "Invalid token",
					},
				},
				401,
			);
		}

		// Update last_used_at
		const now = new Date().toISOString();
		await c.env.DB.prepare(`UPDATE mcp_tokens SET last_used_at = ? WHERE mcp_token = ?`)
			.bind(now, token)
			.run();

		// Get user's subscription plan type
		const { getUserPlanType } = await import("../utils/subscription");
		const planType = await getUserPlanType(String(tokenData.user_id), c.env.DB);

		return c.json(
			{
				success: true,
				data: {
					userId: String(tokenData.user_id),
					email: String(tokenData.email || "unknown"),
					name: String(tokenData.name || "unknown"),
					plan_type: planType,
				},
			},
			200,
		);
	} catch (error) {
		await logger.error(
			`Failed to validate MCP token: ${error instanceof Error ? error.message : "Unknown error"}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: ApiErrorCode.INTERNAL_ERROR,
					message: "Token validation failed",
				},
			},
			500,
		);
	}
});

export default app;
