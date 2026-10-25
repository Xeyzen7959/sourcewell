# Webhook delivery

Category: Developers
Effective: 2026-10-01 unless another date is explicitly stated below.
Fictional Cedarline Cloud documentation.

## Policy and procedure

Cedarline signs webhook payloads with HMAC-SHA256 using the endpoint secret. Verify signatures before processing events. Each event includes a stable event_id; use it for idempotency. Failed deliveries are retried three times over 15 minutes. Never expose the endpoint secret to clients.
