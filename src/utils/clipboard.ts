function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

export async function copyText(value: string): Promise<void> {
	const text = String(value);

	if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
		try {
			const item = new ClipboardItem({
				"text/plain": new Blob([text], { type: "text/plain" }),
				"text/html": new Blob([`<pre>${escapeHtml(text)}</pre>`], { type: "text/html" }),
			});
			await navigator.clipboard.write([item]);
			return;
		} catch {
			// Some browsers expose ClipboardItem but reject HTML clipboard writes.
		}
	}

	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}

	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.setAttribute("readonly", "");
	textarea.style.position = "fixed";
	textarea.style.opacity = "0";
	document.body.appendChild(textarea);
	textarea.select();

	try {
		if (!document.execCommand("copy")) {
			throw new Error("Clipboard copy failed");
		}
	} finally {
		textarea.remove();
	}
}
