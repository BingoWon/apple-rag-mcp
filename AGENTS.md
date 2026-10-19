# Agent Instructions

## Deployment

This project does not require a manual deployment. Committing to `main` and pushing to GitHub is the deployment step: Cloudflare Workers automatically pulls that commit and deploys the Worker. Do not run `wrangler deploy` for a normal code change.

Every code change must therefore be committed to `main` and pushed to GitHub promptly. A change that exists only in the local working tree is not deployed and does not affect `https://mcp.apple-rag.com`.

The manual `pnpm build && wrangler deploy` procedure in `ops/README.md` is not the normal release path.

## MCP Protocol Compatibility

Do not make the production MCP endpoint `2026-07-28`-only. Current clients, including Cursor 3.24, still open Streamable HTTP with the legacy `initialize` handshake. The server must keep `legacy: "stateless"` in `worker/mcp/protocol-handler.ts` so those clients work beside the modern per-request protocol.

The full incident, the rejected shortcut, and the compatibility rule are recorded in `ops/incidents/2026-10-19-cursor-mcp-protocol.md`. Read it before changing protocol negotiation, client installation instructions, or claims about client support.
