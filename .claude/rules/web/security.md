---
paths:
  - "apps/web/**/*.ts"
  - "apps/web/**/*.tsx"
---

# Web Security

## NextAuth Authentication

- Session strategy: `jwt` — no server-side session storage
- Credentials provider only — validate via `authService.login()`
- Pass auth error codes as `throw new Error(error.code)` — NextAuth convention for error propagation
- Client-side: `signIn("credentials", { redirect: false })` then handle errors manually
- Map error codes to i18n message IDs via lookup table — never show raw error codes to users

## Input Validation (Zod + React Hook Form)

- Define Zod schemas with i18n messages: `z.string().email(t("validation.invalidEmail"))`
- Wire to forms via `zodResolver(schema)`
- Server-side API routes: validate required fields before calling services
- `createApiRoute()` wrapper catches and converts exceptions to structured responses

## Error Response Format

API route responses follow this shape — maintain for all new endpoints:

```json
{
  "status_code": 400,
  "success": false,
  "message": "Human-readable message",
  "error": "ERROR_CODE"
}
```

- Use `_200()`, `_201()`, `_400()` helpers from `api-routes.ts`
- Include `errorTraceId` in error responses for debugging

## API Client Security

### Token Injection

- `BaseHttpClient` injects `Authorization: Bearer <token>` via `beforeRequest` hook
- Token retrieved from NextAuth session — never stored in localStorage or cookies manually

### Retry Policy

- Retry on: 408, 413, 429, 500, 502, 503, 504
- Exponential backoff with configurable limit
- `RetryExhaustedError` wraps the last error after all attempts fail
- Never retry 401/403 — these are definitive auth failures

### Error Hierarchy

Catch specific types in UI code — map `HttpStatusError.statusCode` to user-facing messages:

```
ApiClientException
├── NetworkError        — CORS, DNS, connection failures
├── TimeoutError        — Request exceeded duration limit
├── HttpStatusError     — Non-2xx response with statusCode + body
├── ValidationError     — Server returned field-level errors
└── RetryExhaustedError — All retry attempts failed
```

## Route Protection

- `PRIVATE_ROUTES` / `PUBLIC_ROUTES` defined in `src/utils/routes.ts`
- `isPrivateRoute(pathname)` checks prefix patterns
- Unauthenticated users redirected to login with `callback-url` param

## Auth Error Handling in Forms

- Login: catch `signIn()` error → `isAuthErrorCode()` type guard → map to i18n message
- Register: catch `HttpStatusError` → check `statusCode` (409 = email exists) → i18n message
- Always fall back to a generic error message for unknown error codes

## Environment & Secrets

- All secrets via environment variables — never hardcoded
- `.env.example` documents required variables — keep updated
- Key vars: `AUTH_SECRET`, `NEXT_PUBLIC_API_BASE_URL`, `NEXTAUTH_URL`
- `NEXT_PUBLIC_*` vars are exposed to the browser — never put secrets in them
