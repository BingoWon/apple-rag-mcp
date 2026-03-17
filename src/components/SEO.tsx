import { useEffect } from "react";

interface SEOProps {
	title?: string;
	description?: string;
	keywords?: string[];
	image?: string;
	url?: string;
	type?: "website" | "article" | "product";
	publishedTime?: string;
	modifiedTime?: string;
	author?: string;
	noindex?: boolean;
	nofollow?: boolean;
}

function setMeta(attrName: string, attrValue: string, content: string) {
	let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
	if (!el) {
		el = document.createElement("meta");
		el.setAttribute(attrName, attrValue);
		document.head.appendChild(el);
	}
	el.setAttribute("content", content);
}

export function SEO({
	title,
	description,
	keywords = [],
	image,
	url,
	type = "website",
	publishedTime,
	modifiedTime,
	author,
	noindex = false,
	nofollow = false,
}: SEOProps) {
	const siteTitle = "Apple RAG MCP - Inject Apple Expertise into AI Agents via MCP";
	const siteDescription =
		"Transform your AI agents into Apple development experts with instant access to official Swift docs, design guidelines, platform knowledge, and WWDC session transcripts.";
	const siteUrl = "https://apple-rag.com";
	const defaultImage = `${siteUrl}/og-image.png`;

	const fullTitle = title ? `${title} | Apple RAG MCP` : siteTitle;
	const fullDescription = description || siteDescription;
	const fullUrl = url ? `${siteUrl}${url}` : siteUrl;
	const fullImage = image ? `${siteUrl}${image}` : defaultImage;

	const robotsContent = [noindex ? "noindex" : "index", nofollow ? "nofollow" : "follow"].join(
		", ",
	);

	useEffect(() => {
		const prevTitle = document.title;
		document.title = fullTitle;

		setMeta("name", "description", fullDescription);
		if (keywords.length > 0) setMeta("name", "keywords", keywords.join(", "));
		setMeta("name", "robots", robotsContent);

		let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
		if (!canonical) {
			canonical = document.createElement("link");
			canonical.rel = "canonical";
			document.head.appendChild(canonical);
		}
		canonical.href = fullUrl;

		setMeta("property", "og:type", type);
		setMeta("property", "og:title", fullTitle);
		setMeta("property", "og:description", fullDescription);
		setMeta("property", "og:image", fullImage);
		setMeta("property", "og:url", fullUrl);
		setMeta("property", "og:site_name", "Apple RAG MCP");
		setMeta("property", "og:locale", "en_US");

		setMeta("name", "twitter:card", "summary_large_image");
		setMeta("name", "twitter:title", fullTitle);
		setMeta("name", "twitter:description", fullDescription);
		setMeta("name", "twitter:image", fullImage);
		setMeta("name", "twitter:site", "@applerag");
		setMeta("name", "twitter:creator", "@applerag");

		if (type === "article") {
			if (publishedTime) setMeta("property", "article:published_time", publishedTime);
			if (modifiedTime) setMeta("property", "article:modified_time", modifiedTime);
			if (author) setMeta("property", "article:author", author);
		}

		const structuredData = {
			"@context": "https://schema.org",
			"@type": "WebSite",
			name: siteTitle,
			description: siteDescription,
			url: siteUrl,
			potentialAction: {
				"@type": "SearchAction",
				target: `${siteUrl}/search?q={search_term_string}`,
				"query-input": "required name=search_term_string",
			},
		};

		const script = document.createElement("script");
		script.type = "application/ld+json";
		script.textContent = JSON.stringify(structuredData);
		document.head.appendChild(script);

		return () => {
			document.title = prevTitle;
			document.head.removeChild(script);
		};
	}, [
		fullTitle,
		fullDescription,
		fullUrl,
		fullImage,
		type,
		keywords,
		robotsContent,
		publishedTime,
		modifiedTime,
		author,
	]);

	return null;
}

// Breadcrumb structured data
export function BreadcrumbStructuredData({
	items,
}: {
	items: Array<{ name: string; url: string }>;
}) {
	const structuredData = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map((item, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: item.name,
			item: item.url,
		})),
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
		/>
	);
}

// FAQ structured data
export function FAQStructuredData({ faqs }: { faqs: Array<{ question: string; answer: string }> }) {
	const structuredData = {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: faqs.map((faq) => ({
			"@type": "Question",
			name: faq.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: faq.answer,
			},
		})),
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
		/>
	);
}

// Product structured data
export function ProductStructuredData({
	name,
	description,
	price,
	currency = "USD",
	availability = "InStock",
}: {
	name: string;
	description: string;
	price: number;
	currency?: string;
	availability?: string;
}) {
	const structuredData = {
		"@context": "https://schema.org",
		"@type": "Product",
		name,
		description,
		offers: {
			"@type": "Offer",
			price: price.toString(),
			priceCurrency: currency,
			availability: `https://schema.org/${availability}`,
		},
	};

	return (
		<script
			type="application/ld+json"
			dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
		/>
	);
}
