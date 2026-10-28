# Sourcewell website refinement

Project: Sourcewell · TASK-001 · status: accepted for integration · 2026-10-28.

## Scope, owners, and contract

- Senior: primary agent, acceptance criteria, independent rendered review, final integration and delivery.
- Worker: one reused subagent, frontend implementation, local checks, screenshots, and this record. These are two actual participants; specialist responsibilities below are sequential responsibilities, not extra reviewers.
- CON-001 v1: existing API requests, responses, authorization, persistence, recorded/live distinction, and backend files remain unchanged. No dependencies, secrets, paid calls, or deployment changes.
- AC-001: concrete product introduction and coherent workspace entry. AC-002: preserve answers, citations, handoffs, knowledge, evaluation, and honest pending/live states. AC-003: usable desktop 1440, mobile 390, narrow 320, keyboard, reduced motion, loading/error/image fallback. AC-004: applicable engineering/browser checks and captures. AC-005: no API/dependency/security scope expansion.

## Direction and selected responsibilities

Read live System Rules, Routing, Definition of Done, Visual Direction, Motion Choreography, Editorial Typography, Responsive Interfaces, Accessible Experiences, and Final Refinement Pass. Selected art direction, frontend, accessibility, and final review responsibilities. Skipped backend/database/provider specialists because CON-001 is unchanged; skipped graphics/3D and new assets because native CSS and the actual product screenshot meet the brief.

Initial forest/ivory editorial hero was approved by the senior in a real browser at 1440 and 390. User then requested glassmorphism and animation. Revised direction: forest text, static sage/mint ambient light, translucent raised panels and navigation, thin highlights, restrained shadows. Native controls remain mostly opaque. Only meaningful surfaces blur; nested rows do not. Opaque defaults precede a CSS support guard, preserving readability without backdrop-filter. The screenshot remains an actual local application capture, not a concept rendering.

## Motion specification

Proof panel enters once on intro mount: 8px vertical transform, 360ms ease-out. New answer card: 6px transform and opacity .65 to 1, 260ms ease-out. Hover/press gives buttons a 1px lift and reversal. Purpose: show a new panel or actionable control, without moving reading content continuously. Native CSS restarts safely on remount and cancels on unmount; no timers or listeners. Mobile uses the same short sequence. Reduced motion removes entrance/lift effects; all content is visible without animation. Results scroll uses instant behavior for reduced motion. No infinite animation, hidden initial content, or animation library.

## Verification ledger

CHK-001 (AC-004/005, local): TypeScript/production build and ESLint pass. Final built bundle: 279.49 kB JavaScript (85.27 kB gzip), 36.25 kB CSS (8.42 kB gzip). These are build sizes, not browser performance measurements. No dependency changes.

CHK-002 (AC-001/003, local independent): Senior inspected editorial prototype in real CUA browser at 1440/390 and approved it. After user direction changed, senior independently approved glass prototype at 390, including readable controls, recorded workspace entry/focus, 16px topbar blur and answer animation. Senior final real-browser review passed at 320 and 1440: no horizontal overflow (320px scroll width), legible heading/actions, readable recorded-refund/source modal, evaluation blur 16px, route main focus and zero scroll. Computed proof duration was .36s and ending transform none; answer animation name was answer-arrive. Browser getAnimations was unavailable through CUA, so no timing recording is claimed.

CHK-003 (AC-002/003/004, local): 22/22 Playwright tests passed across Chromium desktop 1440 and mobile 390, including actual temporary FastAPI/SQLite workflows, simulated reviewer inputs, 320px fallback/reduced-motion layout, hash/bottom-CTA focus and scroll, delayed/failed evaluation responses, recorded answers, citations, session handoff persistence, knowledge/admin and evaluation paths. After correcting the evaluation surface selector and refreshing the preview asset, all eight affected intro/narrow/motion/knowledge-evaluation checks passed again. Added support-guard removal to simulate a browser without blur; both affected desktop/mobile checks passed, proving opaque background and no backdrop filter. This simulates enhancement absence, not an actual old browser. CSS animation assertions prove configuration; senior direct browser interaction supplements timing inspection. No paid provider calls.

CHK-004 (AC-004/005, local): Diff whitespace check passed. Actual screenshots refreshed: introduction desktop/mobile, answer desktop/mobile, workspace, and viewport-only glass-desktop. Public preview is a byte-for-byte copy of the new workspace screenshot, and affected screenshots were regenerated after rebuilding it. Backend/API, lockfiles, environment files, fixtures, and authorization behavior are unchanged. Prior backend evidence remains applicable because backend sources and contracts were untouched; live AI stays blocked by missing credentials.

Tested frontend source/test snapshot SHA-256: `225ad63dd0eca6cd16b877ae90affa1aa361edd686199689f27534985105b84a` (sorted paths plus bytes under frontend/src and frontend/tests). The senior will bind the delivered commit and current CI separately. No physical-device, screen-reader, or browser-frame-performance measurement is claimed; 320px is a narrow-layout check, not a native 200% zoom test.

## Refinement and repair budget

Overall repair allowance: three rounds. Initial implementation and first verification excluded. User direction changes are scope steering, not failed repair rounds. Used: one grouped round (senior found a nonexistent CSS selector; worker corrected it and reran affected checks). Two remain.

- Medium, senior baseline: tall generic aside delayed product visibility. Worker replaced it with concrete recorded-question context and direct demo entry; accepted in editorial prototype.
- Medium, worker: E207 sample link opened default refund example. Aligned proof copy with actual default recorded workflow; verified by CHK-003.
- Medium, senior: bottom CTA kept page scroll and lost keyboard focus. Worker added shared route scroll/focus handling for clicked and browser-hash navigation; verified by CHK-003.
- Medium, worker: absent evaluation data appeared pending during loading/error. Distinct loading and recoverable error copy now avoids implying a measured or pending artifact until data arrives; verified by CHK-003.
- Low, senior: `.eval-overview` did not exist. Worker changed it to `.evaluation-intro`; knowledge/evaluation checks passed again. Fixed in repair round one.
- Low, worker: screenshot could fail without useful recovery. Added semantic fallback and a working demo action; verified by CHK-003.

No claims of real-provider quality, device-wide accessibility compliance, production deployment, or uninterrupted background work. Final commit and CI are the senior integration owners responsibility.
