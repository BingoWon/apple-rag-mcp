import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";

interface CodeBlockProps {
	filename: string;
	code: string;
}

export function CodeBlock({ filename, code }: CodeBlockProps) {
	const [copied, setCopied] = useState(false);

	const copyToClipboard = async () => {
		await navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="w-full overflow-hidden rounded-lg bg-slate-900 font-mono text-sm text-slate-100">
			<div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
				<span className="text-xs text-slate-400">{filename}</span>
				<button
					type="button"
					onClick={copyToClipboard}
					className="text-slate-400 transition-colors hover:text-white"
					aria-label="Copy code"
				>
					{copied ? <IconCheck size={15} /> : <IconCopy size={15} />}
				</button>
			</div>
			<pre className="overflow-x-auto p-4">
				<code>{code}</code>
			</pre>
		</div>
	);
}
