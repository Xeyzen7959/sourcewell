# Deployment proposal — awaiting owner approval

No service, key, budget, disk, subscription, or public deployment has been created for this upgrade. The checked-in configuration is preparation only.

## Proposed host

Use one Render Docker web service in Singapore on plan **`1c-2g` (1 CPU, 2 GB RAM; formerly Standard)** with a **1 GB persistent disk at `/app/data`**. Keep exactly one instance and one Uvicorn worker.

Render's published price checked on 2026-10-25 is USD 25/month for this compute plan and USD 0.25/GB/month for persistent disks: **approximately USD 25.25/month base infrastructure**, plus provider usage, applicable tax, and any bandwidth/build/workspace overages. A free Hobby workspace may be sufficient; verify the actual account quote before approving. No paid workspace upgrade is assumed.

The 512 MB plan is cheaper but is not the default proposal because Python plus Chroma needs memory headroom. Actual hosted memory and performance still require verification. Do not promise that a free ephemeral service will retain SQLite or Chroma state.

Sources: [Render pricing](https://render.com/pricing), [current compute plan IDs](https://render.com/docs/compute-plans), [persistent disks](https://render.com/docs/disks), [Blueprint specification](https://render.com/docs/blueprint-spec).

## Concrete approval required

Applying `render.yaml` will create the paid web service and its disk and publish a publicly accessible demo. Obtain owner approval for that exact action and its estimated cost first. The prepared Blueprint disables automatic deploys; pushing source does not itself authorize provisioning or publishing.

AI Gateway is a separate account connection. Local/Render hosting requires a Gateway API key, not Velosync's automatic Vercel deployment identity. Reuse an existing authorized key privately or create a dedicated key only with owner authorization. Shared keys/accounts share billing and rate limits; a dedicated Sourcewell key permits separate controls. Do not buy credits or raise any budget without approval.

## Why this hosting fits

SQLite, Chroma vectors, session records, review records, and provider-call reservations live under the mounted DATA_DIR. Everything outside that path is ephemeral. Never move the daily usage ledger onto temporary storage or recreate it during an update; that would reset the application's daily safeguard.

The container entry point creates the mount directory, fixes only that directory's ownership when starting as root, then drops groups/GID/UID to 10001 before executing Uvicorn as PID 1. It does not recursively change restored files. Maintain owner 10001:10001 on restored data files. Operator `docker exec` commands should explicitly use `--user 10001:10001`.

The public deployment exposes only seeded fictional documents. Administrative upload/index/review endpoints are disabled. Public and local session histories use distinct owner namespaces. Public records become inaccessible at their retention deadline and are removed on startup and hourly thereafter.

## Configuration before publication

1. Review the final Git commit, green CI, Docker smoke result, and provider connection status.
2. After owner approval, create/sync the Blueprint from `render.yaml` on the existing GitHub repository.
3. Set `AI_GATEWAY_API_KEY` privately in Render's environment settings. Do not put it in the Blueprint, build arguments, or source files.
4. Keep `APP_MODE=public`, `COOKIE_SECURE=true`, `DATA_DIR=/app/data`, and one instance. The default proposal uses `google/gemini-2.5-flash-lite` and `openai/text-embedding-3-small`, verified in Gateway's live catalog on 2026-10-25. Verify account access and current pricing again before live use.
5. Set optional token prices only after verifying them. An unknown price remains unavailable, not zero. The application operation cap is not a guaranteed dollar budget.
6. Start with 100 provider operations/day, 12 requests/minute/IP, two simultaneous live requests, 1,200-character questions, 4,000 output tokens per generation/assessment operation, and 24-hour public record retention.
7. The entry point derives PUBLIC_ORIGIN from Render's supplied HTTPS `RENDER_EXTERNAL_URL`. Set it explicitly when using a custom domain. The Blueprint trusts forwarded headers because Render's edge terminates incoming traffic. Do not reuse `FORWARDED_ALLOW_IPS=*` on an origin directly reachable outside its trusted proxy.
8. Index only the seed corpus after approval. In Render's Docker shell, run the command as the application user, preserving server environment variables:

```bash
su --preserve-environment --shell /bin/sh sourcewell -c '/app/.venv/bin/python -m scripts.manage index'
```

This step makes real embedding calls and counts against the persistent daily cap. Startup does not silently make paid indexing calls.

## Health and acceptance checks

- `/api/health`: process liveness; no provider call.
- `/api/ready`: database and seeded corpus available for recorded workflows; no claim of live model verification.
- Confirm the introduction, preview image, and direct `/#ask` workspace load over HTTPS.
- Verify a recorded answer and citation, then a bounded real question after indexing.
- Verify provider errors stay explicit, and exhausted capacity offers a deliberate switch to recorded examples.
- Use separate browser sessions to verify ticket isolation. Confirm no administrator controls, private uploads, local tickets, or review-write routes are public.
- Check Secure/HttpOnly/SameSite cookies, the correct HTTPS origin, memory, latency, and actual usage. TLS/proxy/account checks remain unverified until deployed.

Do not run the full evaluator on the public service. Evaluate in its isolated local seed index after a separate budget approval, review the artifact, then deploy that artifact as source.

## Persistence, backups, and rollback

Before any schema-changing update, pause traffic/stop the service and make a consistent backup of the entire DATA_DIR, including SQLite and Chroma. Do not copy a busy SQLite database while ignoring its WAL. Use a supported disk snapshot/backup workflow with the application quiesced and verify restore ownership. Treat old backups as sensitive session data with a defined deletion schedule.

1. Record the deployed commit and a verified data backup before updating.
2. Keep automatic deploys off. Manually deploy the reviewed commit and run health/acceptance checks.
3. If acceptance fails, stop traffic and redeploy the previous known-good commit.
4. If that commit is incompatible with the current schema, restore the matching consistent backup first, then apply the old code. Keep the usage ledger at least as restrictive as before rollback so usage limits cannot be reset by restoring an earlier snapshot.
5. Recheck public-mode restrictions, source index compatibility, and live behavior before reopening traffic.

Persistent disks restrict this service to one instance and disable zero-downtime deploys. Expect a brief interruption during updates. There is no high-availability or uptime guarantee.

## Validation state

The Blueprint was validated locally against Render's official JSON schema. Deterministic tests cover public restrictions, session expiry, concurrency limits, provider failure handling, review provenance, and entry-point privilege dropping. CI additionally builds and starts the actual Docker image. No Render provisioning, HTTPS routing, hosted restore, or real provider connection is implied by those checks.
