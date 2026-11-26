import type { z } from "zod";

export type FieldErrors<T extends Record<string, unknown>> = Partial<Record<keyof T, string>>;

export function validateWithSchema<T extends Record<string, unknown>>(
	schema: z.ZodType<T>,
	values: unknown,
): { ok: true; data: T } | { ok: false; errors: FieldErrors<T> } {
	const parsed = schema.safeParse(values);
	if (parsed.success) {
		return { ok: true, data: parsed.data };
	}
	const errors: FieldErrors<T> = {};
	for (const issue of parsed.error.issues) {
		const field = issue.path[0] as keyof T | undefined;
		if (field && !errors[field]) {
			errors[field] = issue.message;
		}
	}
	return { ok: false, errors };
}
