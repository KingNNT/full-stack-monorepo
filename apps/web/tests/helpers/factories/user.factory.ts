import type { IUser } from "@/types/user";

export const DEMO_USER: IUser = {
	id: "1",
	name: "Demo User",
	email: "demo@example.com",
};

export const VALID_LOGIN = {
	email: "demo@example.com",
	password: "demo123",
};

export const VALID_REGISTER = {
	name: "New User",
	email: "newuser@example.com",
	password: "password123",
};

export const INVALID_EMAIL = "not-an-email";
export const SHORT_PASSWORD = "abc";
export const SHORT_NAME = "A";
