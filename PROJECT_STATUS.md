# Sourcewell build status

## Objective
Ship the working local Sourcewell application and push it to Xeyzen7959/sourcewell. Preserve public repository visibility; do not deploy.

## Milestones
- [x] Ingestion, retrieval, structured generation, and citation validation.
- [x] Connected Ask, Knowledge, Inbox, and Evaluation screens.
- [x] Offline tests, live smoke-test entry point, documentation, and screenshots.
- [ ] Commit, push, verify remote commit and GitHub Actions.

## Constraints
No OpenAI API key is configured in this build environment. Live calls and real semantic/hybrid benchmark results remain unverified until a key is supplied. Recorded examples and deterministic tests must stay explicitly labeled.

## Local verification
26 backend tests and six Playwright desktop/mobile checks pass. Frontend production build and lint checks pass. Docker is not installed in this environment, so container startup remains unverified. The live smoke command reports the missing API key explicitly. Dataset annotations require human review.
