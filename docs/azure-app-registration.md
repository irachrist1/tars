# Azure App Registration — DEFERRED, optional

> **You almost certainly do not need this.** TARS reaches Microsoft 365 (email, calendar, OneDrive, Teams) through the Claude **Microsoft 365 connector**. The user clicks Connect once in their Claude client. No app registration, no OAuth code, no token storage, no client secret to protect. That is the default and it is strictly simpler and safer.
>
> This document exists for the one case the connector cannot serve: **headless automation outside a Claude client**, or a client who refuses connectors and needs a raw Graph integration. Do not build this in Phase 0.

## If you ever do need a raw Graph app

Register it **multi-tenant + personal Microsoft accounts** (the `common` authority). Do **not** lock to single-tenant. Two reasons:

1. A school- or company-managed tenant (for example an `*.edu` or student account) very likely blocks app registration or requires admin consent you cannot grant yourself. Single-tenant there is a dead end.
2. The product must eventually work against other people's tenants and personal accounts (consulting clients on their own Microsoft 365). Single-tenant is wrong for the product, not just for one user.

### Registration steps

1. Azure Portal → Microsoft Entra ID → App registrations → **New registration**.
2. **Supported account types:** *Accounts in any organizational directory and personal Microsoft accounts* (this is the `common` authority).
3. **Redirect URI:** Platform *Mobile and desktop applications*, value `http://localhost`.
4. Authentication → enable **Allow public client flows**. This makes it a **public client** using auth-code + **PKCE**, so there is **no client secret** to store or leak. Never create a client secret for this.
5. API permissions → Microsoft Graph → **Delegated** → add the minimal read-only set below → leave consent to the signing-in user.

### Minimal Phase-0 scopes (read-only)

| Scope | Why |
|---|---|
| `openid`, `profile` | sign-in |
| `User.Read` | confirm identity |
| `Mail.Read` | recent threads for the brief |
| `Calendars.Read` | meetings for the brief |
| `Files.Read` | own OneDrive recent files for the index |
| `offline_access` | refresh token, no re-auth each run |

No write scopes. Mutation, if it ever arrives, goes behind the consent gate with its own narrowly-scoped grant.

### What you store

Only the **client ID** and **tenant value** (`common`), in a local config file kept **outside** the vault and **outside** this repo (it is git-ignored). Never a secret. Never a token in markdown.

### If a managed tenant fights the consent

If a school/work account blocks the grant, fall back to a **personal Microsoft account** for testing. Because the app is registered on the `common` authority, the same app works for both. Note which account you used and move on.
