export function parsePagination(
	limitRaw: string | undefined,
	offsetRaw: string | undefined,
	defaultLimit = 50,
	maxLimit = 100,
): { limit: number; offset: number } {
	const parsedLimit = Number(limitRaw);
	const parsedOffset = Number(offsetRaw);
	const limit =
		Number.isFinite(parsedLimit) && parsedLimit > 0
			? Math.min(Math.floor(parsedLimit), maxLimit)
			: defaultLimit;
	const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? Math.floor(parsedOffset) : 0;
	return { limit, offset };
}
