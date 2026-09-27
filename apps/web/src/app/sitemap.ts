import type { MetadataRoute } from "next";
import { LocaleSupport } from "@/enums";

// Read APP_URL at request time rather than baking it in at build time
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = process.env.APP_URL || "https://kingNNT.org";
	const locales = Object.values(LocaleSupport);
	const routes = ["home", "about", "contact"];

	const sitemapEntries: MetadataRoute.Sitemap = [];

	// Add root URL
	sitemapEntries.push({
		url: baseUrl,
		lastModified: new Date(),
		changeFrequency: "daily",
		priority: 1.0,
	});

	// Add localized routes
	routes.forEach((route) => {
		locales.forEach((locale) => {
			sitemapEntries.push({
				url: `${baseUrl}/${locale}/${route}`,
				lastModified: new Date(),
				changeFrequency: route === "home" ? "daily" : "monthly",
				priority: route === "home" ? 0.9 : 0.8,
			});
		});
	});

	return sitemapEntries;
}
