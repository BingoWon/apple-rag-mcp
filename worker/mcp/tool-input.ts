import type { z } from "zod";
import { rejectOperation } from "../services/tool-service.js";
import type { AuthContext, Services } from "../services/types.js";

// Observe SDK validation without changing discovery schemas or parsing protocol envelopes.
export function loggedToolInput<T extends z.ZodObject>(
	name: "search" | "fetch" | "browse",
	schema: T,
	services: Services,
	auth: AuthContext,
	request: Request,
) {
	return {
		"~standard": {
			...schema["~standard"],
			validate(input: unknown) {
				const result = schema.safeParse(input);
				if (result.success) return { value: result.data };
				rejectOperation(services.logger, name, input, auth, request, "mcp");
				return { issues: result.error.issues };
			},
		},
	};
}
