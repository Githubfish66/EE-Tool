# ADR-001: Direct Large-File Upload Backend

## Status

Superseded by Google Drive resumable direct upload

## Context

Render Free web services have limited disk and runtime resources. A large file
sharing service should not stream uploads through the Render instance because it
can exhaust memory, disk, request time, or bandwidth.

## Decision

The initial design used Cloudflare R2 presigned URLs. Because R2 generally
requires a payment method even when staying under the free allowance, the service
now uses Google Drive OAuth and resumable upload sessions.

The Node.js + Express backend owns OAuth client secrets and refresh tokens. It
creates Google Drive resumable upload sessions, while the browser uploads the
file body directly to Google Drive and reports progress.

## Consequences

- Render handles small JSON requests only.
- Upload progress can be measured in the browser with `XMLHttpRequest`.
- Google OAuth setup is more complex than S3-compatible presigned URLs.
- Anyone with the share link can open the file because the app grants
  `anyone` + `reader` permission after upload.
