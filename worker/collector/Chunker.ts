const TARGET_SIZE = 2500;
const SEARCH_RADIUS = 250;

export function chunkText(text: string, title: string | null) {
	const content = text.trim();
	if (!content) return [];
	if (content.length < 1.5 * TARGET_SIZE)
		return [{ title, content, chunk_index: 0, total_chunks: 1 }];
	const blocks: string[] = [];
	// Only line starts can introduce Markdown headings and fenced code.
	const boundaries: { pos: number; priority: number }[] = [];
	let fence = "";
	for (const match of content.matchAll(/^.*$/gm)) {
		const line = match[0];
		const pos = match.index;
		const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
		if (fence) {
			if (marker && marker[1]!.startsWith(fence) && !marker[2]!.trim()) {
				fence = "";
				boundaries.push({ pos: pos + line.length, priority: 1 });
			}
			continue;
		}
		if (marker) fence = marker[1]!;
		boundaries.push({
			pos,
			priority: /^ {0,3}#{1,6}\s/.test(line) ? 0 : !line.trim() || marker ? 1 : 2,
		});
	}

	let start = 0;
	let cursor = 0;
	while (content.length - start >= 1.5 * TARGET_SIZE) {
		const remaining = content.length - start;
		const target = start + Math.round(remaining / Math.round(remaining / TARGET_SIZE));
		while (cursor < boundaries.length && boundaries[cursor]!.pos < target - SEARCH_RADIUS) cursor++;
		let best: (typeof boundaries)[number] | undefined;
		for (
			let i = cursor;
			i < boundaries.length && boundaries[i]!.pos <= target + SEARCH_RADIUS;
			i++
		) {
			const point = boundaries[i]!;
			if (
				!best ||
				point.priority < best.priority ||
				(point.priority === best.priority &&
					Math.abs(point.pos - target) < Math.abs(best.pos - target))
			)
				best = point;
		}
		let end = best?.pos;
		if (end === undefined) {
			// Move a reasonably sized fenced block intact, and bound exceptionally long blocks.
			const previous = boundaries[cursor - 1]?.pos;
			const next = boundaries[cursor]?.pos;
			if (
				previous !== undefined &&
				previous >= start &&
				next !== undefined &&
				next - previous <= TARGET_SIZE &&
				next - previous > SEARCH_RADIUS * 2 &&
				/^ {0,3}(?:`{3,}|~{3,})/.test(content.slice(previous, previous + 8))
			) {
				end = previous > start && target - previous < next - target ? previous : next;
			} else {
				const window = content.slice(target - SEARCH_RADIUS, target + SEARCH_RADIUS);
				const offset = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
				end = offset < 0 ? target : target - SEARCH_RADIUS + offset + 1;
			}
		}
		const block = content.slice(start, end).trim();
		if (block) blocks.push(block);
		start = end;
	}
	const last = content.slice(start).trim();
	if (last) blocks.push(last);
	return blocks.map((body, chunk_index) => ({
		title,
		content: body,
		chunk_index,
		total_chunks: blocks.length,
	}));
}
