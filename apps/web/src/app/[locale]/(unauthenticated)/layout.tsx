import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

interface IPublicLayoutProps {
	children: React.ReactNode;
}

const PublicLayout = ({ children }: IPublicLayoutProps) => {
	return (
		<div className="flex min-h-screen flex-col bg-background text-foreground">
			<Header />
			<main className="flex-grow">{children}</main>
			<Footer />
		</div>
	);
};

export default PublicLayout;
