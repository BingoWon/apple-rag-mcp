interface RobotsRule {
	userAgent: string;
	allow: string;
	disallow: string[];
}

interface RobotsConfig {
	rules: RobotsRule;
	sitemap: string;
}

export default function robots(): RobotsConfig {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: ["/dashboard/", "/api/", "/auth/", "/admin/"],
		},
		sitemap: "https://apple-rag.com/sitemap.xml",
	};
}
