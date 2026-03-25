import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../types/hono";

/**
 * Creates an OpenAPIHono instance with a defaultHook that converts
 * Zod validation errors into a consistent {success, error} format
 * instead of leaking raw Zod issue arrays to the client.
 */
export function createOpenAPIApp() {
	return new OpenAPIHono<AppEnv>({
		defaultHook: (result, c) => {
			if (!result.success) {
				const firstMessage = result.error.issues?.[0]?.message || "Invalid request data";
				return c.json(
					{
						success: false,
						error: { code: "VALIDATION_ERROR", message: firstMessage },
					},
					400,
				);
			}
		},
	});
}
