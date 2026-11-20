import { z } from "zod";

const percent = z.number().min(0).max(100);
const settings = z.object({
	range: z
		.tuple([percent, percent])
		.refine(([start, end]) => start < end)
		.nullable(),
	upright: z.number().min(13).max(100),
	height: z.number().min(100).max(600).nullable(),
	aspect: z.enum(["original", "video"]),
	fit: z.enum(["contain", "fill", "cover"]),
});
export type HeroPreview = z.infer<typeof settings>;
export const original: HeroPreview = {
	range: null,
	upright: 30,
	height: null,
	aspect: "original",
	fit: "contain",
};
export const storageKey = "apple-rag.dev.hero.5.14.2.v1";
export function loadPreview(): HeroPreview {
	try {
		const result = settings.safeParse(JSON.parse(localStorage.getItem(storageKey) ?? "null"));
		if (result.success) return result.data;
	} catch {
		/* Storage can be unavailable in private browsing. */
	}
	return original;
}
