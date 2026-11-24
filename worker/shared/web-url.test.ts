import assert from "node:assert/strict";
import test from "node:test";
import { readText } from "./read-text.js";
import {
	assertPublicHost,
	canCacheUrl,
	isAppleUrl,
	isPublicAddress,
	publicUrl,
} from "./web-url.js";

test("URL identities preserve queries and case outside Apple documentation", () => {
	assert.equal(
		publicUrl("https://developer.apple.com/news/?id=abc#heading"),
		"https://developer.apple.com/news/?id=abc",
	);
	assert.equal(
		publicUrl("http://Developer.Apple.com/documentation/SwiftUI/"),
		"https://developer.apple.com/documentation/swiftui",
	);
	assert.equal(
		publicUrl("https://docs.example.com/Case/?id=AbC#heading"),
		"https://docs.example.com/Case/?id=AbC",
	);
	assert.equal(canCacheUrl("https://docs.example.com/?token=private"), false);
	assert.equal(isAppleUrl("https://developer.apple.com.attacker.com/"), false);
});

test("private, reserved and mapped addresses are not public destinations", () => {
	for (const address of [
		"127.0.0.1",
		"10.0.0.1",
		"169.254.169.254",
		"172.16.0.1",
		"192.168.0.1",
		"192.0.2.1",
		"198.18.0.1",
		"198.51.100.1",
		"203.0.113.1",
		"100.64.0.1",
		"224.0.0.1",
		"::1",
		"::ffff:127.0.0.1",
		"fd00::1",
		"fe80::1",
		"2001:db8::1",
		"2002:7f00:1::1",
	])
		assert.equal(isPublicAddress(address), false, address);
	for (const address of [
		"8.8.8.8",
		"1.1.1.1",
		"2606:4700:4700::1111",
		"2001:4860:4860::8888",
		"192.0.73.1",
	])
		assert.equal(isPublicAddress(address), true, address);
});

test("streamed response limits are enforced even without Content-Length", async () => {
	assert.equal(await readText(new Response("Hello"), 5), "Hello");
	await assert.rejects(readText(new Response("Too large"), 5), /size limit/);
	await assert.rejects(
		readText(new Response("Hello", { headers: { "content-length": "100" } }), 5),
		/size limit/,
	);
});

test("assertPublicHost tolerates AAAA failure for IPv4-only hosts while rejecting dual-stack private IPv6", async (t) => {
	t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
		const url = String(input);
		if (url.includes("type=AAAA")) return Response.json({ Status: 4 }); // NOTIMP
		return Response.json({ Status: 0, Answer: [{ type: 1, data: "93.184.216.34" }] });
	});
	await assert.doesNotReject(() =>
		assertPublicHost("https://docs.swift.org/guide", new AbortController().signal),
	);

	t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
		const url = String(input);
		if (url.includes("type=AAAA"))
			return Response.json({ Status: 0, Answer: [{ type: 28, data: "fd00::1" }] });
		return Response.json({ Status: 0, Answer: [{ type: 1, data: "93.184.216.34" }] });
	});
	await assert.rejects(
		() => assertPublicHost("https://docs.swift.org/guide", new AbortController().signal),
		/not a public website/,
	);
});
