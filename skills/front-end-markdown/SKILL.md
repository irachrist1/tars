---
name: front-end-markdown
description: When the user asks for a plan, explanation, overview, dashboard, report, or any document, do not write a markdown file. Build a beautiful, interactive, self-contained HTML page instead and open it in their browser. Use when the user says "explain this as a page", "make me a dashboard", "show me the plan", or any time a markdown deliverable would normally be the answer.
---

# Front-end instead of markdown

Markdown files are for machines. People deserve a page. When you would normally hand the user a `.md` file, hand them a single `.html` file that looks like it came from a top design studio, opens in their browser, and explains itself as they scroll.

One file. No build step. No npm. No external dependencies. Inline CSS, inline JS, inline SVG. The user double-clicks it and it works forever.

## Where it goes

Write to `~/Downloads/<topic>.html` (or the project folder if the user says so), then run `open <file>` so it appears immediately. Iterate from their screenshots.

## The writing

This matters more than the visuals. Every word follows these rules:

- **Write like you talk.** The reader is your mom, your dad. If a sentence would sound strange said across a table, rewrite it.
- **No dashes. Ever.** Not em dashes, not hyphens used as pauses. Use a comma or two sentences.
- **No filler labels.** Never write "Overview", "Introduction", "The big picture", "Here is exactly what happens". Say the thing itself: "The problem is not memory." "Here is how it works."
- **One idea per screen.** A slide earns its place by making one point. If it makes two, split it.
- **Pitch structure** when the page sells or explains a thing: the problem people actually feel → why the current way fails → the solution → how it works → how to get it. If the solution slide is strong enough, cut the "why current tools fail" slide.
- **Specific beats general.** "Prep me for 3pm ACME with last year's numbers" beats "ask it anything about your work."

## The design system

Default look (override only if the user has a brand):

```css
--cream:  #f7f4ef;   /* page background, warm not white */
--ink:    #1a1a1a;   /* text and dark blocks */
--muted:  #9a9a8e;   /* secondary text */
--border: #e0dbd2;   /* hairlines and card edges */
```

- Headlines: `Georgia, serif`, large (clamp 26px to 42px+), weight 400, tight letter-spacing. The hero title can be massive (100px+).
- Body: system sans (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`), 15 to 17px, line-height 1.6 to 1.75, color #4a4a4a.
- Cards: white, 1px `--border`, radius 14 to 16px, generous padding.
- Dark accents: one `--ink` block per page maximum (a center node, a hero object). Restraint is the style.
- Whitespace is a feature. If a slide looks empty, add one meaningful graphic, not more text.

## Layout: full-screen slides that click into place

```css
html { scroll-snap-type: y mandatory; overflow-y: scroll; height: 100%; }
.slide { height: 100vh; scroll-snap-align: start; display: flex; align-items: center; }
```

Hard-won rules (these were real bugs):

1. **Every tall section needs snap points inside it.** A sticky/pinned section taller than 100vh with no internal snap targets makes the browser jump the user back. Add invisible `<div class="snap-step" style="height:100vh; scroll-snap-align:start">` children, one per reveal step.
2. **One reveal per snap step.** If a pinned section reveals N cards, give it N-1 snap-step divs and compute `revealed = round(progress × (N-1)) + 1`. Landing on a step shows exactly one more card.
3. **Reveals stack down, never flicker up.** Track a `maxRevealed` that only grows while inside the section; reset it only when the user scrolls fully above the section. Scrolling up inside the section keeps everything visible.
4. **Center the content.** Give every slide an inner wrapper with the same `max-width` (about 1020px) and `margin: 0 auto`. Pinned sections too, or they hug the left padding while the rest of the page is centered.

## Graphics: draw, don't decorate

- **Never use emojis as icons.** Use inline SVG strokes (Lucide style: `fill="none" stroke-width="1.5-1.8" stroke-linecap="round"`).
- **Use official brand marks** for real products (Claude, OpenAI, GitHub...). Find the real path data; people recognize the genuine mark instantly and an approximation reads as fake. Put marks in `<defs>` once, reuse with `<use href="#id">`. No text label needed under a famous logo.
- **Tell the story in one SVG scene** where you can: a person with a speech bubble, arrows to systems, a colored response bubble. A good scene replaces a paragraph.
- **Architecture diagrams**: evenly spaced source boxes on top, one dark center node, destinations below, dashed connector lines (`stroke-dasharray="5,4"`, color #c8c2ba). Count the columns and space them evenly across the full viewBox width; a lopsided gap looks broken.
- **Ambient canvas backgrounds** (constellation dots) are nice but: keep them sparse (about 18 dots), faint, and confined away from text (cap their y range). They are texture, not content.

## Motion: the page should feel alive

- **Entrance:** stagger the hero elements with `animation: fadeUp .9s ease both` and increasing delays (0.1s, 0.3s, 0.5s).
- **Scroll reveal:** IntersectionObserver adds `.in` → `opacity:1; transform:none`. Start state: `opacity:0; translateY(14-24px)`.
- **Blur-in for cards:** start `filter: blur(14px)` + translateY + slight scale-down, transition with `cubic-bezier(0.16,1,0.3,1)`. Feels expensive, costs nothing.
- **Click-to-copy chips** for any command or key: monospace pill, copy icon, on click overlay a green "Copied ✓" that slides up, hold 1.6s, slide away. Always include the `navigator.clipboard` + `execCommand` fallback.
- **3D objects** when the page has a mascot or hero object: parent with `perspective: 1000px`, child with `transform-style: preserve-3d`, layers separated by `translateZ`. Drag to rotate (clamp X tilt to ±40°), hover tilts toward the cursor, mouse-leave eases back to the resting pose. Disable the transition while dragging, restore it on release.
- Use `prefers-reduced-motion` awareness for anything large if the page is going public.

A complete starter with all of this wired up is in `references/template.html`. Read it, adapt it, do not regenerate these mechanics from scratch.

## Interactive data (dashboards)

When the content is numbers, not narrative:

- Counters that count up on first reveal (IntersectionObserver + requestAnimationFrame).
- Bars and sparklines as inline SVG sized by the data; animate width/points on reveal.
- A row of stat cards beats a table; a table beats a paragraph of numbers. Max 4 columns.
- Keep every figure honest: if the data came from somewhere, put the source in small muted text on the card.

## What this skill never does

Never produces a wall of text with headers. Never uses Mermaid (it renders ugly and tiny; hand-drawn SVG always wins). Never links to CDNs the file will die without. Never ships an emoji where an icon should be. Never makes the user scroll three screens to learn one thing.
