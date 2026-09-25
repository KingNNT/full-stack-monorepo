import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub next/image so the Logo renders a plain <img>.
vi.mock("next/image", () => ({
	default: (props: {
		src: string;
		alt?: string;
		className?: string;
		width?: number;
		height?: number;
	}) => {
		const { src, alt = "", className, width, height } = props;
		// eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
		return <img src={src} alt={alt} className={className} width={width} height={height} />;
	},
}));

import { Hero } from "./hero";

describe("Hero", () => {
	it("renders the eyebrow, title, and subtitle text", () => {
		render(<Hero />);
		expect(screen.getByText(/fullstack starter template/i)).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { level: 1, name: /fullstack monorepo/i }),
		).toBeInTheDocument();
		expect(screen.getByText(/a foundation for your next project/i)).toBeInTheDocument();
	});

	it("renders the intro paragraph mentioning NestJS and Next.js", () => {
		render(<Hero />);
		expect(screen.getByText(/nestjs api and next\.js web application/i)).toBeInTheDocument();
	});

	it("renders a Sign In link pointing to /en/login", () => {
		render(<Hero />);
		const link = screen.getByRole("link", { name: /sign in/i });
		expect(link).toHaveAttribute("href", "/en/login");
	});

	it("renders a GitHub link opening in a new tab", () => {
		render(<Hero />);
		const link = screen.getByRole("link", { name: /star on github/i });
		expect(link).toHaveAttribute("href", "https://github.com/KingNNT/full-stack-monorepo");
		expect(link).toHaveAttribute("target", "_blank");
		expect(link).toHaveAttribute("rel", expect.stringMatching(/noreferrer/));
	});

	it("renders the decorative Layers icon (aria-hidden)", () => {
		const { container } = render(<Hero />);
		const hidden = container.querySelector('[aria-hidden="true"]');
		expect(hidden).toBeTruthy();
	});
});
