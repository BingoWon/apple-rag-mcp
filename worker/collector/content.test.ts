import assert from "node:assert/strict";
import test from "node:test";
import { chunkText } from "./Chunker.js";
import { ContentProcessor } from "./ContentProcessor.js";
import type { AppleAPIResponse } from "./types/index.js";

test("Apple inline nodes retain meaning in abstracts and nested paragraphs", async () => {
	const inlineContent = [
		{ type: "text", text: "does " },
		{
			type: "strong",
			inlineContent: [{ type: "emphasis", inlineContent: [{ type: "text", text: "not" }] }],
		},
		{ type: "text", text: " bridge to " },
		{ type: "reference", identifier: "s" },
	];
	const long = `/documentation/foundation/calendar/${"a".repeat(190)}`;
	const data = {
		metadata: { title: "Array" },
		abstract: inlineContent,
		primaryContentSections: [{ kind: "content", content: [{ type: "paragraph", inlineContent }] }],
		references: {
			s: { title: "Foundation", url: long },
			long: { url: long + "b".repeat(2048) },
			other: { url: "https://developer.apple.com.example/documentation/x" },
		},
	};
	const [page] = await new ContentProcessor().processDocuments([
		{
			url: "https://developer.apple.com/documentation/swift/array",
			data: data as unknown as AppleAPIResponse,
		},
	]);
	assert.match(page.data!.title!, /does not bridge to `Foundation`/);
	assert.equal(page.data!.content, "does not bridge to `Foundation`");
	assert.deepEqual(page.data!.extractedUrls, [`https://developer.apple.com${long}`]);
});

test("headings and short fenced examples stay intact and long bodies stay bounded", () => {
	const heading = "## Important";
	const code = `\`\`\`swift\n${"let a = 1\n".repeat(110)}\`\`\``;
	for (const text of [
		`${"a".repeat(2480)}\n${heading}\n${"b".repeat(2480)}`,
		`${"a".repeat(1900)}\n${code}\n${"b".repeat(2100)}`,
		"x".repeat(25000),
	]) {
		const chunks = chunkText(text, null);
		assert.ok(chunks.length > 1);
		assert.equal(
			chunks
				.map((c) => c.content)
				.join("")
				.replace(/\s/g, ""),
			text.replace(/\s/g, ""),
		);
		assert.ok(
			chunks.every(
				(c, i) =>
					c.total_chunks === chunks.length && c.chunk_index === i && c.content.length < 4000,
			),
		);
		if (text.includes(code)) assert.ok(chunks.some((c) => c.content.includes(code)));
		if (text.includes(heading)) assert.ok(chunks[1].content.startsWith(heading));
	}
});
