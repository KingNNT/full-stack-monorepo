import type { MetadataRoute } from "next";
import { LocaleSupport } from "@/enums";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kingNNT.org";
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
