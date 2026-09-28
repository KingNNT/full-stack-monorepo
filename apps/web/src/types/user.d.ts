export interface IUser {
	id: string;
	email: string;
	username: string;
}

export interface IUserProfile {
	user_id: string;
	email: string;
	username: string;
	is_active: boolean;
}

export interface IUpdateProfileRequest {
	username: string;
}

export interface IChangePasswordRequest {
	old_password: string;
	new_password: string;
}
