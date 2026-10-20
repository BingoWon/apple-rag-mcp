# Agent Instructions

## Deployment

This project does not require a manual deployment. Committing to `main` and pushing to GitHub is the deployment step: Cloudflare Workers automatically pulls that commit and deploys the Worker. Do not run `wrangler deploy` for a normal code change.

Every code change must therefore be committed to `main` and pushed to GitHub promptly. A change that exists only in the local working tree is not deployed and does not affect `https://mcp.apple-rag.com`.

The manual `pnpm build && wrangler deploy` procedure in `ops/README.md` is not the normal release path.

## Releases

Every code change ships with a release. A change to `worker/`, `src/`, `skills/`, or `public/` bumps `package.json` and `server.json` to the same new version, and the bump is pushed to `main` in the same change. CI success on `main` then creates the `vX.Y.Z` GitHub release.

- Patch bump for fixes and small changes; minor bump for new user-facing capabilities.
- Documentation-only changes may skip the bump.
- Never push a version that already has a tag; the workflow skips it and no release is created.

## MCP Protocol Compatibility

Do not make the production MCP endpoint `2026-07-28`-only. Current clients, including Cursor 3.24, still open Streamable HTTP with the legacy `initialize` handshake. The server must keep `legacy: "stateless"` in `worker/mcp/protocol-handler.ts` so those clients work beside the modern per-request protocol.

The full incident, the rejected shortcut, and the compatibility rule are recorded in `ops/incidents/2026-10-19-cursor-mcp-protocol.md`. Read it before changing protocol negotiation, client installation instructions, or claims about client support.

## Responding To User Feedback

- Work from the verbatim original message. If it was not pasted into the conversation, ask for it before drafting a reply; do not answer a paraphrase.
- Reply in the language the reporter used.
- Keep it short, warm, and professional. Thank the reporter, then explain the cause in one or two plain sentences. Skip protocol and implementation detail.
- Give one concrete next step. For MCP connection issues that step is a reload of the server in the client's MCP settings. Do not tell people to change tokens or configuration.
- Do not claim a fix is in effect until the production endpoint has actually been checked. A local change is not a fix.
- When drafting a reply for review, offer two or three short versions instead of one.

## Production Data

Production data is on the VPS. PostgreSQL configuration and operations live in `ops/server` and `ops/README.md`; do not propose moving, recreating, or querying that data through Cloudflare-managed storage.

The Worker also binds Cloudflare D1 (`env.DB`) for accounts, tokens, rate limits, and tool-call logs. That is application state served by the Worker, not the retrieval corpus.


## Agent Identity

Every third-party account must use an agent-owned identity. Never register, sign in, or authorize a platform with the owner's personal GitHub, Google, Outlook, or any other personal account.

The purpose is to keep the owner's identity out of platform signups. Convenience is not a reason to use their account, even when a session is already open.

- Use the dedicated agent mailbox recorded in `.ops/accounts/registry.md`.
- If a provider rejects the agent domain, requires phone verification, CAPTCHA, or an OAuth account the agent does not own, stop and report the blocker. Do not fall back to the owner's account.
- Record every account and the identity used in `.ops/accounts/registry.md`.
- Existing accounts created with the owner's identity are violations to migrate or retire, not precedents.
