# JULES & CO — CLAUDE.md

Guidance for Claude Code sessions working in this repo. See [README.md](README.md) for product vision, architecture, and setup instructions.

## Working conventions

- This is an **npm workspaces** monorepo (`frontend`, `backend`). Install/build/test from the repo root using `-w frontend` / `-w backend` flags, not inside the subfolders.
- `backend/.env.example` is **tracked** — it must only ever contain placeholder values. Real secrets (MongoDB URI, JWT secret, Cloudinary keys, etc.) go in `backend/.env`, which is gitignored. Same rule applies to `frontend/.env.local` vs `frontend/.env.local.example`.
- Large feature work happens on a dedicated branch in a git worktree under `.claude/worktrees/<name>/`, driven by a plan file in `docs/superpowers/plans/`. Check `.claude/worktrees/` for in-progress work before starting something that might duplicate it.
- Plans under `docs/superpowers/plans/` use TDD, task-by-task commits via the `subagent-driven-development` or `executing-plans` skill.

## Build log

Every build/feature pass done in this repo should get a dated entry here — a few lines: what changed, where, and any decision worth remembering (not a full changelog, git history covers that).

### 2026-08-17 — Env credential cleanup + admin dashboard continuation
- Found real MongoDB Atlas credentials had been pasted into the tracked `backend/.env.example`. Moved them to `backend/.env` (gitignored) using the `MONGO_URI` variable name the code actually reads (`backend/src/config/db.js`); restored `.env.example` to placeholders. Verified the Atlas connection live.
- Admin dashboard (Phase 3 of the roadmap) is being built in worktree `.claude/worktrees/admin-dashboard-phase-1` on branch `worktree-admin-dashboard-phase-1`, driven by `docs/superpowers/plans/2026-08-17-admin-dashboard-phase-1.md` (25 tasks), using the `subagent-driven-development` skill. Its own progress ledger lives at `.claude/worktrees/admin-dashboard-phase-1/.superpowers/sdd/2026-08-17-admin-dashboard-phase-1/progress.md` — check there for task-by-task detail before re-deriving status from scratch.
- Tasks 1–18 committed (through the categories admin page). Paused after Task 18 on an account-level session usage limit hit during subagent dispatch — remaining tasks 19–25 (product list/form tabs, inventory matrix, cross-sell wiring, Playwright e2e) not yet started.

### 2026-08-17 — Full rebrand: Aura & Optic → JULES & CO
- User supplied the real business logo (gold sunglasses mark + wordmark on black, tagline "Wear the Difference"), previously mis-saved as `frontend/public/images/products/jc0015.jpg` (looked like a product photo). Extracted it into proper web assets under `frontend/public/images/brand/`: transparent-bg header/footer lockups (`logo-header.png`, `logo-footer.png`), a glyph-only mark (`logo-mark.png`), favicons at 16/32/192/512px, an `apple-icon.png`, and an OG share image (`og-image.jpg`). Original raw file kept as `logo-source-original.jpg` in the same folder; nothing left in `products/`.
- Sampled the logo's actual gold (`#CDAD54`) and updated `frontend/tailwind.config.ts`'s `gold.DEFAULT`/`gold.dark` tokens to match — the existing obsidian/alabaster/gold palette was already close in spirit, so this was a tune, not a redesign.
- Renamed every "Aura & Optic" occurrence across root/frontend/backend `package.json` names, `backend/server.js` boot log, all page metadata (title/description/OG, favicon links added — none existed before), Header/Footer (now render the actual logo image instead of a text wordmark), Hero eyebrow (now "Wear the Difference"), BrandStory origin copy (rewritten, not just swapped), footer tagline, copyright line, and the testimonial fixture in `mockData.ts`.
- Renamed the Zustand persist localStorage keys (`aura-optic-cart` → `jules-and-co-cart`, `aura-optic-wishlist` → `jules-and-co-wishlist`) — safe since the site is pre-launch with no real user data to migrate.
- **Not yet done, by design:** the `.claude/worktrees/admin-dashboard-phase-1` worktree (in-progress admin dashboard branch, tasks 1–18/25 committed) still has its own "Aura & Optic" copies in admin pages/seed data — deliberately left alone to avoid conflicting with that branch's uncommitted task history. Rebrand it in a follow-up pass once that branch is ready to merge.
- **Also still pending:** the repo root folder itself is still named `jules&co` on disk (contains a literal `&`, which is unrelated to this branding pass — see the earlier root-folder-rename conversation). That rename still requires closing the session/editor first; see prior guidance in this file's history if picked back up.
