import { authService } from "@/services/auth.service";
import { _201, _400, createApiRoute } from "@/utils/api-routes";

const handler = createApiRoute(async (request) => {
	// Parse request body
	const body = await request.json();
	const { name, email, password } = body;

	// Validate required fields
	if (!name || !email || !password) {
		return _400("Name, email, and password are required");
	}

	// Call the auth service to register the user
	// Service throws exceptions on errors (handled by createApiRoute)
	const user = await authService.register(name, email, password);

	// Return success response
	return _201({ user }, "Account created successfully");
});

export const POST = handler;
