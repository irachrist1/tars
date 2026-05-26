# Data Safety

TARS touches a person's most private machine. These rules are load-bearing, not aspirational.

## Principles

1. **On-device by default.** Detection and local indexing read the local machine and print results into the local Claude session. Nothing is uploaded, posted, or sent anywhere.
2. **Metadata, not content.** The local index reads file names, sizes, and timestamps. It never opens a file body. (`scripts/index/local-index.mjs` has no read-content path at all.)
3. **Consent before every probe.** Each detection and index step is announced and run only on a yes. Consent for one probe is not consent for the next.
4. **Consent before every mutation.** The scaffold step shows the full proposed structure and the generated `CLAUDE.md` before writing a single file.
5. **Connectors over credentials.** Email, calendar, files, and meetings come through the user's existing Claude connectors (Microsoft 365, Google, Granola). TARS never stores OAuth tokens or client secrets. See `azure-app-registration.md` for the rare deferred case where a raw Graph app is unavoidable.

## Repo hygiene (for whoever develops TARS)

- **Templates are blank and synthetic.** Every shipped template uses placeholders like `Jane Student`, `ACME Corp`, `Course 101`. No real names, emails, financial figures, or journal text ever lands in the repo.
- **`.gitignore` denies by intent.** Secrets, `.env`, tokens, keys, any live vault path, and real-content sample files are excluded.
- **`precommit-scan.mjs` is a hard gate.** It greps staged files for private keys, tokens, emails, and home paths and blocks the commit on a hit. Install it: `npm run install-hooks`.
- **The repo stays private.** Created with `gh repo create tars --private`. Never flipped public.

If you ever find a credential file, a real vault path, or personal data staged for commit: stop, unstage, scrub, and only then proceed.
