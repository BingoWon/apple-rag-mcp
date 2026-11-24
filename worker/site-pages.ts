import { getSiteMetadata, siteStructuredJSON } from "../shared/site.js";

export function sitePage(response: Response, pathname: string): Response {
	const page = getSiteMetadata(pathname);
	const output = new Response(response.body, {
		status: response.ok ? page.status : response.status,
		headers: response.headers,
	});
	output.headers.set("X-Robots-Tag", page.robots);
	output.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
	output.headers.set("CDN-Cache-Control", "no-store");
	output.headers.delete("ETag");
	output.headers.delete("Last-Modified");
	return new HTMLRewriter()
		.on("title", {
			element(e) {
				e.setInnerContent(page.title);
			},
		})
		.on(
			'meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]',
			{
				element(e) {
					e.setAttribute("content", page.description);
				},
			},
		)
		.on('meta[property="og:title"], meta[name="twitter:title"]', {
			element(e) {
				e.setAttribute("content", page.title);
			},
		})
		.on('link[rel="canonical"]', {
			element(e) {
				if (page.canonical) e.setAttribute("href", page.canonical);
				else e.remove();
			},
		})
		.on('meta[property="og:url"]', {
			element(e) {
				if (page.canonical) e.setAttribute("content", page.canonical);
				else e.remove();
			},
		})
		.on('meta[name="robots"]', {
			element(e) {
				e.setAttribute("content", page.robots);
			},
		})
		.on('meta[property="og:locale"]', {
			element(e) {
				e.setAttribute("content", page.locale);
			},
		})
		.on('script[type="application/ld+json"]', {
			element(e) {
				if (page.structuredData)
					e.setInnerContent(siteStructuredJSON(page.structuredData), { html: true });
				else e.remove();
			},
		})
		.transform(output);
}
