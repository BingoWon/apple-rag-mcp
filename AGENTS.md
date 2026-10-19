# Agent Instructions

## Deployment

This project does not require a manual deployment. Committing to `main` and pushing to GitHub is the deployment step: Cloudflare Workers automatically pulls that commit and deploys the Worker. Do not run `wrangler deploy` for a normal code change.

Every code change must therefore be committed to `main` and pushed to GitHub promptly. A change that exists only in the local working tree is not deployed and does not affect `https://mcp.apple-rag.com`.

The manual `pnpm build && wrangler deploy` procedure in `ops/README.md` is not the normal release path.
