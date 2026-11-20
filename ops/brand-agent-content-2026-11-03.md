# Apple RAG brand and agent integration content

Service 5.6.0; CLI package 2.0.2. This change makes Apple RAG the product brand
and presents MCP / CLI as two ways for an AI agent to access the hosted service.
People choose a plan and approve access; agents perform documentation searches
and page reads. The CLI is not positioned as a manual research tool for people.

## Editorial rules

- Both root READMEs open with the owner-supplied [hero image](../docs/assets/readme-hero.png).
  Keep the original file. Generating, editing or substituting this artwork requires
  the owner's explicit request. Website social previews use their own asset.
- Use **Apple RAG** for the brand, account, subscription, navigation and email.
  Use **MCP / CLI** for compact labels; write “MCP or CLI” in English sentences.
  Connection-specific instructions can use “Apple RAG via MCP” or “Apple RAG CLI”.
- Write English for an English-speaking reader first, then write natural Chinese.
  Lead with the agent's task and use direct verbs. Avoid translated slogans such
  as “same service, choose by workflow”, claims of instant answers, universal
  client compatibility, complete coverage, or identical performance/cost.
- The homepage Hero retains its custom colorful title, Vibe Coders badge, rainbow
  setup link, arrow CTA, MacBook scroll and stickers. Adapt the original headline
  to “Inject Apple Expertise into AI Agents via MCP / CLI”; do not replace its
  visual design during copy updates. Both connections share core retrieval, the
  account plan and usage allowance.
- Keep RAG retrieval and Jev ranking attribution in the relevant product sections.
  The product returns sources; the consuming agent uses them to produce an answer.
- Setup instructions are addressed to the agent. The owner only handles required
  permissions, browser sign-in and explicit device approval. Do not copy credentials
  into an agent prompt. Anonymous MCP setup omits the Authorization header.

## Delivery

- Homepage headline, feature copy, source cards, connection cards, pricing, FAQ and
  final call to action; navigation, footer, dashboard introduction and usage labels.
- One public `/connect` guide with separate MCP and CLI sections, setup prompts,
  command reference for agents, quota/source limits, account access and revocation.
  Reuse the same setup cards and prompts on the homepage and in dashboard guidance.
- Dashboard can switch between account-specific MCP setup and CLI agent setup.
  CLI devices and unattended automation keys are separate in Settings. Existing
  keys continue to work; key creation remains available in the automation section.
- Neutral wordmark throughout the website; updated social preview, page metadata,
  sitemap, public `llms.txt`, package README, bundled skill, account email branding
  and current repository introductions. Technical MCP identifiers, endpoint URLs,
  npm package name and historical incident records are retained.
- Remove promotion of the private source repository and public-source claims.
  Keep the original testimonial carousel and typewriter CTA. Replace an
  unrelated placeholder source card with provenance information.
- Legal pages receive brand/service-description updates only. This does not change
  contractual rights, billing rules, retention, or account permissions.

## Validation

- Full lint/types/build and 222 application tests plus 16 CLI integration tests.
- Isolated npm tarball installation verifies the executable, version, CLI API and
  retrieval against local fixtures. The package still includes the agent skill.
- 102 brand/content browser checks cover English/Chinese, light/dark, 320/390/1440px, actual clipboard
  contents for both public setup prompts, FAQ, reference disclosure, anchors,
  dashboard connection switching and navigation from the bottom call to action.
- 145 authorization/settings browser checks cover device approval, callback
  states, key creation/one-time dismissal, revocation and the login return path.
  All browser account data is synthetic and uses `.invalid` email addresses.
- The built Worker preview serves correct titles, descriptions and canonical URLs
  for `/`, `/connect` and `/connect/`; the connection guide is in the sitemap.
  Initial HTML metadata works without executing JavaScript. Browser metadata also
  follows route and selected language. There is no new UI runtime dependency.
- Browser artifacts remain ignored under `ops/ui/results/agent-brand` and
  `ops/ui/results/cli-auth`. Social artwork source is `public/og-image.svg`, rendered
  with headless Chrome at 1200×630 to `public/og-image.png` for share-card support.

## Release

Push main to deploy through Workers Builds. CI publishes the CLI patch only after
service 5.6.0 is available. Existing CLI login remains valid; no user reauthorization,
production data migration or manual Worker deployment is required. Do not claim
more subscriptions or improved retention until actual adoption data supports it.

## Hero correction — 5.6.2

The 5.6.0 content pass incorrectly replaced the custom Hero typography and CTAs.
Restore the pre-refresh Hero design from c26fad8. The only functional adaptation
is replacing the obsolete private GitHub CTA with the MCP / CLI connection guide,
using its existing rainbow treatment. Its foreground follows the theme for
readability. Keep the original English/Chinese message and Vibe Coders badge,
adding CLI alongside MCP. The rest of the brand, content and metadata work remains.

For future content changes, preserve this Hero design unless the owner explicitly
requests a redesign. Regression assertions cover its distinctive visual elements;
browser checks cover both languages, themes, responsive layouts and setup links.

5.6.3 follow-up: the Chinese Hero uses “智能体” in its title and subtitle, replacing
“AI Agent” and “Agent” without changing the restored design.

## Homepage section correction — 5.6.4

The owner requested copy adaptation, not a new homepage layout. The earlier
replacement of the testimonial carousel, typewriter CTA and quick-start window
exceeded that scope. Restore their pre-refresh components, order, animations,
gradient masks, badge, arrow CTA, Pro banner and client-logo treatment. The FAQ
remains in the connection guide only. Restore the source card's decorative sticker.

The original quick-start window gains an MCP / CLI selector for the existing agent
setup instructions; visible instructions and clipboard contents agree. The original
CTA leads to registration. Keep the current brand, route metadata, independent
authorization flows and shared account quota. Baseline testimonial quotations,
names and photographs are restored verbatim; this does not independently verify
their attribution. No new testimonial statements were authored for this change.

AGENTS.md now protects the entire homepage composition during future copy work.

Two narrow-screen corrections preserve those effects: contain horizontal portrait
rotation without clipping the vertical animation, and scale the typewriter text
so its completed sentence remains visible at 320px. Desktop typography is unchanged.

## Connection guide correction — 5.6.5

The newly added /connect guide used a 1024px outer container, while its FAQ used
another narrower container with additional horizontal padding. This caused a
visible width jump and gave a reading page unnecessary horizontal spread.

Use one 768px outer container with 24px side padding, giving 720px of content at
full width. Header, setup cards, steps and FAQ share the same edges. Keep the
existing setup cards and native disclosure components. MCP stays first and is
explicitly recommended for agents that support it; CLI remains fully supported
for shell-based agents. FAQ questions cover both subscriptions, authorization
and revocation, with MCP described first. Put CLI automation guidance inside the
CLI section instead of presenting it as general account guidance above the FAQ.

Homepage composition and effects, setup prompts, credential handling, quotas and
metadata are unchanged. Layout checks cover aligned edges, bounded width, both
languages/themes, 320/390/768/1440px, both setup prompts, disclosures and deep links.

## Homepage refinements — 5.6.6

Owner-requested changes only: swap the horizontal sides of the Hero stickers,
keeping their image orientation, existing rotations (-9deg for the person and
11deg for the logo), sizes and effects. Lower the person by 32px on desktop and
16px on smaller screens. The logo keeps its vertical position.

Quick start retains MCP as the default selection and offers the corresponding
copy button. Remove the terminal frame and rendered prompt text; use the same
complete agent setup generators for the clipboard. Keep quota information, the
Pro banner, client logos and the rest of the homepage composition. This explicit
request supersedes the earlier requirement to retain the prompt window. Regression
checks cover real clipboard contents, absent prompt markup, responsive sticker
positions, unchanged rotation and positive transform determinants (no mirroring).

## Quick-start hierarchy — 5.6.7

Refine only the existing quick-start section. Use a short heading and introduction,
a compact segmented MCP / CLI selector beside the primary copy action, and one
contained setup panel. Group trial/shared-plan information as secondary copy and
integrate the Pro offer into the panel footer. Arrange the nine client-guide links
in a two-column mobile / three-column desktop grid with consistent icon and link
sizes, rather than a row spanning the page.

The selected method remains MCP by default. The visible action is concise; its
accessible name still identifies MCP or CLI. Copy feedback keeps the control width
stable. The complete existing setup generators are unchanged and prompt text is
not rendered. The Hero, stickers, other homepage sections, authentication and quota
rules are outside this layout refinement.

Validation: 13 focused unit checks, type checking, lint and the production build
pass. The 150-case browser sweep covers both languages and themes at 320, 390 and
1440px, exact clipboard contents, absent prompt markup, aligned panel/grid edges,
responsive controls and client links that fit with at least 40px-high targets.

## Direct copy actions and restored client strip — 5.6.8

Replace the selector and shared copy action with two direct copy buttons: MCP
first with the primary theme treatment, CLI with an outline. Both copy the full
setup prompt immediately and use the existing accessible success/error toasts.
Keep the compact panel and restore the previous client strip verbatim, including
its wide container, wrapping horizontal layout, logos, typography and spacing.
Emphasize the existing $1/week price in bold, larger theme-colored type.

Refer to copied content consistently as a setup prompt / 提示词 in both languages,
including the homepage, connection guide, dashboard actions, metadata, llms.txt
and the account-setup reference inside the copied MCP prompt. Keep generic guide
and permission instructions as such. No authentication, billing or protocol
behavior changes. Browser checks cover direct clipboard actions, restored client
layout, price emphasis and narrow-screen fit, alongside the existing regression
coverage for other homepage sections and connection surfaces.

Validation: 29 focused unit/metadata checks and 150 browser checks pass, along
with lint, type checking and the production build. The client-strip subtree
matches its pre-5.6.7 source exactly; no new dependencies were added.
The full verification also passes: 229 application tests and 16 CLI tests. The
existing dashboard copy-button assertion now uses the updated English label.

## Hero theme contrast — 5.6.9

The rainbow setup button retained a dark background when the OS preferred dark
mode but the user selected the site's light theme. Semantic text colors followed
the root class, while Tailwind's default `dark:` variant followed the OS media
query. Bind that variant to the existing `.dark` class so both use the theme
resolved by ThemeProvider. Preserve the original button design and content.
Verified the reproduced mismatch and both selected themes in the actual browser;
build and lint pass. No permanent presentation assertions were added.

## Preserve the original rainbow button appearance — 5.6.10

The owner clarified that the original background and effects must remain exactly
as before. Revert the global dark-variant override introduced in 5.6.9. Change
only the setup button's icon/text colors to follow its existing background
variant: dark text on its white background, white text on its dark background.
This also keeps both readable when the selected site theme differs from the OS.

## Restore the GitHub Star action — 5.6.11

The rainbow Hero button was incorrectly repurposed as an agent-setup link during
the MCP/CLI content refresh. Restore the original action from commit 965d539:
GitHub icon, “Star on GitHub” / “GitHub 加星”, the repository URL and safe new-tab
behavior. Keep its original rainbow design and the narrow foreground contrast fix.
Remove the obsolete setup label and assertions that prohibited the GitHub link or
required this button to navigate to /connect. Do not add new presentation locks.
The existing quick-start actions and connection guide continue to provide setup.
Repository visibility remains private; restoring its link does not grant access.
