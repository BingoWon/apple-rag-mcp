export function JevBrand() {
	return (
		<a
			href="https://typesafe.ai/"
			target="_blank"
			rel="noopener noreferrer"
			className="jev-brand inline-flex items-center gap-[0.25em] align-middle whitespace-nowrap text-typesafe leading-none focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-typesafe"
		>
			<img
				src="/typesafe-logo.webp"
				alt=""
				width={32}
				height={32}
				decoding="async"
				className="size-[1em] shrink-0 rounded-[0.18em]"
			/>
			<span>Jev</span>
		</a>
	);
}
