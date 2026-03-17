/**
 * Email service using Resend API
 */
import { Resend } from "resend";
import type { Env } from "../../shared/types.js";
import { logger } from "../utils/logger.js";

export interface EmailTemplate {
	subject: string;
	html: string;
}

/**
 * Escape HTML special characters to prevent XSS attacks
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

export class EmailService {
	private resend: Resend | null;
	private fromEmail: string;

	constructor(env: Env) {
		this.fromEmail = env.RESEND_FROM_EMAIL || "noreply@apple-rag.com";
		this.resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

		// Debug logging
		logger.info(
			`[EmailService] Initialized with API key: ${env.RESEND_API_KEY ? "✅ Present" : "❌ Missing"}`,
		);
		logger.info(`[EmailService] From email: ${this.fromEmail}`);
	}

	/**
	 * Send password reset email using Resend API
	 */
	async sendPasswordResetEmail(
		to: string,
		resetToken: string,
		frontendUrl: string,
	): Promise<boolean> {
		try {
			if (!this.resend) {
				logger.warn("[EmailService] Resend API key not configured, skipping email send");
				logger.info(`📧 Password reset email would be sent to: ${to}`);
				logger.info(`📧 Reset URL: ${frontendUrl}/reset-password?token=${resetToken}`);
				return false;
			}

			const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

			const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Apple RAG MCP</h1>
          </div>

          <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
            <h2 style="color: #1e293b; margin-top: 0;">Reset Your Password</h2>
            <p style="margin-bottom: 20px;">We received a request to reset your password. Click the button below to create a new password:</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 500;">Reset Password</a>
            </div>

            <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">This link will expire in 1 hour for security reasons.</p>
          </div>

          <div style="text-align: center; color: #64748b; font-size: 12px;">
            <p>If you didn't request this password reset, you can safely ignore this email.</p>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
          </div>
        </body>
        </html>
      `;

			const result = await this.resend.emails.send({
				from: this.fromEmail,
				to: [to],
				subject: "Reset Your Password - Apple RAG MCP",
				html: emailHtml,
			});

			if (result.error) {
				await logger.error(`[EmailService] Resend API error: ${JSON.stringify(result.error)}`);
				return false;
			}

			logger.info(`📧 Password reset email sent successfully to: ${to}`);
			logger.info(`📧 Email ID: ${result.data?.id}`);
			return true;
		} catch (error) {
			await logger.error(
				`[EmailService] Unexpected error for ${to}: ${error instanceof Error ? error.message : String(error)}`,
			);
			return false;
		}
	}

	/**
	 * Send contact message reply email
	 */
	async sendContactReplyEmail(
		to: string,
		originalMessage: string,
		replyMessage: string,
		messageId: string,
	): Promise<boolean> {
		try {
			logger.info(`[EmailService] Attempting to send email to: ${to}`);
			logger.info(`[EmailService] Resend instance: ${this.resend ? "✅ Available" : "❌ Null"}`);

			if (!this.resend) {
				logger.warn("[EmailService] Resend API key not configured, skipping email send");
				logger.info(`📧 Contact reply email would be sent to: ${to}`);
				return false;
			}

			// Escape HTML to prevent XSS attacks
			const safeOriginalMessage = escapeHtml(originalMessage);
			const safeReplyMessage = escapeHtml(replyMessage);

			const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reply to Your Message</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">Apple RAG MCP Support</h1>
          </div>

          <div style="background: #f8fafc; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
            <h2 style="color: #1e293b; margin-top: 0;">We've Replied to Your Message</h2>

            <div style="margin-bottom: 24px;">
              <p style="color: #64748b; font-size: 14px; margin-bottom: 8px; font-weight: 500;">Your Original Message:</p>
              <div style="background: white; border-left: 3px solid #cbd5e1; padding: 12px 16px; border-radius: 4px;">
                <p style="margin: 0; color: #475569;">${safeOriginalMessage}</p>
              </div>
            </div>

            <div style="margin-bottom: 24px;">
              <p style="color: #1e293b; font-size: 14px; margin-bottom: 8px; font-weight: 600;">Our Reply:</p>
              <div style="background: white; border-left: 3px solid #2563eb; padding: 12px 16px; border-radius: 4px;">
                <p style="margin: 0; color: #1e293b; white-space: pre-wrap;">${safeReplyMessage}</p>
              </div>
            </div>

            <p style="color: #64748b; font-size: 14px; margin-bottom: 0;">
              If you have any further questions, feel free to send us another message through our website.
            </p>
          </div>

          <div style="text-align: center; color: #64748b; font-size: 12px;">
            <p>Message ID: ${messageId}</p>
            <p>This is an automated email from Apple RAG MCP Support.</p>
          </div>
        </body>
        </html>
      `;

			const result = await this.resend.emails.send({
				from: this.fromEmail,
				to: [to],
				subject: "Reply to Your Message - Apple RAG MCP Support",
				html: emailHtml,
				replyTo: this.fromEmail,
			});

			if (result.error) {
				await logger.error(`[EmailService] Resend API error: ${JSON.stringify(result.error)}`);
				return false;
			}

			logger.info(`📧 Contact reply email sent successfully to: ${to}`);
			logger.info(`📧 Email ID: ${result.data?.id}`);
			return true;
		} catch (error) {
			await logger.error(
				`[EmailService] Unexpected error for ${to}: ${error instanceof Error ? error.message : String(error)}`,
			);
			return false;
		}
	}
}
