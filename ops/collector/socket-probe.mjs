import { connect } from "cloudflare:sockets";
import postgres from "postgres";
import { net } from "../../node_modules/postgres/cf/polyfills.js";

async function bounded(promise, milliseconds, label) {
	let timer;
	try {
		return await Promise.race([
			promise,
			new Promise((_, reject) => {
				timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
			}),
		]);
	} finally {
		clearTimeout(timer);
	}
}

function httpPayload(totalBytes) {
	let bodyBytes = totalBytes - 150;
	let header;
	for (let index = 0; index < 3; index++) {
		header = new TextEncoder().encode(
			`POST /post HTTP/1.1\r\nHost: httpbin.org\r\nContent-Type: application/octet-stream\r\nContent-Length: ${bodyBytes}\r\nConnection: close\r\n\r\n`,
		);
		bodyBytes = totalBytes - header.byteLength;
	}
	const payload = new Uint8Array(totalBytes).fill(120);
	payload.set(header);
	return payload;
}

async function postgresProbe(input, env) {
	if (
		!/^collector_probe_[a-f0-9_]+$/.test(env.PROBE_SCHEMA || "") ||
		!Array.isArray(input.records) ||
		input.records.length < 1 ||
		input.records.length > 50 ||
		(input.segmentBytes &&
			(!Number.isInteger(input.segmentBytes) ||
				input.segmentBytes < 1 ||
				input.segmentBytes > 65536))
	) {
		return Response.json(
			{ error: "An isolated fixture and 1-50 records are required" },
			{ status: 400 },
		);
	}
	const result = {
		ok: false,
		segmentBytes: input.segmentBytes || 0,
		writes: [],
		transportWrites: [],
		currentUrl: null,
	};
	const originalSocket = net.Socket;
	net.Socket = function diagnosticSocket() {
		const socket = originalSocket();
		const write = socket.write.bind(socket);
		let queued = Promise.resolve();
		let failed = false;
		let instrumentedWriter;
		socket.write = (data, callback) => {
			if (socket.writer !== instrumentedWriter) {
				instrumentedWriter = socket.writer;
				const transportWrite = socket.writer.write.bind(socket.writer);
				socket.writer.write = (segment) => {
					result.transportWrites.push(segment.byteLength);
					return transportWrite(segment);
				};
			}
			result.writes.push({
				bytes: data.byteLength,
				message: String.fromCharCode(data[0]),
				url: result.currentUrl,
			});
			if (!input.segmentBytes) return write(data, callback);
			queued = queued.then(async () => {
				for (let offset = 0; offset < data.byteLength; offset += input.segmentBytes) {
					await socket.writer.write(data.subarray(offset, offset + input.segmentBytes));
				}
				callback?.();
			});
			queued.catch((error) => {
				if (failed) return;
				failed = true;
				if (socket.listenerCount("error")) socket.emit("error", error);
				socket.raw?.close().catch(() => {});
			});
			return true;
		};
		return socket;
	};
	const sql = postgres({
		host: env.RAG_DB_HOST,
		port: Number(env.RAG_DB_PORT),
		database: env.RAG_DB_DATABASE,
		username: env.RAG_DB_USER,
		password: env.RAG_DB_PASSWORD,
		ssl: input.ssl === true,
		max: 1,
		idle_timeout: 0,
		connect_timeout: 10,
		prepare: input.prepare !== false,
		connection: {
			application_name: "collector-socket-size-probe",
			search_path: env.PROBE_SCHEMA,
			statement_timeout: 120000,
			lock_timeout: 60000,
			tcp_user_timeout: input.legacyParameters ? 0 : 60000,
			client_connection_check_interval: input.legacyParameters ? 0 : 1000,
		},
		onnotice: () => {},
	});
	const started = Date.now();
	try {
		await bounded(
			sql.begin(async (transaction) => {
				await transaction`TRUNCATE ${sql(env.PROBE_SCHEMA)}.pages`;
				for (const record of input.records) {
					await transaction`INSERT INTO ${sql(env.PROBE_SCHEMA)}.pages (id,url,collect_count)
					VALUES (${record.id},${record.url},0)`;
				}
				for (const record of input.records) {
					result.currentUrl = record.url;
					await transaction`UPDATE ${sql(env.PROBE_SCHEMA)}.pages
					SET raw_json=${record.raw_json},title=${record.title},content=${record.content},
					    updated_at=${new Date(record.updated_at)}
					WHERE id=${record.id}`;
					const [verified] = await transaction`SELECT raw_json #>> '{}' = ${record.raw_json}
					AS matches FROM ${sql(env.PROBE_SCHEMA)}.pages WHERE id=${record.id}`;
					if (!verified.matches) throw new Error("The reconstructed raw JSON changed");
				}
			}),
			25000,
			"PostgreSQL probe",
		);
		result.ok = true;
	} catch (error) {
		result.error = error instanceof Error ? error.message : String(error);
		result.code = error?.code;
	} finally {
		await sql.end({ timeout: 0 }).catch(() => {});
		net.Socket = originalSocket;
	}
	result.elapsedMs = Date.now() - started;
	return Response.json(result);
}

export default {
	async fetch(request, env) {
		if (!env.PROBE_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.PROBE_TOKEN}`) {
			return new Response("Unauthorized", { status: 401 });
		}
		const input = await request.json();
		if (input.mode === "postgres") return postgresProbe(input, env);
		const totalBytes = input.bytes;
		const segmentBytes = input.segmentBytes || totalBytes;
		if (
			!Number.isInteger(totalBytes) ||
			totalBytes < 1024 ||
			totalBytes > 262144 ||
			!Number.isInteger(segmentBytes) ||
			segmentBytes < 1 ||
			segmentBytes > totalBytes
		) {
			return new Response("Invalid sizes", { status: 400 });
		}
		const payload = httpPayload(totalBytes);
		const result = {
			totalBytes,
			segmentBytes,
			payloadHash: Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", payload)))
				.map((byte) => byte.toString(16).padStart(2, "0"))
				.join(""),
		};
		let socket;
		const started = Date.now();
		try {
			socket = connect("httpbin.org:80");
			socket.closed.catch(() => {});
			await bounded(socket.opened, 10000, "connect");
			const writer = socket.writable.getWriter();
			const reader = socket.readable.getReader();
			for (let offset = 0; offset < payload.byteLength; offset += segmentBytes) {
				await bounded(
					writer.write(payload.subarray(offset, offset + segmentBytes)),
					10000,
					"write",
				);
			}
			result.writeResolved = true;
			let response = "";
			const decoder = new TextDecoder();
			while (!response.includes("\r\n") && response.length < 4096) {
				const received = await bounded(reader.read(), 10000, "read");
				if (received.done) break;
				response += decoder.decode(received.value, { stream: true });
			}
			result.statusLine = response.split("\r\n")[0];
			result.ok = /^HTTP\/1\.[01] \d{3}/.test(result.statusLine);
		} catch (error) {
			result.ok = false;
			result.error = error instanceof Error ? error.message : String(error);
		} finally {
			await socket?.close().catch(() => {});
		}
		result.elapsedMs = Date.now() - started;
		return Response.json(result);
	},
};
