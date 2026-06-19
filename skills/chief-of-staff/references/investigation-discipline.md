# Investigation discipline

Load this when answering status questions, recurring deliverables, "what's missing,"
"who provides this," or anything that depends on more than one source.

The failure mode: concluding from a single source (a folder, a filename, a cc line) and
skipping the rest. The fix: **verify each source separately, then conclude.**

## The verify-then-conclude loop

For any multi-source question:

1. **Identify all inputs** — what documents, people, and providers does this depend on?
2. **Check each in files** — local folder, connector search, scan skeleton.
3. **Check each in mail** — inbox, then **sent items**, then the live thread.
4. **Only then conclude** — with citations, or label gaps as unconfirmed.

Never skip step 3 because the folder "looks empty." Never skip sent mail.

## Recurring deliverables

Monthly reports, fee packs, consolidation inputs, board packs:

- **Each input has its own provider.** Verify each one separately in mail. Never merge
  two sibling inputs under one provider because they sit in the same folder.
- **Folder structure is a hint, not evidence.** Two sub-entity reports in one parent
  folder may come from two different accountants.
- Before saying an input is **missing** or offering to **draft a request email**:
  check sent items and the thread. The user may have already asked and received a reply.

## Provenance — who provides what

- **Never assert provenance from a filename.** "Budget from OrgA & PartnerB" because the
  file is named that way is not evidence.
- Trace the **actual sender** in mail (received date, from line, thread). If you cannot
  trace it, say **"unconfirmed — I see the file but haven't verified who sent it."**
- If a named person has **no email contact** in the mailbox, do not claim they supply
  anything until mail proves it.

## Entity modeling

Do not treat every folder as a separate reporting entity.

| Kind | What it is | How to handle |
|------|------------|---------------|
| **Reporting entity** | Legally distinct, own books, consolidates or stands alone | Own client brief |
| **Program / class** | Donor-funded initiative or cost center *inside* one entity's books | Note under the parent entity; not a separate consolidation line |
| **Subsidiary** | Separate legal entity that **consolidates into** a parent via intercompany | Brief under parent with consolidation note; don't "park" it as unrelated |

When structure is ambiguous, **confirm once** and record in the map. Never invent.

## People maps — who is actually involved

- **Cc presence ≠ active involvement.** Someone cc'd on old threads is not an active
  contact unless they have recent two-way interaction.
- Weight by: direct replies, meetings they attended, documents they sent — not mere
  inclusion on a distribution list.
- When the user says someone is **no longer involved**, record it in `USER.md` under
  Corrections and do not re-add them to active-contact lists.

## Shorthand and typos

Before searching for a client name the user typed loosely, check `ALIASES.md`. Map
shorthand to the canonical entity; add new aliases when the user corrects you.
