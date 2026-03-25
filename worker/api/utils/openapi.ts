import { OpenAPIHono } from "@hono/zod-openapi";
import { ApiErrorCode } from "../constants/error-codes";
import type { AppEnv } from "../types/hono";

export function createOpenAPIApp() {
	return new OpenAPIHono<AppEnv>({
		defaultHook: (result, c) => {
			if (!result.success) {
				const firstMessage = result.error.issues?.[0]?.message || "Invalid request data";
				return c.json(
					{
						success: false,
						error: { code: ApiErrorCode.VALIDATION_ERROR, message: firstMessage },
					},
					400,
				);
			}
		},
	});
}
