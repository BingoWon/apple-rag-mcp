export async function readText(response: Response, maxBytes = 4_000_000): Promise<string> {
	if (Number(response.headers.get("content-length")) > maxBytes) {
		await response.body?.cancel();
		throw new Error("Response exceeds the content size limit.");
	}
	if (!response.body) return "";
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let bytes = 0;
	let text = "";
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) return text + decoder.decode();
			bytes += value.byteLength;
			if (bytes > maxBytes) throw new Error("Response exceeds the content size limit.");
			text += decoder.decode(value, { stream: true });
		}
	} finally {
		await reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}
