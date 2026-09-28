/**
 * Authentication-related types
 */

import type { TAuthServiceErrorCode } from "@/constants/error-codes";
import type { IErrorResponse, ISuccessResponse } from "@/types/api";
import type { IUser } from "@/types/user";

export interface ILoginRequest {
	/** Email address or username */
	identifier: string;
	password: string;
}

export interface ILoginData {
	readonly access_token: string;
	readonly refresh_token: string;
}

/**
 * Result of a successful login: the user plus the API tokens kept in the NextAuth JWT
 */
export interface IAuthenticatedUser extends IUser {
	accessToken: string;
	refreshToken: string;
}

export interface ILoginSuccessResponse extends ISuccessResponse<ILoginData> {}

export interface ILoginErrorResponse extends IErrorResponse<TAuthServiceErrorCode> {}

export type TLoginResult = ILoginSuccessResponse | ILoginErrorResponse;

export interface IRegisterRequest {
	username: string;
	email: string;
	password: string;
}

export interface IRegisterData {
	readonly user_id: string;
}

export interface IRegisterSuccessResponse extends ISuccessResponse<IRegisterData> {}

export interface IRegisterErrorResponse extends IErrorResponse<TAuthServiceErrorCode> {}

export type TRegisterResult = IRegisterSuccessResponse | IRegisterErrorResponse;
