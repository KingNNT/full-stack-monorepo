/**
 * Centralized API error handler
 * Converts exceptions to standardized API responses
 * Works with createApiRoute wrapper for enhanced error logging
 */

import { NextResponse } from "next/server";
import type { TAuthServiceErrorCode } from "@/constants/error-codes";
import { AUTH_SERVICE_ERROR_CODES } from "@/constants/error-codes";
import { AuthException } from "@/exceptions";
import type { IErrorResponse } from "@/types/api";
import logger from "./logger";

/**
 * Handles errors and returns appropriate NextResponse
 * Converts AuthException to structured error response
 * Falls back to generic 500 error for unexpected exceptions
 *
 * NOTE: When using createApiRoute wrapper, you can throw exceptions directly
 * and let the wrapper handle them. This function is for manual error handling.
 *
 * @param error - The error/exception to handle
 * @param includeTraceId - Whether to include an error trace ID (default: false)
 * @returns NextResponse with error details
 */
export function handleApiError(
	error: unknown,
	includeTraceId = false,
): NextResponse<IErrorResponse<TAuthServiceErrorCode>> {
	const errorTraceId = includeTraceId ? crypto.randomUUID() : undefined;

	// Log the error
	logger.error({
		tag: "API_ERROR",
		error,
		errorTraceId,
		timestamp: new Date().toISOString(),
	});

	// Handle AuthException
	if (error instanceof AuthException) {
		return NextResponse.json(
			{
				status_code: error.statusCode,
				success: false,
				message: error.message,
				error: error.code,
				...(errorTraceId && { errorTraceId }),
			},
			{ status: error.statusCode },
		);
	}

	// Handle generic Error
	if (error instanceof Error) {
		return NextResponse.json(
			{
				status_code: 500,
				success: false,
				message: error.message || "An unexpected error occurred",
				error: AUTH_SERVICE_ERROR_CODES.INTERNAL_ERROR,
				...(errorTraceId && { errorTraceId }),
			},
			{ status: 500 },
		);
	}

	// Handle unknown error types
	return NextResponse.json(
		{
			status_code: 500,
			success: false,
			message: "An unexpected error occurred",
			error: AUTH_SERVICE_ERROR_CODES.INTERNAL_ERROR,
			...(errorTraceId && { errorTraceId }),
		},
		{ status: 500 },
	);
}
