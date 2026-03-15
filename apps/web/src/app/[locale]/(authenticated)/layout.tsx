import { PrivateLayoutWrapper } from "@/components/layout/private-layout-wrapper";

interface IPrivateLayoutProps {
	children: React.ReactNode;
}

const PrivateLayout = ({ children }: IPrivateLayoutProps) => {
	return <PrivateLayoutWrapper>{children}</PrivateLayoutWrapper>;
};

export default PrivateLayout;
