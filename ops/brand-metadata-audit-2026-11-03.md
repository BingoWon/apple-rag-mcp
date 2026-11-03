# Brand and metadata follow-up audit

Service 5.6.1. Follow-up to [the brand refresh](brand-agent-content-2026-11-03.md).
The first release updated the homepage and connection guide, but its metadata
handler still treated other routes as the homepage. This audit fixes that gap
and records the full set of current publishing surfaces.

| Surface | Finding and disposition |
| --- | --- |
| Page titles/descriptions | One shared registry now covers every frontend route; admin subroutes use a generic administrative description. Unused Next-style metadata exports were removed from Vite pages. |
| Canonical / Open Graph / Twitter | Initial HTML and browser navigation use the same route-specific title, description and clean URL. Authorization query strings and fragments are never copied into metadata. Unknown pages have no canonical URL. |
| Language | Browser metadata follows selected English/Chinese copy. Legal documents remain in English and are labeled English; no untranslated legal text is presented as Chinese. No alternate language URLs are invented. |
| JSON-LD | The homepage describes the application and plans; public guide/legal pages describe their own WebPage. Private and missing pages carry no application/plan schema. SPA navigation restores or removes schema as needed. |
| Indexing | Login, registration, password recovery, authorization, dashboard, billing and admin shells return noindex via both meta and X-Robots-Tag. These directives are visible before JavaScript runs. API responses also carry noindex. |
| robots.txt | UI shells remain crawlable so crawlers can see noindex. API/OAuth paths remain disallowed. Authentication still protects account data; robots rules do not grant or restrict access. |
| Sitemap | Generated from the shared indexable-page registry: home, connection guide, privacy and terms. Login/registration were removed. The fabricated request-date lastmod was removed. |
| Missing pages/assets | Unknown document URLs return 404 with noindex. Missing JS/assets retain 404 instead of receiving the homepage as successful HTML. Conditional requests cannot turn fallback pages into an incorrect empty 304. |
| Share artwork / icons | Current 1200×630 artwork names Apple RAG and MCP / CLI. The unreferenced old og-image-jev.png still advertised MCP-only and a private GitHub repository; it was retired. The favicon and logo are protocol-neutral icons and remain. |
| Agent discovery | public/llms.txt was checked; llms-install.md now covers both connections and points to maintained guidance. Skill display metadata now names Apple RAG and MCP / CLI. The optional MCP dependency remains a technical MCP identifier. |
| MCP registry / manifest | Display title and description identify the Apple RAG agent service; the registry and manifest descriptions remain consistent and retain RAG/Jev attribution. Protocol IDs, URLs, credential types and legacy handshake support remain unchanged. |
| API reference | OpenAPI description explains the platform and shared account limits; Swagger HTML has an Apple RAG title. |
| Email / account copy | Email branding was verified from source. Password-recovery UI was still English-only and now has natural English/Chinese labels, success and failure messages. Validation and account operations are unchanged. |
| README / claims | Removed unverified complete-coverage, always-current, maximum-throughput and token-efficiency promises. The maintained index and agent workflow are described directly. License wording distinguishes the distributed CLI from the private application repository. |
| Ownership / internal IDs | BingSiteAuth.xml and ownership/configuration identifiers were reviewed and retained. Internal application names, package/repository names and historical incident records are not public marketing copy and were not blindly renamed. |

## Maintenance and checks

- `shared/site.ts` is the source of route copy, indexability, canonical URLs,
  structured data and sitemap inclusion. Root HTML stays a usable English default;
  an automated assertion compares its JSON-LD with the shared definition.
- Tests enumerate the frontend routes so adding a route without metadata fails.
  Other assertions cover query stripping, locales, indexability, missing pages,
  structured data removal and safe script serialization.
- `ops/ui/check-site-metadata.mjs` checks raw responses and real browser behavior
  against a built Worker preview or production. It validates all page heads,
  trailing slashes/conditional requests/HEAD, sitemap XML, missing assets and API
  reference. English/Chinese browser cases cover public and account entry pages,
  password-recovery success and a real SPA transition restoring public metadata.
- Browser reset-email submissions are intercepted locally with synthetic `.invalid`
  data. No production email, account, subscription or grant is created or changed.
  No search/fetch retrieval is required for these checks.
- Current CLI 2.0.2 and its packaged skill are unaffected. The edited skill display
  YAML is not part of the npm tarball. No CLI republish or user login is required.

## Practical limits

This verifies current source and the responses we serve. It does not claim that
Google, Bing or social platforms have refreshed their existing cached results.
The current legal documents were not translated or substantively rewritten. No
PWA manifest or unsupported alternate-language SEO routes were added.

Primary references: [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
explains why blocking a page in robots.txt can hide its noindex directive;
[Cloudflare asset routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
explains how document metadata is rewritten while static files retain asset-first routing.

Local acceptance: lint/type checks and production build passed, with 226 application
tests and 16 CLI tests. The built Worker preview passed all 42 metadata/discovery/
browser cases, including conditional requests and HEAD. Production responses must
be checked again after the main-push deployment; the same script supports that run.
