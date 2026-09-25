import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

// Stub next/image so we can assert on plain <img> attributes without the optimizer.
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

import { Logo } from "./logo";

describe("Logo", () => {
	function renderLogo(ui: React.ReactElement) {
		return render(ui);
	}

	it("renders both light and dark images with theme-aware classes", () => {
		const { container } = renderLogo(<Logo />);

		const imgs = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
		const lightImg = imgs.find((i) => i.getAttribute("src") === "/logo-light.png");
		const darkImg = imgs.find((i) => i.getAttribute("src") === "/logo-dark.png");

		expect(lightImg).toBeDefined();
		expect(lightImg).toHaveClass("block");
		expect(lightImg).toHaveClass("dark:hidden");

		expect(darkImg).toBeDefined();
		expect(darkImg).toHaveClass("hidden");
		expect(darkImg).toHaveClass("dark:block");
	});

	it("derives width from height using the 2172:724 aspect (3:1)", () => {
		const { container } = renderLogo(<Logo height={32} />);
		const lightImg = Array.from(container.querySelectorAll<HTMLImageElement>("img")).find(
			(i) => i.getAttribute("src") === "/logo-light.png",
		);
		// 2172 / 724 = 3.0 exactly, so width = ceil(32 * 3) = 96
		expect(lightImg).toHaveAttribute("width", "96");
		expect(lightImg).toHaveAttribute("height", "32");
	});

	it("uses an accessible role=img wrapper with the brand alt text", () => {
		render(<Logo alt="My Brand" />);
		const wrapper = screen.getByRole("img", { name: "My Brand" });
		expect(wrapper.tagName).toBe("SPAN");
	});

	it("defaults the alt to FullStack Monorepo when no alt is provided", () => {
		render(<Logo />);
		expect(screen.getByRole("img", { name: "FullStack Monorepo" })).toBeInTheDocument();
	});
});
