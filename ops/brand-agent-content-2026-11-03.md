# Apple RAG brand and agent integration content

Service 5.6.0; CLI package 2.0.2. This change makes Apple RAG the product brand
and presents MCP / CLI as two ways for an AI agent to access the hosted service.
People choose a plan and approve access; agents perform documentation searches
and page reads. The CLI is not positioned as a manual research tool for people.

## Editorial rules

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
