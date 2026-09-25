import { Github, Layers } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const INTRO_PARAGRAPH =
	"The FullStack Monorepo template brings a production-ready NestJS API and Next.js web application into one workspace. Shared tooling — Drizzle, Pino logging, and a mise-managed toolchain — keeps environments consistent. Type-safe contracts and a single dependency tree keep your team shipping instead of wiring. Use it as a starting point for your next project — or fork it to learn a modern full-stack setup.";

const GITHUB_REPO_URL = "https://github.com/KingNNT/full-stack-monorepo";

export const Hero = () => {
	const locale = useLocale();
	const loginHref = `/${locale}/login`;

	return (
		<section className="container mx-auto flex flex-col items-center gap-8 py-20 text-center">
			<Logo height={96} priority />

			<p className="font-medium text-muted-foreground text-xs uppercase tracking-widest">
				FullStack Starter Template
			</p>

			<h1 className="font-bold text-5xl tracking-tight md:text-6xl">FullStack Monorepo</h1>

			<p className="text-muted-foreground text-xl">A foundation for your next project.</p>

			<p className="max-w-prose text-base text-muted-foreground">{INTRO_PARAGRAPH}</p>

			<div className="flex flex-wrap items-center justify-center gap-4">
				<Button asChild className="text-zinc-900 dark:text-zinc-50">
					<Link href={loginHref}>Sign In</Link>
				</Button>
				<Button asChild variant="outline">
					<a href={GITHUB_REPO_URL} target="_blank" rel="noreferrer">
						<Github aria-hidden="true" className="mr-2 h-4 w-4" />
						Star on GitHub
					</a>
				</Button>
			</div>

			<div aria-hidden="true" className="text-primary">
				<Layers className="h-12 w-12" />
			</div>
		</section>
	);
};
