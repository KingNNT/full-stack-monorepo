export interface IResponse {
	status_code: number;
	message: string;
	success: boolean;
}

export interface ISuccessResponse<TData> extends IResponse {
	success: true;
	data: TData;
}

export interface IErrorResponse<TError> extends IResponse {
	success: false;
	error?: TError;
}

export interface IListResponse<TObject> extends ISuccessResponse<TObject[]> {}
