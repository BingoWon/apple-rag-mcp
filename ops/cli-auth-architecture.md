# CLI and MCP authorization boundaries

Recorded: 2026-11-03. Status: **proposal, not implemented**.
Current releases: service 5.4.1, CLI 1.0.1. This document does not claim the current
CLI has separate credentials, browser authorization or a REST retrieval API.

## Current implementation and its limits

The CLI is currently an MCP client: `packages/cli/src/client.ts` uses the official
MCP SDK and sends the existing MCP Token to the MCP endpoint. `auth login` validates
and saves an already-issued MCP Token. This is a valid way to build an MCP client,
but it couples the independently distributed CLI to the MCP interface and its
credential lifecycle. It was an implementation shortcut, not a protocol necessity.

The user wants an independent CLI channel, separate authorization and identifiable
search/fetch logs. Sharing accounts and retrieval code does not require this
nesting. The earlier implementation did not separate these concerns sufficiently.

Both log tables currently store `mcp_token`. Search/fetch handlers and invalid-input
logging pass `auth.token` to `ToolCallLogger`, which persists the raw value. Admin
responses mask it later; masking presentation does not remove the stored secret.
The tables lack request-channel and client metadata. Old records cannot reliably
distinguish the official CLI from other MCP clients using the same token.

## Recommended boundary

Use one platform identity/subscription system, independent client grants and
resource boundaries, and shared business services. Do not duplicate users,
subscriptions, retrieval pipelines or account quotas.

| Concern | Recommended treatment |
| --- | --- |
| User account, subscription, effective entitlement | Shared platform services |
| MCP client credentials | Issued for the MCP resource; MCP entry validates them |
| CLI device grants/access/refresh credentials | Issued separately for the CLI-facing API; independent expiry/revocation |
| Website login session | Used to approve CLI authorization, not copied into the CLI |
| CLI request path | Versioned JSON HTTP API, not MCP discovery/tools/call |
| Search/fetch orchestration | Shared input contracts, quota reservation/refund, retrieval and logging |
| Logs | Shared schema/UX, separate verified entry channel and credential reference |

Both adapters can run in the existing Worker; this does not require another
deployment, identity provider, corpus or microservice. Shared contracts belong in
a neutral shared location, rather than making the Worker depend on the CLI's source
directory. Move business orchestration below the MCP adapter instead of copying
the current tool handlers into the API. The CLI no longer needs an MCP SDK.

For this product, reject MCP credentials at the new CLI-facing API and reject CLI
API credentials at the MCP entry. Enforce the intended resource, granted scopes,
expiry and revocation on the server. Different token prefixes alone are not
isolation. `client_id` identifies an OAuth registration; `aud` identifies the
resource. A public CLI cannot keep an embedded client secret confidential.

Subscription/usage checks remain keyed by the same user ID, so two clients neither
create a second free allowance nor require buying the same subscription twice.
Revoking one CLI device must not revoke its user's MCP connections. Anonymous
abuse limits should also remain coordinated across entries.

## CLI login experience

`apple-rag auth login` should launch the platform authorization page, let the user
sign in and approve the CLI, and obtain credentials for that device. Browser login
can use authorization code + PKCE. Device Authorization Grant supports remote or
browser-constrained terminals without a local callback server. Decide the default
as part of implementation; do not invent a new authorization protocol.

Use short-lived access credentials and protected rotating refresh credentials,
stored in the OS credential store. Support listing/revoking CLI devices in account
settings. Noninteractive automation may use separately issued, limited API
credentials; do not reuse MCP credentials. CLI identity should not silently become
an account merely because its public IP matches an existing MCP IP allowlist.

## Search and fetch logs

Keep both existing operation views, with the same request-context fields:

- `channel`: the server entry used, e.g. MCP or CLI-facing API.
- `client_id` / `client_name` / `client_version`: distinguish verified grant
  registration from client-reported diagnostic names and versions.
- `credential_id` / `session_id`, `auth_method`, `user_id`: trace authorization
  without persisting an access/refresh token.
- `request_id`: correlate entry, authorization, quota and business execution.
- Preserve outcomes/reasons, duration, content origin, provider and cache status.

`channel` is distinct from `content_source` (Apple/third-party) and `provider`
(index/Apple JSON/Firecrawl). Add a channel badge/filter to both admin views, not
separate copies of their table implementation. Record failed/limited/cancelled
operations with the same context; auth rejection is distinct from retrieval failure.

Set the entry channel on the server and attach verified credential metadata.
`User-Agent`, MCP `clientInfo` and an `X-Client-Type` header are self-reported; they
must not decide entitlement or serve as proof of the caller program's identity.
Even an OAuth public client registration does not attest the running binary.
Statistics can identify the resource/grant channel, not prove that nobody used
curl with their own credential. A terminal program can legitimately act as an MCP
client; such a request still used the MCP resource.

Historical records missing metadata must remain unknown rather than being guessed
from a shared token. Stop writing raw secrets, map useful references where safe,
and remove historical secret copies under an explicit production-data repair.

## Acceptance criteria for implementation

1. Website approval creates an independently revocable CLI device grant.
2. Cross-resource credential use is rejected by both server entries.
3. One user's MCP and CLI calls share effective subscription/quota accounting.
4. Both log views distinguish entry/grant channels, including invalid, limited,
   failed and cancelled cases; spoofed headers do not change verified attribution.
5. No access/refresh credential is persisted in search/fetch logs.
6. npm-installed CLI and existing production MCP clients pass real acceptance.
   Preserve `legacy: "stateless"`; authentication work must not narrow protocol
   compatibility covered by the existing Cursor incident rule.

## Primary references checked

- [GitHub CLI login](https://cli.github.com/manual/gh_auth_login): browser-based
  default, OS credential storage and separate token/automation modes.
- [Wrangler login](https://developers.cloudflare.com/workers/wrangler/commands/general/#login):
  OAuth browser authorization and a device-flow mode.
- [MCP 2026-07-28 authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization):
  authorization-server/resource-server separation and intended-audience validation.
- [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html): OAuth security best
  practice, audience restrictions and refresh-token protection.
- [RFC 8628](https://www.rfc-editor.org/rfc/rfc8628.html): device authorization,
  including public-client limitations.
- [OWASP logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#data-to-exclude):
  avoid recording access tokens directly in logs.
