import { Trans } from "react-i18next";

export function JevBrand() {
	return (
		<a
			href="https://typesafe.ai/"
			target="_blank"
			rel="noopener noreferrer"
			onClick={(event) => event.stopPropagation()}
			className="jev-brand relative inline-block pl-[1.15em] align-baseline whitespace-nowrap text-light focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-typesafe"
		>
			<img
				src="/typesafe-logo.webp"
				alt=""
				width={32}
				height={32}
				decoding="async"
				className="absolute left-0 top-1/2 size-[0.9em] -translate-y-1/2 rounded-[0.18em]"
			/>
			<span className="jev-brand-name font-bold">Jev</span>
		</a>
	);
}

export function JevText({ i18nKey }: { i18nKey: string }) {
	return (
		<Trans
			i18nKey={i18nKey}
			components={{
				jev: <JevBrand />,
				rag: <span className="rag-name" />,
				combo: <span className="rag-jev-pair inline-block whitespace-nowrap" />,
			}}
		/>
	);
}
