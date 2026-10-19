# Incident: Cursor Could Not Connect to the MCP 2026-Only Server

Recorded: 2026-10-19

Status: compatibility restored in `ff46408`; production deployment follows the push to `main`.

## User Report

A user tried to install Apple RAG MCP 5.0.16 in Cursor 3.24.18 from both the one-click install button and the install prompt. Both failed with:

> To use this server here, Cursor needs MCP 2026-07-28 Streamable HTTP (no legacy initialize), or apple-rag-mcp is not usable from this Cursor client. The server is healthy, but Cursor cannot speak its protocol, so this is not a successful install.

The user then supplied the transport evidence:

- Cursor recognized the server as Streamable HTTP and `2026-07-28` only.
- Its remote MCP client still sent the older `initialize` handshake, using revisions through `2025-11-25`.
- It did not send `MCP-Protocol-Version`, `Mcp-Method`, `Mcp-Name`, or the modern `_meta` envelope.
- A normal `initialize` request using `2025-06-18` was rejected with `supported: ["2026-07-28"]`.
- Putting `MCP-Protocol-Version: 2026-07-28` on an `initialize` body was rejected as a header/body mismatch.
- Cursor staff confirmed there was no client-side workaround. Adding the header to `mcp.json` did not help.
- The server appeared in Cursor's tool list, but live discovery failed.

The shared MCP process log on 2026-10-19 showed the exact production failure:

```text
Error connecting to streamableHttp server, falling back to SSE:
{"code":-32022,"message":"Unsupported protocol version: 2025-11-25",
 "data":{"supported":["2026-07-28"],"requested":"2025-11-25"}}
Error connecting to SSE server after fallback:
Non-200 status code (405)
```

The 405 response was only the fallback. The endpoint intentionally accepts protocol traffic through POST, so SSE was not a viable alternative.

## Original Intent

On 2026-09-02, commits `f62185e` and `4cc711f` intentionally enforced an MCP 2026-only server. The implementation set `legacy: "reject"` in `worker/mcp/protocol-handler.ts`. The website, READMEs, install prompt, and manifest described the service as native stateless MCP `2026-07-28`.

The reasoning at the time was clear: support the latest protocol revision and reject legacy handshakes rather than maintain two protocol eras. That decision was technically coherent, but it assumed that current mainstream clients had finished moving to the new request format. They had not.

## What Actually Happened

The server implementation was healthy and conformed to its strict `2026-07-28` profile. Cursor 3.24.18 was also current. Its diagnostic layer understood the version string and explained the mismatch, but its remote transport still began with `initialize`.

Knowing the version number therefore did not mean Cursor could speak the protocol. A client can identify `2026-07-28`, report that it is required, and still be unable to send a modern envelope. Compatibility has to be judged from the handshake that production receives, not from the client's displayed version or its ability to quote the server manifest.

The configuration and install links were valid. They failed because connection-time protocol negotiation was stricter than the clients being advertised. The earlier client audit in `ops/mcp-client-audit.md` checked configuration shape only; it explicitly was not proof that Cursor had connected successfully. Marketing text later overstated that audit as native support.

## Correction

`ff46408` (`fix(mcp): serve legacy initialize handshakes for Cursor`) changed the handler from `legacy: "reject"` to the SDK's `legacy: "stateless"` mode. The modern `2026-07-28` path remains in place. The same endpoint also accepts the legacy `initialize` handshake for `2025-11-25`, `2025-06-18`, and `2025-03-26`.

The regression test sends a Cursor-style `initialize` without modern headers and then calls `tools/list`, expecting `search` and `fetch`. Unknown modern versions and malformed modern envelopes remain rejected. Public copy now states the dual-era behavior instead of telling users that only `2026-07-28` works.

## Rule

Do not remove legacy `initialize` compatibility merely because a newer MCP revision exists or because the server implementation is newer than a client release.

Before narrowing protocol support:

1. Capture a real handshake from every advertised client, especially Cursor, VS Code, Claude Code, and Codex.
2. Treat a client as incompatible only when its actual request fails, not because its version number looks old.
3. Keep the legacy stateless path until those captured handshakes no longer use `initialize`.
4. If support is narrowed later, remove the affected install buttons and compatibility claims in the same change. Do not advertise a client whose live connection has not been verified.
