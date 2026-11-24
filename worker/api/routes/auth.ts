/**
 * Authentication routes
 */
import { createRoute, z } from "@hono/zod-openapi";
import { extractClientInfo } from "../../services/request-info";
import { authMiddleware } from "../middleware/auth";
import { AuthService } from "../services/auth-service";
import type { User } from "../types";
import { checkIpRateLimit } from "../utils/ip-rate-limit";
import { createOpenAPIApp } from "../utils/openapi";
import { notifyTelegram } from "../utils/telegram-notifier";
import {
	forgotPasswordSchema,
	loginSchema,
	registerSchema,
	resetPasswordSchema,
} from "../utils/validation";

const app = createOpenAPIApp();

// Response schemas
const UserSchema = z.object({
	id: z.string(),
	email: z.string(),
	name: z.string().optional(),
	avatar: z.string().optional(),
	plan_type: z.string(),
	created_at: z.string(),
});

const AuthDataSchema = z.object({
	user: UserSchema,
	token: z.string(),
	expires_at: z.string(),
});

app.post("/logout", authMiddleware, async (c) => {
	await c.env.DB.prepare("DELETE FROM web_sessions WHERE id=? AND user_id=?")
		.bind(c.get("webSessionId"), c.get("userId"))
		.run();
	return c.json({ success: true });
});

const AuthErrorSchema = z.object({
	success: z.boolean(),
	error: z.object({ code: z.string(), message: z.string() }),
});

// Register route (modernized)
const registerRoute = createRoute({
	method: "post",
	path: "/register",
	request: {
		body: {
			content: {
				"application/json": {
					schema: registerSchema,
				},
			},
		},
	},
	responses: {
		500: {
			description: "Authentication service unavailable",
			content: { "application/json": { schema: AuthErrorSchema } },
		},
		201: {
			description: "User registered successfully",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: AuthDataSchema,
					}),
				},
			},
		},
		400: {
			description: "Bad request",
			content: {
				"application/json": {
					schema: AuthErrorSchema,
				},
			},
		},
		409: {
			description: "Email already exists",
			content: {
				"application/json": {
					schema: AuthErrorSchema,
				},
			},
		},
		429: {
			description: "Too many requests",
			content: { "application/json": { schema: AuthErrorSchema } },
		},
	},
	tags: ["Authentication"],
});

app.openapi(registerRoute, async (c) => {
	const ip = extractClientInfo(c.req.raw).ip;
	if (!(await checkIpRateLimit(c.env.DB, ip, "register", 10))) {
		return c.json(
			{
				success: false,
				error: {
					code: "RATE_LIMIT_EXCEEDED",
					message: "Too many registration attempts. Please try again in a minute.",
				},
			},
			429,
		);
	}

	const request = c.req.valid("json");
	const authService = new AuthService(c.env.DB, c.env);

	const result = await authService.registerUser(request);

	if (result.success) {
		// Send Telegram notification for successful registration
		await notifyTelegram(`👤 New User Registration\nEmail: ${request.email}`);

		return c.json({ success: true, data: result.data }, 201);
	} else {
		const status = result.error?.code === "EMAIL_ALREADY_EXISTS" ? 409 : 500;
		return c.json(
			{
				success: false,
				error: {
					code: result.error?.code || "UNKNOWN_ERROR",
					message: result.error?.message || "Registration failed",
				},
			},
			status,
		);
	}
});

// Login route (modernized)
const loginRoute = createRoute({
	method: "post",
	path: "/login",
	request: {
		body: {
			content: {
				"application/json": {
					schema: loginSchema,
				},
			},
		},
	},
	responses: {
		500: {
			description: "Authentication service unavailable",
			content: { "application/json": { schema: AuthErrorSchema } },
		},
		200: {
			description: "Login successful",
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: AuthDataSchema,
					}),
				},
			},
		},
		401: {
			description: "Invalid credentials",
			content: {
				"application/json": {
					schema: AuthErrorSchema,
				},
			},
		},
		429: {
			description: "Too many requests",
			content: { "application/json": { schema: AuthErrorSchema } },
		},
	},
	tags: ["Authentication"],
});

app.openapi(loginRoute, async (c) => {
	const ip = extractClientInfo(c.req.raw).ip;
	if (!(await checkIpRateLimit(c.env.DB, ip, "login", 15))) {
		return c.json(
			{
				success: false,
				error: {
					code: "RATE_LIMIT_EXCEEDED",
					message: "Too many sign-in attempts. Please try again in a minute.",
				},
			},
			429,
		);
	}

	const request = c.req.valid("json");
	const authService = new AuthService(c.env.DB, c.env);

	const result = await authService.loginUser(request);

	if (result.success) {
		return c.json({ success: true, data: result.data }, 200);
	} else {
		return c.json(
			{
				success: false,
				error: {
					code: result.error?.code || "UNKNOWN_ERROR",
					message: result.error?.message || "Login failed",
				},
			},
			result.error.code === "INVALID_CREDENTIALS" ? 401 : 500,
		);
	}
});

// Forgot password route
const forgotPasswordRoute = createRoute({
	method: "post",
	path: "/forgot-password",
	request: {
		body: {
			content: {
				"application/json": {
					schema: forgotPasswordSchema,
				},
			},
		},
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							message: z.string(),
						}),
					}),
				},
			},
			description: "Password reset email sent",
		},
		400: {
			content: { "application/json": { schema: AuthErrorSchema } },
			description: "Invalid request",
		},
		429: {
			content: { "application/json": { schema: AuthErrorSchema } },
			description: "Too many requests",
		},
		500: {
			content: { "application/json": { schema: AuthErrorSchema } },
			description: "Internal server error",
		},
	},
	tags: ["Authentication"],
});

app.openapi(forgotPasswordRoute, async (c) => {
	const ip = extractClientInfo(c.req.raw).ip;
	if (!(await checkIpRateLimit(c.env.DB, ip, "forgot_password", 5))) {
		return c.json(
			{
				success: false,
				error: {
					code: "RATE_LIMIT_EXCEEDED",
					message: "Too many password reset requests. Please try again in a minute.",
				},
			},
			429,
		);
	}

	const { email } = c.req.valid("json");
	const authService = new AuthService(c.env.DB, c.env);
	const origin = new URL(c.req.url).origin;

	const result = await authService.forgotPassword(email, origin);

	if (result.success) {
		return c.json(result, 200);
	} else {
		return c.json(result, result.error.code === "INTERNAL_ERROR" ? 500 : 400);
	}
});

// Reset password route
const resetPasswordRoute = createRoute({
	method: "post",
	path: "/reset-password",
	request: {
		body: {
			content: {
				"application/json": {
					schema: resetPasswordSchema,
				},
			},
		},
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							message: z.string(),
						}),
					}),
				},
			},
			description: "Password reset successfully",
		},
		400: {
			content: { "application/json": { schema: AuthErrorSchema } },
			description: "Invalid reset token",
		},
		429: {
			content: { "application/json": { schema: AuthErrorSchema } },
			description: "Too many requests",
		},
		500: {
			content: { "application/json": { schema: AuthErrorSchema } },
			description: "Internal server error",
		},
	},
	tags: ["Authentication"],
});

app.openapi(resetPasswordRoute, async (c) => {
	const ip = extractClientInfo(c.req.raw).ip;
	if (!(await checkIpRateLimit(c.env.DB, ip, "reset_password", 10))) {
		return c.json(
			{
				success: false,
				error: {
					code: "RATE_LIMIT_EXCEEDED",
					message: "Too many password reset attempts. Please try again in a minute.",
				},
			},
			429,
		);
	}

	const { token, password } = c.req.valid("json");
	const authService = new AuthService(c.env.DB, c.env);

	const result = await authService.resetPassword(token, password);

	if (result.success) {
		return c.json(result, 200);
	} else {
		return c.json(result, result.error.code === "INTERNAL_ERROR" ? 500 : 400);
	}
});

// Modern password change route (strict isolation - email users only)
const changePasswordSchema = z.object({
	currentPassword: z.string().min(1, "Current password is required"),
	newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

const changePasswordRoute = createRoute({
	method: "post",
	path: "/change-password",
	middleware: [authMiddleware],
	request: {
		body: {
			content: {
				"application/json": {
					schema: changePasswordSchema,
				},
			},
		},
	},
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							message: z.string(),
						}),
					}),
				},
			},
			description: "Password changed successfully",
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
			description: "Invalid request or operation not allowed",
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
			description: "Forbidden",
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
	tags: ["Authentication"],
});

app.openapi(changePasswordRoute, async (c) => {
	const { currentPassword, newPassword } = c.req.valid("json");
	const user = c.get("user") as User;
	const authService = new AuthService(c.env.DB, c.env);

	const result = await authService.changePassword(user.id, currentPassword, newPassword);

	if (result.success) {
		return c.json(result, 200);
	} else {
		const status =
			result.error?.code === "OPERATION_NOT_ALLOWED"
				? 403
				: result.error?.code === "INVALID_PASSWORD"
					? 400
					: 500;
		return c.json(result, status);
	}
});

// Get user authentication status route (strict isolation)
const getAuthStatusRoute = createRoute({
	method: "get",
	path: "/auth-status",
	middleware: [authMiddleware],
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						success: z.boolean(),
						data: z.object({
							provider: z.string(),
							canChangePassword: z.boolean(),
							authenticationMethod: z.string(),
						}),
					}),
				},
			},
			description: "Authentication status retrieved successfully",
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
	tags: ["Authentication"],
});

app.openapi(getAuthStatusRoute, async (c) => {
	const user = c.get("user") as User;
	const authService = new AuthService(c.env.DB, c.env);

	const result = await authService.getUserAuthStatus(user.id);

	if (result.success) {
		return c.json(result, 200);
	} else {
		return c.json(result, 500);
	}
});

// OAuth routes moved to separate oauth.ts file

// Health check route
app.get("/health", (c) => {
	return c.json({
		success: true,
		data: {
			service: "auth",
			status: "healthy",
			timestamp: new Date().toISOString(),
		},
	});
});

export { app as authRoutes };
