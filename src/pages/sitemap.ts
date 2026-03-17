interface SitemapEntry {
	url: string;
	lastModified: Date;
	changeFrequency: "daily" | "weekly" | "monthly" | "yearly" | "always" | "hourly" | "never";
	priority: number;
}

export default function sitemap(): SitemapEntry[] {
	const baseUrl = "https://apple-rag.com";

	const routes = [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: "daily" as const,
			priority: 1,
		},
		{
			url: `${baseUrl}/search`,
			lastModified: new Date(),
			changeFrequency: "weekly" as const,
			priority: 0.8,
		},
		{
			url: `${baseUrl}/login`,
			lastModified: new Date(),
			changeFrequency: "monthly" as const,
			priority: 0.5,
		},
		{
			url: `${baseUrl}/register`,
			lastModified: new Date(),
			changeFrequency: "monthly" as const,
			priority: 0.5,
		},
	];

	return routes;
}
