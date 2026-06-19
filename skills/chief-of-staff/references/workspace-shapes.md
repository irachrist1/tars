# Workspace shapes (synthetic examples)

Load this only when creating or restructuring workspace files. All names below are synthetic. Shapes are targets, not straitjackets — fit the user, keep the caps.

## MAP.md (cap ~250 lines)

```markdown
# Map — Jane Doe's work
Root: OneDrive/Work. Last refreshed: 2026-06-10.

## Clients & entities
- **ACME Corp** — active. Audit + advisory. → Clients/ACME.md
- **Globex** — warm; last touched April. Tax only. → Clients/Globex.md
- **Initech** — dormant since 2024. Archive: Work/Clients/Initech/.

## Areas
- **Work/Clients/<name>/** — one folder per client, year subfolders. The canonical store.
- **Work/Proposals/** — all proposals, incl. templates. Precedents live here.
- **Work/Firm/** — internal: policies, staffing, partner meeting notes.
- **Work/_Old laptop dump/** — unsorted pre-2019. Cold; search only on request.

## Precedents (how things get made)
- Proposal: Work/Proposals/2025 ACME advisory proposal.docx (her best, confirmed)
- Engagement letter: Work/Clients/ACME/2025/engagement-letter-final.docx
- Monthly report: Work/Clients/Globex/2025/Q3 report.docx

## Rhythms
- Mondays: partner meeting (notes in Work/Firm/Partner meetings/).
- Month-end: client reports due by the 5th.

## Unplaced (ask when natural)
- Work/RWA-Restructure/ — could be ACME or Globex; not yet confirmed.
```

## USER.md (cap ~100 lines)

```markdown
# Jane Doe
Partner-track manager, ACME Advisory practice. Runs 4 client engagements + firm staffing.

## Priorities (her words, 2026-06)
1. Keep ACME renewal on track. 2. Stop deadlines slipping across clients.

## Corrections & preferences (dated)
- 2026-06-10: Call the client "ACME", never "ACME Corp Ltd", in drafts.
- 2026-06-10: Reports: lead with the number, then the narrative. No exec-summary fluff.
- 2026-08-01: M. Rivera (former ACME contact) — no longer involved; do not list as active.

## Boundaries
- Never send email without showing her first (default rule anyway).
- Never touch Work/Firm/Compensation/.
```

## Clients/<name>.md (cap ~1 page)

```markdown
# ACME Corp — active
Folders: Work/Clients/ACME/ (canonical), Work/Proposals/ (their proposals).
Key people: J. Smith (CFO, jsmith@acme.example), L. Wu (controller).

## Open items
- Renewal proposal — draft due Fri 2026-06-13. Precedent: 2025 proposal (above).
- Q2 fee reconciliation — waiting on L. Wu since 2026-06-03 (thread: "Q2 fees").

## Recent
- 2026-06-09 meeting "ACME quarterly" — transcript on calendar event; decisions: scope holds, fee +5%.
- Last filed doc: 2026-06-08 "Q2 fee schedule v2.xlsx".

## Notes
- Their fiscal year ends September. Audit partner is M. Rivera, not Jane.
```

## LOG.md (keep last ~50 lines; older months fold into ARCHIVE.md as one digest line each)

```markdown
# Log
- 2026-06-10 Created workspace (map, user, 3 client briefs) at onboarding.
- 2026-06-10 USER.md: added naming preference ("ACME").
- 2026-06-11 ACME brief: renewal deadline moved to Fri; map: placed RWA-Restructure under ACME (confirmed by Jane).
```

## ARCHIVE.md (never loads at session start; query on demand; date + reason on everything)

```markdown
# Archive
> Demoted past. Not loaded at session start, not used as evidence by default.
> Query when Jane asks about history.

## Archived 2026-09-02 (USER.md over cap)
- Preference "lead with the number" superseded 2026-08-30 by "one-line verdict first, then the number".

## Archived 2026-08-15 (matter closed)
- ACME Q2 fee reconciliation — resolved 2026-08-12, L. Wu paid revised schedule. Was an open item since June.

## Log digests
- 2026-06: workspace created; 14 changes, mostly ACME renewal tracking. Detail dropped.
```

## Clients/Archive/ (ended clients)

When a client ends: move `Clients/<name>.md` to `Clients/Archive/<name>.md` whole, add a closing line at its top ("Ended 2026-08: engagement completed"), and shrink the map entry to a tombstone — `**Initech** — ended 2026-08. Brief: Clients/Archive/Initech.md. Files: Work/Clients/Initech/.`

## ALIASES.md (cap ~50 lines)

Shorthand and typos the user uses for known entities. Consult before searching.

```markdown
# Aliases
> Shorthand → canonical name. Add when the user corrects you.

| Shorthand | Canonical | Notes |
|-----------|-----------|-------|
| acme | ACME Corp | user types lowercase |
| globex tax | Globex | tax-only engagement |
| mima | Mima Holdings | common typo for "Mima" |
```

When the user refers to a client loosely and you find the match in the map, add the
alias so you never search the wrong name again.
