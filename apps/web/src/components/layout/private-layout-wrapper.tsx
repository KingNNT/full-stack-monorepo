"use client";

import { useState } from "react";
import { PrivateHeader } from "@/components/layout/private-header";
import { PrivateSidebar } from "@/components/layout/private-sidebar";

interface IPrivateLayoutWrapperProps {
	children: React.ReactNode;
}

export const PrivateLayoutWrapper = ({ children }: IPrivateLayoutWrapperProps) => {
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);

	const toggleSidebar = () => {
		setIsSidebarOpen(!isSidebarOpen);
	};

	const closeSidebar = () => {
		setIsSidebarOpen(false);
	};

	return (
		<div className="flex min-h-screen bg-background">
			<PrivateSidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
			<div className="flex flex-1 flex-col lg:ml-0">
				<PrivateHeader onMenuClick={toggleSidebar} />
				<main className="flex-1 p-6">{children}</main>
			</div>
		</div>
	);
};
