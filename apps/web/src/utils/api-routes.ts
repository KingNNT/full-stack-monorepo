import { headers } from "next/headers";
import { type NextRequest, NextResponse, userAgent } from "next/server";
import { handleApiError } from "./api-error-handler";
import logger from "./logger";

type THandler = (request: NextRequest, context?: unknown) => Promise<Response>;

export const _200 = (data: object, message: string = "Success") =>
	NextResponse.json(
		{
			status_code: 200,
			success: true,
			message,
			data,
		},
		{ status: 200 },
	);

export const _201 = (data: object, message: string = "Created successfully") =>
	NextResponse.json(
		{
			status_code: 201,
			success: true,
			message,
			data,
		},
		{ status: 201 },
	);

export const _400 = (error: string = "Invalid parameters") =>
	NextResponse.json(
		{
			status_code: 400,
			success: false,
			message: error,
			error: "BAD_REQUEST",
		},
		{ status: 400 },
	);

export const _401 = (error: string = "Unauthorized") =>
	NextResponse.json(
		{
			status_code: 401,
			success: false,
			message: error,
			error: "UNAUTHORIZED",
		},
		{ status: 401 },
	);

export function createApiRoute(handler: THandler): THandler {
	return async (request, context) => {
		try {
			return await handler(request, context);
		} catch (error) {
			const { buildId, href, origin, pathname, searchParams } = request.nextUrl;
			const headersList = await headers();

			const errorTraceId: string = crypto.randomUUID();

			logger.error({
				tag: "ERROR",
				middleware: "apiErrors",
				errorTraceId,
				error,
				context,
				userAgent: userAgent(request),
				request: {
					buildId,
					href,
					origin,
					pathname,
					searchParams: Object.fromEntries(searchParams),
				},
				headers: Object.fromEntries(headersList.entries()),
			});

			return handleApiError(error, true);
		}
	};
}
