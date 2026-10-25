# API rate limits

Category: Developers
Effective: 2026-10-01 unless another date is explicitly stated below.
Fictional Cedarline Cloud documentation.

## Policy and procedure

The public API allows 120 requests per minute per workspace. Exceeding the limit returns HTTP 429 with a Retry-After header measured in seconds. Use bounded exponential backoff and honor Retry-After. Creating additional tokens does not increase the workspace limit.
