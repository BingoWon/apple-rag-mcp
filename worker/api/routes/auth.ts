/**
 * Authentication routes
 */
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { authMiddleware } from "../middleware/auth";
import { AuthService } from "../services/auth-service";
import type { User } from "../types";
import type { AppEnv } from "../types/hono";
import { notifyTelegram } from "../utils/telegram-notifier";
// Removed unused imports for simplified implementation
import {
	forgotPasswordSchema,
	loginSchema,
	registerSchema,
	resetPasswordSchema,
} from "../utils/validation";

const app = new OpenAPIHono<AppEnv>();

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
		409: {
			description: "Email already exists",
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
	tags: ["Authentication"],
});

app.openapi(registerRoute, async (c) => {
	const request = c.req.valid("json");
	const authService = new AuthService(c.env.DB, c.env);

	const result = await authService.registerUser(request);

	if (result.success) {
		// Send Telegram notification for successful registration
		await notifyTelegram(`👤 New User Registration\nEmail: ${request.email}`);

		return c.json({ success: true, data: result.data }, 201);
	} else {
		const status = result.error?.code === "EMAIL_ALREADY_EXISTS" ? 409 : 400;
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
	tags: ["Authentication"],
});

app.openapi(loginRoute, async (c) => {
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
			401,
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
			description: "Invalid request",
		},
	},
	tags: ["Authentication"],
});

app.openapi(forgotPasswordRoute, async (c) => {
	const { email } = c.req.valid("json");
	const authService = new AuthService(c.env.DB, c.env);
	const origin = new URL(c.req.url).origin;

	const result = await authService.forgotPassword(email, origin);

	if (result.success) {
		return c.json(result, 200);
	} else {
		return c.json(result, 400);
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
			description: "Invalid reset token",
		},
	},
	tags: ["Authentication"],
});

app.openapi(resetPasswordRoute, async (c) => {
	const { token, password } = c.req.valid("json");
	const authService = new AuthService(c.env.DB, c.env);

	const result = await authService.resetPassword(token, password);

	if (result.success) {
		return c.json(result, 200);
	} else {
		return c.json(result, 400);
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
