/**
 * Authentication-related types
 */

import type { TAuthServiceErrorCode } from "@/constants/error-codes";
import type { IErrorResponse, ISuccessResponse } from "@/types/api";
import type { IUser } from "@/types/user";

export interface ILoginRequest {
	email: string;
	password: string;
}

export interface ILoginData {
	readonly access_token: string;
	readonly refresh_token: string;
	readonly user: IUser;
}

export interface ILoginSuccessResponse extends ISuccessResponse<ILoginData> {}

export interface ILoginErrorResponse extends IErrorResponse<TAuthServiceErrorCode> {}

export type TLoginResult = ILoginSuccessResponse | ILoginErrorResponse;

export interface IRegisterRequest {
	name: string;
	email: string;
	password: string;
}

export interface IRegisterData {
	readonly user: IUser;
}

export interface IRegisterSuccessResponse extends ISuccessResponse<IRegisterData> {}

export interface IRegisterErrorResponse extends IErrorResponse<TAuthServiceErrorCode> {}

export type TRegisterResult = IRegisterSuccessResponse | IRegisterErrorResponse;
