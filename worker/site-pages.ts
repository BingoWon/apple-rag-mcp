import { SITE_PAGES } from "../shared/site.js";
export function connectionPage(response: Response): Response {
	const page = SITE_PAGES["/connect"];
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
				e.setAttribute("href", "https://apple-rag.com/connect");
			},
		})
		.on('meta[property="og:url"]', {
			element(e) {
				e.setAttribute("content", "https://apple-rag.com/connect");
			},
		})
		.transform(response);
}
