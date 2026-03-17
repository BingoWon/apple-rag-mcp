/**
 * Contact Messages Routes (User-facing)
 * Endpoints for users to submit messages and view replies
 */
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth";
import type { AppEnv } from "../types/hono";
import { isValidEmail } from "../utils/email";
import { logger } from "../utils/logger";
import { notifyTelegram } from "../utils/telegram-notifier";

const app = new OpenAPIHono<AppEnv>();

type UnreadReplyRow = {
	id: string;
	message: string;
	admin_reply: string;
	replied_at: string;
	created_at: string;
};

type MessageHistoryRow = {
	id: string;
	message: string;
	admin_reply: string | null;
	replied_at: string | null;
	created_at: string;
	user_read_at: string | null;
};

// Contact message schema
const ContactMessageSchema = z.object({
	email: z.string().optional(),
	message: z.string().min(1, "Message is required").max(2000, "Message too long"),
	userId: z.string().optional(),
});

const ContactMessageResponseSchema = z.object({
	id: z.string(),
	email: z.string().optional(),
	message: z.string(),
	created_at: z.string(),
});

// Submit contact message route
const submitContactMessageRoute = createRoute({
	method: "post",
	path: "/",
	summary: "Submit contact message",
	description: "Submit a contact message from FAB button",
	middleware: [optionalAuthMiddleware] as const,
	request: {
		body: {
			content: {
				"application/json": {
					schema: ContactMessageSchema,
				},
			},
		},
	},
	responses: {
		201: {
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: ContactMessageResponseSchema,
					}),
				},
			},
			description: "Contact message submitted successfully",
		},
		400: {
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
			description: "Invalid request data",
		},
		500: {
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
			description: "Internal server error",
		},
	},
});

app.openapi(submitContactMessageRoute, async (c) => {
	try {
		const { email, message, userId } = c.req.valid("json");
		const authenticatedUserId = c.get("userId") || null;

		// Validate email format if provided
		if (email && !isValidEmail(email)) {
			return c.json(
				{
					success: false,
					error: {
						code: "INVALID_EMAIL",
						message: "Invalid email format",
					},
				},
				400,
			);
		}

		// Get client IP address and detailed information
		const ipAddress = c.req.header("CF-Connecting-IP") || "unknown";

		// Get Cloudflare properties (geographic and network info)
		const rawRequest = c.req.raw;
		const cfProperties = rawRequest.cf || {};

		// Generate message ID
		const messageId = crypto.randomUUID();

		// Insert contact message
		// Use authenticated user ID if available, otherwise use provided userId
		const emailValue = email && typeof email === "string" && email.trim() ? email.trim() : null;
		const userIdValue =
			authenticatedUserId ||
			(userId && typeof userId === "string" && userId.trim() ? userId.trim() : null);

		const now = new Date().toISOString();
		await c.env.DB.prepare(
			`INSERT INTO contact_messages (id, user_id, email, message, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
		)
			.bind(messageId, userIdValue, emailValue, message, ipAddress, now)
			.run();

		logger.info(
			`Contact message submitted: ${messageId} from ${email || "anonymous"} (${ipAddress})`,
		);

		// Send Telegram notification for contact message
		try {
			const truncatedMessage = message.length > 200 ? `${message.substring(0, 200)}...` : message;

			// Build detailed IP information
			let ipInfo = "";
			if (ipAddress) {
				ipInfo += `IP: ${ipAddress}`;

				if (cfProperties) {
					const cf = cfProperties;
					if (cf.country) ipInfo += ` | Country: ${cf.country}`;
					if (cf.city) ipInfo += ` | City: ${cf.city}`;
					if (cf.region) ipInfo += ` | Region: ${cf.region}`;
					if (cf.timezone) ipInfo += ` | TZ: ${cf.timezone}`;
					if (cf.asOrganization) ipInfo += ` | ISP: ${cf.asOrganization}`;
				}
			}

			const telegramMessage = `📧 New Contact Message
${emailValue ? `Email: ${emailValue}` : "Email: Anonymous"}
${userIdValue ? `User ID: ${userIdValue}` : "User: Anonymous"}
${ipInfo || "IP: Unknown"}
────────────────────────
Message: ${truncatedMessage}`;

			await notifyTelegram(telegramMessage, "alerts");
		} catch (notificationError) {
			// Don't fail the contact message submission if notification fails
			await logger.warn(
				`Failed to send contact message Telegram notification for ${messageId}: ${notificationError instanceof Error ? notificationError.message : String(notificationError)}`,
			);
		}

		// Return success response
		return c.json(
			{
				success: true,
				data: {
					id: messageId,
					email,
					message,
					created_at: new Date().toISOString(),
				},
			},
			201,
		);
	} catch (error) {
		await logger.error(
			`Failed to submit contact message: ${error instanceof Error ? error.message : String(error)}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: "SUBMISSION_FAILED",
					message: "Failed to submit contact message",
				},
			},
			500,
		);
	}
});

// Get unread replies for logged-in user
const getMyRepliesRoute = createRoute({
	method: "get",
	path: "/my-replies",
	summary: "Get unread replies",
	description: "Get unread admin replies for the authenticated user",
	middleware: [authMiddleware] as const,
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							unreadMessages: z.array(
								z.object({
									id: z.string(),
									message: z.string(),
									admin_reply: z.string(),
									replied_at: z.string(),
									created_at: z.string(),
								}),
							),
							count: z.number(),
						}),
					}),
				},
			},
			description: "Unread replies retrieved successfully",
		},
		401: {
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
			description: "Unauthorized",
		},
		500: {
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
			description: "Internal server error",
		},
	},
});

app.openapi(getMyRepliesRoute, async (c) => {
	try {
		const userId = c.get("userId");

		// Get only unread messages for notification popup
		const unreadMessages = await c.env.DB.prepare(
			`SELECT id, message, admin_reply, replied_at, created_at
       FROM contact_messages
       WHERE user_id = ?
         AND admin_reply IS NOT NULL
         AND user_read_at IS NULL
       ORDER BY replied_at DESC`,
		)
			.bind(userId)
			.all();

		logger.info(`User ${userId} has ${unreadMessages.results?.length || 0} unread replies`);

		const unreadRows = ((unreadMessages.results ?? []) as Record<string, unknown>[]).map(
			(row) =>
				({
					id: row.id as string,
					message: row.message as string,
					admin_reply: row.admin_reply as string,
					replied_at: row.replied_at as string,
					created_at: row.created_at as string,
				}) satisfies UnreadReplyRow,
		);

		return c.json(
			{
				success: true,
				data: {
					unreadMessages: unreadRows,
					count: unreadRows.length,
				},
			},
			200,
		);
	} catch (error) {
		await logger.error(
			`Failed to fetch unread messages: ${error instanceof Error ? error.message : String(error)}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: "INTERNAL_ERROR",
					message: "Failed to fetch unread messages",
				},
			},
			500,
		);
	}
});

// Mark message as read
const markMessageReadRoute = createRoute({
	method: "post",
	path: "/{id}/read",
	summary: "Mark message as read",
	description: "Mark an admin reply as read by the user",
	middleware: [authMiddleware] as const,
	request: {
		params: z.object({
			id: z.string(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							messageId: z.string(),
							readAt: z.string(),
						}),
					}),
				},
			},
			description: "Message marked as read successfully",
		},
		403: {
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
			description: "Forbidden - not your message",
		},
		404: {
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
			description: "Message not found",
		},
		500: {
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
			description: "Internal server error",
		},
	},
});

app.openapi(markMessageReadRoute, async (c) => {
	try {
		const messageId = c.req.param("id");
		const userId = c.get("userId");

		// Verify message belongs to this user
		const message = await c.env.DB.prepare(`SELECT id, user_id FROM contact_messages WHERE id = ?`)
			.bind(messageId)
			.first();

		if (!message) {
			return c.json(
				{
					success: false,
					error: {
						code: "NOT_FOUND",
						message: "Message not found",
					},
				},
				404,
			);
		}

		if (message.user_id !== userId) {
			return c.json(
				{
					success: false,
					error: {
						code: "FORBIDDEN",
						message: "You can only mark your own messages as read",
					},
				},
				403,
			);
		}

		// Mark as read
		const now = new Date().toISOString();
		await c.env.DB.prepare(`UPDATE contact_messages SET user_read_at = ? WHERE id = ?`)
			.bind(now, messageId)
			.run();

		logger.info(`User ${userId} marked message ${messageId} as read`);

		return c.json(
			{
				success: true,
				data: {
					messageId,
					readAt: now,
				},
			},
			200,
		);
	} catch (error) {
		await logger.error(
			`Failed to mark message as read: ${error instanceof Error ? error.message : String(error)}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: "INTERNAL_ERROR",
					message: "Failed to mark message as read",
				},
			},
			500,
		);
	}
});

// Get message history (all messages with replies, both read and unread)
const getMessageHistoryRoute = createRoute({
	method: "get",
	path: "/history",
	middleware: [authMiddleware] as const,
	request: {
		query: z.object({
			limit: z.string().optional().default("20"),
			offset: z.string().optional().default("0"),
			filter: z.enum(["all", "unread", "read"]).optional().default("all"),
			search: z.string().optional(),
		}),
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							messages: z.array(
								z.object({
									id: z.string(),
									message: z.string(),
									admin_reply: z.string().nullable(),
									replied_at: z.string().nullable(),
									created_at: z.string(),
									user_read_at: z.string().nullable(),
								}),
							),
							total: z.number(),
							unreadCount: z.number(),
							limit: z.number(),
							offset: z.number(),
							hasMore: z.boolean(),
						}),
					}),
				},
			},
			description: "Message history retrieved successfully",
		},
		401: {
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
			description: "Unauthorized",
		},
		500: {
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
			description: "Internal server error",
		},
	},
});

app.openapi(getMessageHistoryRoute, async (c) => {
	try {
		const userId = c.get("userId");
		const { limit: limitStr, offset: offsetStr, filter, search } = c.req.valid("query");

		const limit = Math.min(Number(limitStr), 100);
		const offset = Number(offsetStr);

		// Build WHERE clause based on filter
		let whereClause = "user_id = ? AND admin_reply IS NOT NULL";
		const bindings: any[] = [userId];

		if (filter === "unread") {
			whereClause += " AND user_read_at IS NULL";
		} else if (filter === "read") {
			whereClause += " AND user_read_at IS NOT NULL";
		}

		// Add search filter if provided
		if (search) {
			whereClause += " AND (message LIKE ? OR admin_reply LIKE ?)";
			const searchPattern = `%${search}%`;
			bindings.push(searchPattern, searchPattern);
		}

		// Get total count
		const countResult = await c.env.DB.prepare(
			`SELECT COUNT(*) as total FROM contact_messages WHERE ${whereClause}`,
		)
			.bind(...bindings)
			.first();

		const total = Number(countResult?.total) || 0;

		// Get unread count
		const unreadResult = await c.env.DB.prepare(
			`SELECT COUNT(*) as count FROM contact_messages
       WHERE user_id = ? AND admin_reply IS NOT NULL AND user_read_at IS NULL`,
		)
			.bind(userId)
			.first();

		const unreadCount = Number(unreadResult?.count) || 0;

		// Get paginated messages
		const messages = await c.env.DB.prepare(
			`SELECT id, message, admin_reply, replied_at, created_at, user_read_at
       FROM contact_messages
       WHERE ${whereClause}
       ORDER BY replied_at DESC
       LIMIT ? OFFSET ?`,
		)
			.bind(...bindings, limit, offset)
			.all();

		logger.info(
			`User ${userId} retrieved message history: ${messages.results?.length || 0} of ${total}`,
		);

		const messageRows = ((messages.results ?? []) as Record<string, unknown>[]).map(
			(row) =>
				({
					id: row.id as string,
					message: row.message as string,
					admin_reply: (row.admin_reply as string | null) ?? null,
					replied_at: (row.replied_at as string | null) ?? null,
					created_at: row.created_at as string,
					user_read_at: (row.user_read_at as string | null) ?? null,
				}) satisfies MessageHistoryRow,
		);

		return c.json(
			{
				success: true,
				data: {
					messages: messageRows,
					total,
					unreadCount,
					limit,
					offset,
					hasMore: offset + limit < total,
				},
			},
			200,
		);
	} catch (error) {
		await logger.error(
			`Failed to fetch message history: ${error instanceof Error ? error.message : String(error)}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: "INTERNAL_ERROR",
					message: "Failed to fetch message history",
				},
			},
			500,
		);
	}
});

export default app;
