import type { IUser } from "@/types/user";

export const DEMO_USER: IUser = {
	id: "1",
	email: "demo@example.com",
	username: "demo_user",
};

export const VALID_LOGIN = {
	email: "demo@example.com",
	password: "demo12345",
};

export const VALID_REGISTER = {
	username: "new_user",
	email: "newuser@example.com",
	password: "password123",
};

export const INVALID_EMAIL = "not-an-email";
export const SHORT_PASSWORD = "abc";
export const INVALID_USERNAME = "a!";
