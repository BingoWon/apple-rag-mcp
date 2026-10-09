import assert from "node:assert/strict";
import { createRequire } from "node:module";

const sharp = createRequire(import.meta.url)("sharp");
const source = new URL("./assets/og-base.png", import.meta.url);
const destination = new URL("../../public/og-image-jev.png", import.meta.url);
const logo = new URL("../../public/typesafe-logo.webp", import.meta.url);
const { width, height } = await sharp(source.pathname).metadata();
assert.equal(width, 1200);
assert.equal(height, 630);

const textImage = (text, color = "#dddddd") =>
	sharp({
		text: {
			text: `<span foreground="${color}">${text}</span>`,
			font: "Arial Bold 24",
			rgba: true,
		},
	})
		.png()
		.toBuffer({ resolveWithObject: true });

const first = await textImage("RAG retrieves official Apple docs and WWDC transcripts.");
const name = await textImage("Jev", "#ffffff");
const shadow = await textImage("Jev", "#E650BB");
const rest = await textImage("ranks relevant sources for your AI agents.");
const logoSize = 26;
const secondLeft = Math.round((width - logoSize - 8 - name.info.width - 7 - rest.info.width) / 2);
const secondTop = 420;

const logoBuffer = await sharp(logo.pathname)
	.resize(logoSize, logoSize)
	.composite([
		{
			input: Buffer.from(
				`<svg width="${logoSize}" height="${logoSize}"><rect width="${logoSize}" height="${logoSize}" rx="4" fill="white"/></svg>`,
			),
			blend: "dest-in",
		},
	])
	.png()
	.toBuffer();

const original = await sharp(source.pathname).removeAlpha().raw().toBuffer();
const background = Buffer.from(original);
// Reconstruct the blank background between rows outside the old subtitle.
for (let y = 356; y < 461; y++) {
	const progress = (y - 355) / (461 - 355);
	for (let x = 0; x < width * 3; x++) {
		background[y * width * 3 + x] = Math.round(
			original[355 * width * 3 + x] * (1 - progress) + original[461 * width * 3 + x] * progress,
		);
	}
}

await sharp(background, { raw: { width, height, channels: 3 } })
	.composite([
		{ input: first.data, top: 383, left: Math.round((width - first.info.width) / 2) },
		{ input: logoBuffer, top: secondTop - 2, left: secondLeft },
		{ input: shadow.data, top: secondTop + 2, left: secondLeft + logoSize + 10 },
		{ input: name.data, top: secondTop, left: secondLeft + logoSize + 8 },
		{ input: rest.data, top: secondTop, left: secondLeft + logoSize + 15 + name.info.width },
	])
	.png()
	.toFile(destination.pathname);

const rendered = await sharp(destination.pathname).removeAlpha().raw().toBuffer();
assert.deepEqual(rendered.subarray(0, 356 * width * 3), original.subarray(0, 356 * width * 3));
assert.deepEqual(rendered.subarray(461 * width * 3), original.subarray(461 * width * 3));
console.log("Open Graph image rendered: 1200x630; headline and buttons preserved.");
