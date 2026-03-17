/**
 * Admin Contact Messages Routes
 * Admin endpoints for managing contact messages with reply functionality
 */

import { Hono } from "hono";
import { z } from "zod";
import { EmailService } from "../../services/email-service";
import type { AppEnv } from "../../types/hono";
import { logger } from "../../utils/logger";
import { notifyTelegram } from "../../utils/telegram-notifier";

const app = new Hono<AppEnv>();

// Validation schemas
const ReplyMessageSchema = z.object({
	message: z.string().min(1, "Reply message is required").max(5000),
	sendEmail: z.boolean().default(false), // Optional email notification
});

// Get contact messages with pagination and statistics
app.get("/", async (c) => {
	try {
		logger.info("Admin fetching contact messages");

		const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
		const offset = Number(c.req.query("offset")) || 0;

		// Get total count
		const countResult = await c.env.DB.prepare(
			`SELECT COUNT(*) as total FROM contact_messages`,
		).first();

		const total = Number(countResult?.total) || 0;

		// Get statistics by reply status
		const statsResult = await c.env.DB.prepare(
			`SELECT
        COUNT(CASE WHEN admin_reply IS NULL THEN 1 END) as pending,
        COUNT(CASE WHEN admin_reply IS NOT NULL THEN 1 END) as replied,
        COUNT(CASE WHEN admin_reply IS NOT NULL AND user_read_at IS NOT NULL THEN 1 END) as read_by_user
       FROM contact_messages`,
		).first();

		const stats = {
			pending: Number(statsResult?.pending) || 0,
			replied: Number(statsResult?.replied) || 0,
			readByUser: Number(statsResult?.read_by_user) || 0,
		};

		// Get paginated messages
		const messages = await c.env.DB.prepare(
			`SELECT id, user_id, email, message, ip_address, admin_reply, replied_at, user_read_at, created_at
       FROM contact_messages
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
		)
			.bind(limit, offset)
			.all();

		logger.info(`Contact messages retrieved: ${messages.results?.length || 0} of ${total}`);

		return c.json({
			success: true,
			data: {
				messages: messages.results || [],
				total,
				stats,
				limit,
				offset,
				hasMore: offset + limit < total,
			},
		});
	} catch (error) {
		await logger.error(
			`Failed to fetch contact messages: ${error instanceof Error ? error.message : String(error)}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: "INTERNAL_ERROR",
					message: "Failed to fetch contact messages",
				},
			},
			500,
		);
	}
});

// Reply to contact message
app.post("/:id/reply", async (c) => {
	try {
		const messageId = c.req.param("id");
		const body = await c.req.json();

		// Validate request body
		const validation = ReplyMessageSchema.safeParse(body);
		if (!validation.success) {
			return c.json(
				{
					success: false,
					error: {
						code: "VALIDATION_ERROR",
						message: validation.error.issues[0].message,
					},
				},
				400,
			);
		}

		const { message: replyMessage, sendEmail } = validation.data;

		// Get original message
		const originalMessage = await c.env.DB.prepare(
			`SELECT id, user_id, email, message, admin_reply
       FROM contact_messages
       WHERE id = ?`,
		)
			.bind(messageId)
			.first();

		if (!originalMessage) {
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

		// Only allow replies to logged-in users (with user_id)
		const userId = originalMessage.user_id as string | null;
		if (!userId) {
			return c.json(
				{
					success: false,
					error: {
						code: "ANONYMOUS_MESSAGE",
						message:
							"Cannot reply to anonymous messages. Anonymous messages are read-only feedback.",
					},
				},
				400,
			);
		}

		// Update message with reply
		const now = new Date().toISOString();
		await c.env.DB.prepare(
			`UPDATE contact_messages
       SET admin_reply = ?, replied_at = ?
       WHERE id = ?`,
		)
			.bind(replyMessage, now, messageId)
			.run();

		// Send optional email notification
		let emailSent = false;
		const userEmail = originalMessage.email as string | null;
		if (sendEmail && userEmail) {
			const emailService = new EmailService(c.env);
			emailSent = await emailService.sendContactReplyEmail(
				userEmail,
				originalMessage.message as string,
				replyMessage,
				messageId,
			);
		}

		// Send Telegram notification
		try {
			const telegramMessage = `💬 Admin Reply Sent
Message ID: ${messageId}
User ID: ${userId}
Email: ${userEmail || "Not provided"}
Email Sent: ${emailSent ? "✅ Yes" : "❌ No (in-app only)"}
────────────────────────
Reply: ${replyMessage.length > 200 ? `${replyMessage.substring(0, 200)}...` : replyMessage}`;

			await notifyTelegram(telegramMessage);
		} catch (notificationError) {
			logger.warn(
				`Failed to send Telegram notification: ${notificationError instanceof Error ? notificationError.message : String(notificationError)}`,
			);
		}

		logger.info(
			`Admin replied to message ${messageId} from user ${userId}, email sent: ${emailSent}`,
		);

		return c.json({
			success: true,
			data: {
				messageId,
				userId,
				emailSent,
				repliedAt: now,
			},
		});
	} catch (error) {
		await logger.error(
			`Failed to reply to message: ${error instanceof Error ? error.message : String(error)}`,
		);

		return c.json(
			{
				success: false,
				error: {
					code: "INTERNAL_ERROR",
					message: "Failed to send reply",
				},
			},
			500,
		);
	}
});

export default app;
