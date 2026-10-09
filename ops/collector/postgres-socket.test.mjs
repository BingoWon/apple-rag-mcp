import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { net } from "../../node_modules/postgres/cf/polyfills.js";

const segmentBytes = 32768;

function payload(bytes, seed = 0) {
	return Buffer.from(Array.from({ length: bytes }, (_, index) => (index + seed) % 251));
}

for (const bytes of [0, 1, 32768, 32769, 65536, 65537, 85519, 262144]) {
	test(`Cloudflare PostgreSQL transport preserves all ${bytes} bytes with bounded writes`, async () => {
		const socket = net.Socket();
		const writes = [];
		let callbacks = 0;
		socket.writer = {
			async write(data) {
				assert.ok(data.byteLength <= segmentBytes, "socket writes must not exceed 32 KiB");
				writes.push(Buffer.from(data));
			},
		};
		const errors = [];
		socket.on("error", (error) => errors.push(error));
		const data = payload(bytes);
		assert.equal(
			socket.write(data, () => {
				callbacks++;
			}),
			true,
		);
		await setImmediate();

		assert.deepEqual(errors, []);
		assert.deepEqual(Buffer.concat(writes), data);
		assert.equal(callbacks, 1);
	});
}

test("Cloudflare PostgreSQL transport serializes overlapping writes and their callbacks", async () => {
	const socket = net.Socket();
	const firstWrite = Promise.withResolvers();
	const writes = [];
	const callbacks = [];
	socket.writer = {
		async write(data) {
			writes.push(Buffer.from(data));
			if (writes.length === 1) await firstWrite.promise;
		},
	};
	const first = payload(85519);
	const second = payload(65691, 7);
	socket.write(first, () => callbacks.push("first"));
	socket.write(second, () => callbacks.push("second"));
	await setImmediate();
	const writesBeforeRelease = writes.length;
	const callbacksBeforeRelease = [...callbacks];
	firstWrite.resolve();
	await setImmediate();

	assert.equal(writesBeforeRelease, 1, "the next packet must wait for the current packet");
	assert.deepEqual(callbacksBeforeRelease, []);
	assert.ok(writes.every((data) => data.byteLength <= segmentBytes));
	assert.deepEqual(Buffer.concat(writes), Buffer.concat([first, second]));
	assert.deepEqual(callbacks, ["first", "second"]);
});

test("Cloudflare PostgreSQL transport stops queued writes after a segment fails", async () => {
	const socket = net.Socket();
	const failure = new Error("writer disconnected");
	const errors = [];
	let closes = 0;
	let writes = 0;
	let callbacks = 0;
	socket.on("error", (error) => errors.push(error));
	socket.on("close", () => closes++);
	socket.writer = {
		async write() {
			if (++writes === 2) throw failure;
		},
	};
	const callback = () => callbacks++;
	socket.write(payload(85519), callback);
	socket.write(payload(65691), callback);
	await setImmediate();
	socket.write(payload(1), callback);
	await setImmediate();

	assert.deepEqual(errors, [failure]);
	assert.equal(closes, 1);
	assert.equal(writes, 2, "a broken protocol stream must not receive more data");
	assert.equal(callbacks, 0, "failed or skipped packets must not report successful completion");
});

test("Cloudflare PostgreSQL transport sends queued data and the final packet before closing", async () => {
	const socket = net.Socket();
	const writes = [];
	let closes = 0;
	socket.writer = {
		async write(data) {
			assert.equal(closes, 0);
			writes.push(Buffer.from(data));
		},
	};
	socket.raw = {
		async close() {
			closes++;
		},
	};
	const first = payload(85519);
	const last = payload(65691, 7);
	socket.write(first);
	socket.end(last);
	await setImmediate();

	assert.ok(writes.every((data) => data.byteLength <= segmentBytes));
	assert.deepEqual(Buffer.concat(writes), Buffer.concat([first, last]));
	assert.equal(closes, 1);
});

for (const bytes of [1, 85519]) {
	for (const rejectWrite of [false, true]) {
		test(`Cloudflare PostgreSQL transport tolerates cleanup during a ${bytes}-byte write (${rejectWrite ? "reject" : "resolve"})`, async () => {
			const socket = net.Socket();
			const pending = Promise.withResolvers();
			let writes = 0;
			let callbacks = 0;
			socket.writer = {
				async write() {
					writes++;
					await pending.promise;
				},
			};
			socket.raw = {
				async close() {
					socket.readyState = "closed";
					socket.emit("close");
					if (rejectWrite) pending.reject(new Error("connection closed during cleanup"));
					else pending.resolve();
				},
			};
			socket.on("close", () => socket.removeAllListeners());
			socket.write(payload(bytes), () => callbacks++);
			await setImmediate();
			socket.destroy();
			await setImmediate();

			assert.equal(socket.destroyed, true);
			assert.equal(writes, 1, "cleanup must stop unsent segments");
			assert.equal(callbacks, 0, "cleanup must not report packet completion");
		});
	}
}
