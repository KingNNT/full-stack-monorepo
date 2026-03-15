import Link from "next/link";

const NotFound = () => {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center p-4">
			<h2 className="mb-4 font-bold text-2xl">Page Not Found</h2>
			<p className="mb-6 text-muted-foreground">The page you are looking for does not exist.</p>
			<Link
				href="/"
				className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90"
			>
				Go Home
			</Link>
		</div>
	);
};

export default NotFound;
