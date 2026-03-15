# Database Diagram

```mermaid
erDiagram
    users {
        uuid id PK
        varchar(255) email UK "NOT NULL"
        varchar(30) username UK "NOT NULL"
        boolean is_active "NOT NULL, DEFAULT true"
        timestamp created_at "NOT NULL, DEFAULT now()"
        uuid created_by "nullable"
        timestamp updated_at "NOT NULL, DEFAULT now()"
        uuid updated_by "nullable"
        timestamp deleted_at "nullable (soft delete)"
        uuid deleted_by "nullable"
    }

    auth_credentials {
        uuid user_id PK
        varchar(255) email UK "NOT NULL"
        varchar(30) username UK "NOT NULL"
        varchar(255) password_hash "NOT NULL"
        boolean is_active "NOT NULL, DEFAULT true"
        timestamp last_login_at "nullable"
        timestamp created_at "NOT NULL, DEFAULT now()"
        uuid created_by "nullable"
        timestamp updated_at "NOT NULL, DEFAULT now()"
        uuid updated_by "nullable"
        timestamp deleted_at "nullable (soft delete)"
        uuid deleted_by "nullable"
    }

    domain_events {
        uuid id PK
        varchar(255) stream_id "NOT NULL, INDEX"
        varchar(100) event_type "NOT NULL"
        jsonb payload "NOT NULL"
        bigint version "NOT NULL"
        timestamp occurred_at "NOT NULL"
    }

    roles {
        uuid id PK "DEFAULT random()"
        varchar(50) name UK "NOT NULL"
        varchar(255) description "nullable"
        boolean is_active "NOT NULL, DEFAULT true"
        timestamp created_at "NOT NULL, DEFAULT now()"
        uuid created_by "nullable"
        timestamp updated_at "NOT NULL, DEFAULT now()"
        uuid updated_by "nullable"
        timestamp deleted_at "nullable (soft delete)"
        uuid deleted_by "nullable"
    }

    permissions {
        uuid id PK "DEFAULT random()"
        varchar(100) name UK "NOT NULL, e.g. 'users.create'"
        varchar(255) description "nullable"
        boolean is_active "NOT NULL, DEFAULT true"
        timestamp created_at "NOT NULL, DEFAULT now()"
        uuid created_by "nullable"
        timestamp updated_at "NOT NULL, DEFAULT now()"
        uuid updated_by "nullable"
        timestamp deleted_at "nullable (soft delete)"
        uuid deleted_by "nullable"
    }

    role_has_permissions {
        uuid role_id PK,FK
        uuid permission_id PK,FK
        timestamp created_at "NOT NULL, DEFAULT now()"
    }

    model_has_roles {
        varchar(50) model_type PK "e.g. 'user'"
        uuid model_id PK "polymorphic, no FK"
        uuid role_id PK,FK
        timestamp created_at "NOT NULL, DEFAULT now()"
    }

    model_has_permissions {
        varchar(50) model_type PK "e.g. 'user'"
        uuid model_id PK "polymorphic, no FK"
        uuid permission_id PK,FK
        timestamp created_at "NOT NULL, DEFAULT now()"
    }

    users ||--|| auth_credentials : "user_id = id"
    users ||--o{ domain_events : "stream_id = 'user-{id}'"
    roles ||--o{ role_has_permissions : "has"
    permissions ||--o{ role_has_permissions : "belongs to"
    roles ||--o{ model_has_roles : "assigned to"
    permissions ||--o{ model_has_permissions : "assigned to"
```

## Notes

- **users** — Read model projection of user aggregates. Denormalized for fast queries.
- **auth_credentials** — Stores login credentials (email, username, bcrypt hash). Separate from users for bounded context isolation (Auth vs User).
- **domain_events** — Event store. Each aggregate stream is identified by `stream_id` (e.g., `user-<uuid>`). Optimistic concurrency enforced via `UNIQUE(stream_id, version)`.
- **roles** — Named roles (e.g., `super-admin`, `editor`). Soft-deletable with audit columns.
- **permissions** — Dot-notation namespaced capabilities (e.g., `users.create`, `roles.read`). Soft-deletable with audit columns.
- **role_has_permissions** — Pivot table linking roles to permissions. Composite PK, no audit columns, hard-deleted.
- **model_has_roles** — Polymorphic pivot: assigns roles to any model type (currently `user`). `model_type` + `model_id` identify the entity. No FK on `model_id` — integrity enforced at app layer.
- **model_has_permissions** — Polymorphic pivot: assigns direct permissions to any model type. Same polymorphic pattern as `model_has_roles`.
- **Audit columns** (`created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `deleted_by`) are shared across `users`, `auth_credentials`, `roles`, and `permissions` via `auditColumns` helper. Pivot tables only have `created_at`.
- **Soft deletes** — `deleted_at` marks records as deleted without removing them. All queries must filter `WHERE deleted_at IS NULL`.
