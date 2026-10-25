# Sourcewell build status

## Objective

Deliver a results-focused portfolio application in the existing Xeyzen7959/sourcewell repository. Preserve repository history and visibility. Prepare hosting without provisioning or publishing.

## Completed implementation

- Introduction with an actual workspace screenshot, direct demo access, GitHub link, evidence workflow, and honest pending results.
- Existing ingestion, semantic/hybrid retrieval, structured answers, citation checks, support assessment, and session-specific handoffs retained.
- Optional Vercel AI Gateway connection through the installed OpenAI SDK. Models remain configurable. Velosync uses Vercel deployment OIDC, so there is no portable API key in its local configuration.
- Audited draft annotations; corrected three obvious inconsistencies. All 60 cases remain unreviewed by a human, with development and held-out splits preserved.
- Local administrator review forms, corrections, reviewer/date/attestation records, export, source fingerprints, and a separate run-specific human answer rubric.
- Failure-aware evaluation denominators, semantic/hybrid comparison, per-case errors, token usage, unknown costs, sample-aware latency statistics, and artifact freshness checks.
- Seed-only public mode, disabled administration, public/local history separation, bounded request bodies and outputs, atomic daily operation cap, rate/concurrency limits, explicit recorded fallback, HTTPS cookies, and public record expiry/cleanup.
- Prepared Render Blueprint, container startup permissions, readiness checks, backup/rollback instructions, and CI container smoke checks.

## Verification

- 46 backend tests pass, including mocked SDK transport, review provenance, stale artifacts, failure denominators, isolation, retention, limits, and container entry-point behavior.
- 14 Playwright checks pass across desktop and mobile. They exercise recorded workflows and simulated reviewer input in temporary test data; they do not constitute human dataset review or real-provider verification.
- Frontend type check, lint, and production build pass. Python lint passes.
- Screenshots are generated from the working application. Introduction captures use fresh test data with zero reviewed annotations.
- Render configuration validates against the official Blueprint JSON schema. Docker is unavailable on the local host; GitHub Actions builds and boots the actual image. Consult the delivery message or the current Actions run for its observed result.
- Delivery includes a normal push to the existing main branch, followed by remote commit and Actions verification. No force-push, resource purchase, visibility change, or deployment is authorized by that push.

## Precise blockers and limits

- No portable provider credential is configured. Live smoke testing, real embedding/indexing, generation, support assessment, and live handoff verification remain blocked. Mocked and recorded tests are explicitly separate.
- Local `.env` selects Vercel Gateway and has an empty `AI_GATEWAY_API_KEY`. Configure that key privately there, then restart and run the bounded smoke test. Do not paste secrets into chat or commit them.
- No live benchmark artifact or quality percentages have been produced. Human review count is zero. A substantial benchmark requires a separate estimated-budget approval; held-out cases must not be used for tuning.
- Render proposal: one `1c-2g` instance in Singapore with a 1 GB persistent disk, approximately USD 25.25/month base infrastructure plus provider usage, tax, and overages. Applying the Blueprint would create paid resources and publish the demo; owner approval is still required.
- Hosted TLS/proxy routing, actual resource use, and backup restore remain unverified until an approved deployment is tested.
