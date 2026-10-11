# Password Management Design — Change, Forgot, Reset

**Date:** 2026-10-11
**Status:** Approved design, pending spec review
**Branch:** `develop`
**Author:** Agent collaboration with @KingNNT

---

## Context

Today the API exposes only `POST /api/v1/users/change-password`, and the web app
has no page that calls it. There is no forgot/reset flow and no way to send
email. Sessions cannot be revoked: the JWT payload carries only `sub`, so tokens
issued before a password change stay valid until they expire. The API returns a
refresh token but has no endpoint that accepts it, so the web session (NextAuth,
15-minute API access token kept in the cookie) silently breaks after 15 minutes.

This spec adds session revocation, a refresh endpoint with web auto-refresh, a
mail subsystem backed by AWS SES (Mailpit locally), forgot/reset password, the
web UI for all three password flows, and the SES infrastructure.

## Goals

1. A password reset logs out every session; a password change logs out every
   other session and keeps the current one signed in.
2. Web sessions survive access-token expiry through `/auth/refresh`, and end
   cleanly (redirect to login) when the session is revoked.
3. Users can request a reset link by email and set a new password with it,
   without the endpoint revealing which emails are registered.
4. Email is sent through SES in staging/prod and captured by Mailpit locally,
   in the request's locale (`en` / `vi`).
5. SES identity, DNS authentication and pod permissions are managed by
   Terraform.

## Non-goals

- Per-device session management or refresh-token rotation (the `sessions`
  table approach). The chosen design can be extended to it later.
- A stored per-user language preference.
- Email verification on registration.
- Durable mail delivery (outbox + worker), SNS bounce/complaint alerting.
- Cleanup job for expired reset tokens; a token pre-validation endpoint.
- Distributed (multi-pod) IP rate limiting.

## Decisions

| Topic | Decision | Rejected |
|---|---|---|
| Revocation | `token_version` on `auth_credentials`, checked on every authenticated request | `sessions` table + rotation (larger; access tokens still live 15 min unless also checked); Redis denylist (new infra) |
| Revocation scope | Reset revokes all sessions; change revokes all and re-issues tokens to the caller | Revoke all on both; no revocation |
| Refresh | In scope: API endpoint + NextAuth auto-refresh | Separate spec |
| Email language | Locale sent with the request, default `en` | Stored preference; English only |
| Mail delivery | In-process, after the response, via CQRS `EventBus`; failures logged + counted | Outbox table + worker; synchronous send (timing leak) |
| Templates | Plain TS functions per template, strings inline per locale | Template engine |
| SES infra | New Terraform module `ses`, wired into IRSA and Helm | App code only |

---

## 1. Session revocation and refresh

### Data

Migration adds `auth_credentials.token_version integer NOT NULL DEFAULT 0`.

### Tokens

- `JwtPayload` gains `tv: number`.
- `ITokenService.generateTokenPair(userId, tokenVersion)` signs `tv` into both
  the access and the refresh token.
- `LoginHandler` passes the credential's current `token_version`.

### Validation

`JwtStrategy.validate` and `JwtRefreshStrategy.validate` load the credential by
`sub` (primary-key lookup through `IAuthCredentialsRepository.findByUserId`)
and throw `401` with `errorCode: 'SESSION_REVOKED'` when:

- the credential does not exist or `is_active = false`, or
- `payload.tv` is missing or differs from `token_version`.

Tokens issued before this change carry no `tv` and are rejected: every user
signs in once after the deploy.

### `POST /api/v1/auth/refresh`

- Guarded by `JwtRefreshGuard` (refresh token as `Authorization: Bearer`).
- Returns `200` with `{ access_token, refresh_token }` signed with the current
  `token_version`. No rotation and no reuse detection.
- Covered by the existing `Auth` controller throttle.

### Change password

- `ChangePasswordHandler`, in one transaction, updates `password_hash` and
  increments `token_version`, then returns a new token pair for the caller.
- `ChangePasswordRequestDto` gains optional `locale` (`en` | `vi`).
- `POST /api/v1/users/change-password` changes from `204` to `200` with
  `{ access_token, refresh_token }`. **Breaking** for existing clients; the
  only client is `apps/web`, updated in section 4.
- After commit, publishes `PasswordChangedEvent { userId, email, locale,
  method: 'change' }`.

### Web auto-refresh

In `apps/web/src/services/next-auth.ts`:

- On sign-in, the `jwt` callback stores `accessTokenExpires` (decoded `exp`,
  milliseconds).
- On later calls, when fewer than 60 s remain, it calls `authService.refresh`
  with the stored refresh token and replaces both tokens and the expiry.
- When refresh returns `401`, it sets `token.error = 'RefreshFailed'` and
  drops the API tokens.
- `session` exposes `error`. `proxy.ts` (for private routes) and the API
  client (on any `401 SESSION_REVOKED`) sign the user out and redirect to
  `/<locale>/login?reason=session_expired`.
- `trigger === 'update'` replaces the tokens with the pair supplied by the
  server (used by change password, section 4).

---

## 2. Mail infrastructure (API)

### Port

`apps/api/src/shared/application/ports/mail-sender.interface.ts`:

```typescript
export const MAIL_SENDER_TOKEN = Symbol('IMailSender');

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface IMailSender {
  send(message: MailMessage): Promise<void>;
}
```

### Adapters (`apps/api/src/shared/infrastructure/mail/`)

- `SesMailSender` — `@aws-sdk/client-sesv2` `SendEmailCommand` with
  `FromEmailAddress = MAIL_FROM` and `ConfigurationSetName =
  SES_CONFIGURATION_SET`. Credentials come from the SDK default chain (IRSA on
  EKS). The SDK's `AWS_ENDPOINT_URL` points it at LocalStack in the dev
  cluster.
- `SmtpMailSender` — `nodemailer` against `SMTP_HOST:SMTP_PORT` (Mailpit).
- `MailModule` (global) provides `MAIL_SENDER_TOKEN` through a factory keyed on
  `MAIL_TRANSPORT` (`ses` | `smtp`, default `smtp`), plus `MailService`.

### Templates

`mail/templates/password-reset.ts` and `mail/templates/password-changed.ts`
each export a function `(locale: 'en' | 'vi', params) => { subject, html, text }`
with the `en` and `vi` strings inline. Every interpolated value passes through
a shared `escapeHtml`. Unknown locales fall back to `en`.

| Template | Params | Content |
|---|---|---|
| `password-reset` | `resetUrl`, `ttlMinutes` | Link button, expiry note, "ignore if you did not request this" |
| `password-changed` | `method` (`change` / `reset`), `forgotPasswordUrl` | Confirmation, "if this was not you, reset your password" link |

`MailService.sendTemplate(to, template, locale, params)` renders and sends.

### Delivery

Command handlers publish domain events on the CQRS `EventBus`. These events are
not written to the event store. `@EventsHandler` classes in the auth module call
`MailService` inside `try/catch`:

- on failure: `logger.error({ userId, template, err })` (no email address) and
  `mail_send_failures_total{template}` via the existing `MetricsService`;
- a mail failure never changes the HTTP response.

### Environment (`apps/api/.env.example`)

| Variable | Local | Staging / prod |
|---|---|---|
| `MAIL_TRANSPORT` | `smtp` | `ses` |
| `MAIL_FROM` | `FullStack Monorepo <no-reply@localhost>` | `<Brand> <no-reply@<domain>>` |
| `SMTP_HOST` / `SMTP_PORT` | `localhost` / `1025` | unset |
| `AWS_REGION` / `SES_CONFIGURATION_SET` | unset | from Helm values |
| `WEB_APP_URL` | `http://localhost:3000` | web origin |
| `PASSWORD_RESET_TTL_MINUTES` | `30` | `30` |

### Docker Compose

- New service `mailpit` (`axllent/mailpit`, pinned tag), ports `1025` (SMTP)
  and `8025` (UI + API).
- `api` gets `SMTP_HOST: mailpit` and `depends_on: mailpit`.
- `mise run local:docker:up:api` starts `postgres api mailpit`.
- README and `docs/AGENT_INSTALL.md` mention the Mailpit UI at
  `http://localhost:8025`.

---

## 3. Forgot / reset password (API)

### Table `password_reset_tokens`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `auth_credentials.user_id`, indexed | |
| `token_hash` | `varchar(64)` unique | SHA-256 hex of the raw token |
| `expires_at` | `timestamptz` | `now() + PASSWORD_RESET_TTL_MINUTES` |
| `used_at` | `timestamptz` null | set when used or superseded |
| audit columns | `auditColumns` helper | per repo convention, incl. soft delete |

### Token

32 random bytes, base64url. The raw value exists only in memory and in the
email: never stored, logged, or written to the event store. SHA-256 (not
bcrypt) because the token is high-entropy and must be looked up by hash.
Generation goes through port `IResetTokenGenerator { generate(): { raw, hash };
hash(raw): string }` with `CryptoResetTokenGenerator` as the implementation.

### `POST /api/v1/auth/forgot-password`

Body `{ email, locale? }`. **Always `202` with `data: {}`.**

1. Normalize email (lowercase, trim); load the credential. Missing or
   inactive → log `reason` with no user identifier, return.
2. Per-account limits, checked in the database (correct across pods):
   a token created in the last 60 s, or 5 tokens in the last hour → log and
   return.
3. In one transaction: set `used_at = now()` on the user's unused tokens,
   insert the new token.
4. Publish `PasswordResetRequestedEvent { userId, email, rawToken, locale }`;
   its handler sends `password-reset` with
   `resetUrl = ${WEB_APP_URL}/${locale}/reset-password?token=${rawToken}`.

### `POST /api/v1/auth/reset-password`

Body `{ token, new_password, locale? }`. `200` with `data: {}`.

1. `new_password` follows the register rules (8–128 chars); violations →
   `400 WEAK_PASSWORD`.
2. Look up by `hash(token)` with `used_at IS NULL`, `expires_at > now()`,
   `deleted_at IS NULL`. Unknown, expired and used tokens all return
   **`400 INVALID_RESET_TOKEN`**.
3. In one transaction: update `password_hash`, increment `token_version`, set
   `used_at` on this token and on every other unused token of the user.
4. Publish `PasswordChangedEvent { userId, email, locale, method: 'reset' }`
   (`locale` defaults to `en`).

### Abuse and privacy

- `@Throttle` per IP: forgot-password 3/min, reset-password 5/min. The
  throttler store is in memory, so with N pods the effective IP limit is N×;
  the per-account limits in step 2 are the real guard. Documented as a known
  limitation.
- Add `req.body.token`, `req.body.new_password`, `req.body.old_password` to
  the pino `redact` paths.
- Logs carry `userId`, never the email address.

### Error codes

| Code | Status | Raised by |
|---|---|---|
| `SESSION_REVOKED` | 401 | JWT strategies |
| `INVALID_CURRENT_PASSWORD` | 401 | change password (existing) |
| `WEAK_PASSWORD` | 400 | change / reset (existing) |
| `INVALID_RESET_TOKEN` | 400 | reset password |

### Code layout (auth module)

```
application/commands/request-password-reset/   command, handler, spec
application/commands/reset-password/           command, handler, spec
application/event-handlers/send-password-reset-email.handler.ts
application/event-handlers/send-password-changed-email.handler.ts
application/ports/password-reset-token.repository.interface.ts
application/ports/reset-token-generator.interface.ts
domain/errors/invalid-reset-token.error.ts
domain/events/password-reset-requested.event.ts
domain/events/password-changed.event.ts
infrastructure/persistence/password-reset-token.repository.ts
infrastructure/auth/crypto-reset-token-generator.ts
presentation/dtos/forgot-password.request.dto.ts
presentation/dtos/reset-password.request.dto.ts
presentation/dtos/token-pair.response.dto.ts
```

Schema file: `shared/infrastructure/database/schema/password-reset-tokens.table.ts`.

---

## 4. Web UI

Pattern: server-component page for metadata → client form (react-hook-form +
zod) → web route handler under `app/api/v1/...` (`createApiRoute`) →
`authService` / API client → API.

### Pages

| Route | Group | Behaviour |
|---|---|---|
| `/[locale]/forgot-password` | `(unauthenticated)` | Email form. After submit always shows the neutral "if the email exists, we sent a link" message. Resend disabled for 60 s |
| `/[locale]/reset-password?token=` | `(unauthenticated)` | New password + confirmation. Success → `/<locale>/login?reason=password_reset`. `INVALID_RESET_TOKEN` → "link invalid or expired" with a link to forgot-password. Metadata `referrer: "no-referrer"`, `robots: { index: false }` |
| `/[locale]/settings/security` | `(authenticated)` | Current, new, confirmation. Success → inline confirmation; the user stays signed in |

- Add `/reset-password` to `PUBLIC_ROUTES` (`/forgot-password` is already
  there; `/settings` is already private).
- Navigation user menu links to Settings → Security.
- Login form: "Forgot password?" link; banners for `?reason=password_reset`
  and `?reason=session_expired`.

### Route handlers

- `POST /api/v1/auth/forgot-password` — forwards `email` and the request
  locale.
- `POST /api/v1/auth/reset-password` — forwards `token`, `new_password`,
  locale.
- `POST /api/v1/users/change-password` — reads the access token from
  `auth()`, calls the API, then writes the returned pair into the session with
  NextAuth `unstable_update`. Tokens never reach the browser.

### Services and types

- `authService.forgotPassword`, `authService.resetPassword`,
  `authService.refresh`.
- `userApi.changePassword` returns the token pair.
- `constants/error-codes`: `INVALID_RESET_TOKEN`, `INVALID_CURRENT_PASSWORD`,
  `WEAK_PASSWORD`, `SESSION_REVOKED` with message ids.
- `langs/en.json`, `langs/vi.json`: `pages.forgotPassword`,
  `pages.resetPassword`, `pages.settingsSecurity`, login banners, error
  messages.

---

## 5. SES infrastructure and deployment

### Prerequisite fix

The IRSA role `app_pod` exists in `modules/iam`, but
`infra/codebuild/buildspec-helm-deploy.yml` never annotates the api service
account with it, so api pods have no AWS permissions today.

### New module `infra/terraform/modules/ses/`

- `aws_sesv2_email_identity` for `var.domain_name`, Easy DKIM.
- Route53 records in the zone created by `modules/route53` (new `zone_id`
  output):
  - three DKIM CNAMEs;
  - custom MAIL FROM `mail.<domain>` with its MX and SPF TXT
    `v=spf1 include:amazonses.com ~all`;
  - DMARC TXT `_dmarc.<domain>` = `v=DMARC1; p=none; rua=mailto:<var.dmarc_report_email>`.
- `aws_sesv2_configuration_set` `<project>-<env>` with reputation metrics and
  suppression for `BOUNCE` and `COMPLAINT`.
- Outputs: `identity_arn`, `configuration_set_name`, `configuration_set_arn`.

### IAM

`modules/iam` gains `ses_identity_arns` and `ses_configuration_set_arn`
variables and an `app_pod_ses` policy allowing `ses:SendEmail` and
`ses:SendRawEmail` on those resources, conditioned on
`ses:FromAddress = no-reply@<domain>`.

### Environments

- `envs/staging/main.tf` and `envs/prod/main.tf`: add `module "ses"`, pass
  its ARNs to `module "iam"`, add `dmarc_report_email` variable.
- Codebuild module passes `APP_POD_ROLE_ARN` to the deploy project, alongside
  `LB_CONTROLLER_ROLE_ARN`.
- `buildspec-helm-deploy.yml`, `helm upgrade api`: add
  `--set-string "serviceAccount.annotations.eks\.amazonaws\.com/role-arn=${APP_POD_ROLE_ARN}"`.
- `infra/helm/api/values-{staging,prod}.yaml` `env`: `MAIL_TRANSPORT=ses`,
  `MAIL_FROM`, `SES_CONFIGURATION_SET`, `AWS_REGION`, `WEB_APP_URL`.
- `values-dev.yaml` (kind + LocalStack): `MAIL_TRANSPORT=ses`,
  `AWS_ENDPOINT_URL=http://localstack:4566`; `mise/tasks/dev/infra` verifies
  the identity on LocalStack.

### Manual steps (documented in `docs/infrastructure.md`)

1. Request SES production access per region for staging and prod. In the
   sandbox, SES delivers only to verified addresses.
2. If the domain's DNS is not on Route53, add the DKIM/SPF/DMARC records from
   the module outputs by hand.
3. Watch bounce and complaint rates in the SES console; alerting is
   out of scope.

---

## Testing

Unit tests (Jest, co-located):

- Token service signs `tv`; both JWT strategies reject a mismatched or missing
  `tv` and inactive users.
- `ChangePasswordHandler`: increments `token_version`, returns a pair,
  publishes `PasswordChangedEvent`.
- `RequestPasswordResetHandler`: unknown/inactive email, cooldown and hourly
  limit all return silently; supersedes old tokens; publishes the event with
  the raw token.
- `ResetPasswordHandler`: unknown, expired, used tokens → `INVALID_RESET_TOKEN`;
  success updates the hash, bumps `token_version`, marks tokens used.
- Templates: locale selection, fallback to `en`, HTML escaping, link format.
- Mail event handlers: a sender failure is logged and counted, not thrown.

Integration (TestContainers):

- `PasswordResetTokenRepository` against PostgreSQL.
- `SmtpMailSender` against a Mailpit container, asserting through the Mailpit
  API.

E2E (API, `createTestApp` with an in-memory `MAIL_SENDER_TOKEN` override):

- Login → change password → old access token gets `401 SESSION_REVOKED`,
  returned token works.
- Refresh returns a working pair; refresh after a reset gets `401`.
- Forgot (existing and unknown email both `202`) → token from the captured
  mail → reset → old password rejected, new password works → token reuse gets
  `INVALID_RESET_TOKEN`.

Web (Vitest):

- The three forms: schema, success, error, loading states.
- The three route handlers with `authService` mocked.
- `jwt` callback: refresh near expiry, `RefreshFailed` on `401`,
  `trigger: 'update'`.

Web (Playwright, requires the Docker stack with Mailpit):

- Forgot → read the link from `http://localhost:8025/api/v1/messages` →
  reset → sign in with the new password.
- Change password on Settings → Security → still signed in → sign in with the
  new password after sign-out.

## Rollout

Each step ships on its own:

1. Revocation + `/auth/refresh` + web auto-refresh. Deploying it signs every
   user out once.
2. Mail infrastructure (API port, adapters, templates, Mailpit) + SES
   Terraform + IRSA wiring.
3. Forgot/reset API + password-changed notification.
4. Web UI: three pages, route handlers, i18n, Playwright.

## Known limitations

- Each authenticated request costs one primary-key lookup on
  `auth_credentials`.
- No per-device sessions; revocation is all-or-nothing per user.
- IP throttling is per pod.
- An email lost when a pod dies mid-send is not retried; the user requests
  again.
