import Image from "next/image";

const LOGO_ASPECT = 2172 / 724; // exactly 3:1 wordmark aspect

export interface ILogoProps {
	/** Render height in px; width auto-derived from the wordmark aspect ratio. */
	height?: number;
	/** Pass `true` for the LCP image (above-the-fold hero). */
	priority?: boolean;
	/** Container className. */
	className?: string;
	/** Accessible alt text on the wrapper span. */
	alt?: string;
}

export const Logo = ({
	height = 32,
	priority = false,
	className,
	alt = "FullStack Monorepo",
}: ILogoProps) => {
	const width = Math.ceil(height * LOGO_ASPECT);

	return (
		<span role="img" aria-label={alt} className={className}>
			<Image
				src="/logo-light.png"
				alt=""
				width={width}
				height={height}
				priority={priority}
				className="block dark:hidden"
			/>
			<Image
				src="/logo-dark.png"
				alt=""
				width={width}
				height={height}
				priority={priority}
				className="hidden dark:block"
			/>
		</span>
	);
};
