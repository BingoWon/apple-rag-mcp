# Documentation catalog

`browse` is a read-only indexed operation shared by MCP and the CLI. It uses the existing account quota and channel-specific credentials. The first publication covers the indexed default language view of SwiftUI and UIKit. Page bodies remain the responsibility of `fetch`.

A section fragment opens a group. Resolve each `href` against its parent with standard URL resolution, first resolving a local `base` if present. A count of zero is a known leaf; null means navigation data is unavailable. A document with `readable: false` is a navigation-only intermediate. Sections are navigation-only. Unique section abbreviations return a canonical base. Ambiguous abbreviations return up to ten candidates and the number of matches.

The first level uses a one-based page with a default size of 20 (maximum 50). Depth is 1–3, default 2. Expansion is breadth-first in catalog order, stops on ancestor cycles, and never inlines half a branch. The initial limits are eight children per inlined branch, 50 entries total and 8 KiB of extra compact JSON. The byte budget applies to the preview in addition to the requested first page. Continue a paginated listing with its URL, page size and opaque revision. A changed listing or page size returns LIST_CHANGED. A new request without a revision can jump directly to a page of the current listing.

## Publishing on the corpus VPS

Apply `server/postgresql_catalog.sql` to the corpus database using its local administrative role. Install `server/publish_catalog.py` in `/opt/apple-rag-catalog/`, and the two `server/systemd/apple-rag-catalog.*` units in `/etc/systemd/system/`. Run `systemctl daemon-reload`, then `systemctl start apple-rag-catalog.service`. After checking its journal and a successful root listing, enable the hourly `apple-rag-catalog.timer`. The script uses Python's standard library and psql in the existing postgres_db container.

The publisher reads an ordered source snapshot, reuses parsed groups for unchanged page versions, filters unavailable links and retains structure-only intermediates reachable from readable pages. The published tables change in a single transaction. A failed refresh retains the previous publication; an unavailable Apple technology index can reuse the last valid root. Readers use a repeatable-read transaction and only retrieve the selected slices. Browsing never calls a ranking model or live webpage provider.

The collector stores updated pilot metadata even if the cleaned body is unchanged. To backfill an existing indexed document's navigation immediately, run:

```sh
python3 /opt/apple-rag-catalog/publish_catalog.py --refresh-url https://developer.apple.com/documentation/swiftui/view-fundamentals
```

Inspect failures with `journalctl -u apple-rag-catalog.service`. To pause publication, stop the timer; the last published catalog is still readable. Before adding frameworks, measure their coverage, catalog width, projection size and refresh time. Refresh root metadata before offering new root groups. An indexed directory describes available local sources; it is not a completeness claim about Apple's current website.

## Verification

The catalog tests cover page boundaries, stable order, revision changes, relative references, aliases, fuzzy matches, unknown data, cycles and expansion limits. CI exercises publication, cache reuse and last-good rollback in an isolated PostgreSQL schema, tests both MCP handshakes, then installs the built CLI tarball in an isolated consumer. The Worker release and CLI health must advertise browse before automatic npm publication.
