# Dark-theme coverage audit

Living checklist of page surfaces and the hardcoded components each one exposes.
A surface is *clear* when a full scan (static + interactions) finds no unreadable
light fill or dark ink. Re-run a surface's scan after major OLX/Standvirtual
deploys; findings are keyed on stable hooks only (`data-testid`, `data-cy`,
`data-nx-name`, ids, semantic classes), never generated hashes.

Scan method: walk the rendered DOM, flag light background fills (alpha-weighted
brightness > 400) and dark text inks (sum < 380) that are visible in the
viewport or reachable by scrolling; trigger the surface's interactions (modals,
expanded dropdowns, lazy bands) before scanning. Cross-origin ad creatives inside
iframes are intentionally exempt — they are dimmed, not recoloured.

## Status legend

- `clear` — scanned, nothing outstanding
- `fixed` — findings repaired and committed
- `open` — findings recorded below, not yet fixed
- `blocked` — needs a state not currently reproducible (e.g. an active ad, a
  conversation, a logged-in viewer)

## OLX.pt — desktop

| Surface | Status | Notes |
| --- | --- | --- |
| Home | clear | accent-label dark ink is intentional |
| Category landing | clear | light `#searchmain-container` already masked |
| Search results + filters | fixed | seller "Loja" badge, footer SEO link labels |
| Ad detail (visitor) | fixed | breadcrumb/posted-at/footer-bar inks, gallery title |
| Ad detail (owner) | blocked | needs a live ad of the user's; "Contactar Anunciante" card still white |
| Seller profile | clear | fixes from `b5df875` verified |
| Chat list | clear | |
| Chat thread | blocked | no conversations on this account |
| Account: dashboard/payments/ratings | clear | |
| Account: settings | clear | a transient white panel was observed once, then could not be reproduced |
| Account: candidate profile | clear | |
| Favourites (`/observed`) | clear | |
| Publish flow entry (`/adding`) | clear | |
| Landing bundles (`/lp/…`) | out of scope | HubSpot campaign pages, separate palette |
| 404 | clear | |
| Report/share modals | blocked | `#ad-report-button` renders unreachable in the current layout |
| Cookie settings | clear | trigger already themed; the HubSpot banner on `/lp/` pages is out of scope |

## Standvirtual.com — desktop

| Surface | Status | Notes |
| --- | --- | --- |
| Home | clear | white "Grátis" chip is legible; left as-is |
| Search results + filters | fixed | valuation-panel green ink |
| Ad detail | fixed | "Ver N fotos", condensed sticky header, full-screen gallery |
| Ad detail gallery (full screen) | fixed | white canvas + invisible counter |
| Similar-ads carousel | fixed | `a3af014`; spec strip inks fixed in this pass |
| Seller page (dealer business site) | out of scope | `*.standvirtual.com` dealer sites are a separate app with their own palette and no `data-svd` scope |
| Chat popup (message composer) | blocked | needs a logged-in viewer; disabled send button stays light |

## Mobile layout

Not audited. Extensions are desktop-only; the narrow (`<~1024px`) layout is the
only way it surfaces, and the current pass targeted desktop widths. Revisit only
if a narrow-window review is requested.

## Findings

### OLX — search results

- Shop sellers rendered a light-lavender `NexusBadge` ("Loja") over the card
  photo. Repainted as a dark pill with light ink.
- Footer SEO bands ("Categorias", "Anúncios por localidade") labelled links with
  the `#406367` primitive as ink. Repainted the label spans; the primitive itself
  is dual use (borders) and stays untouched.

### OLX — ad detail (visitor)

- Breadcrumbs, `ad-posted-at` (both on the page and in the gallery) and
  `ad-footer-bar-section` used `#406367` as ink. Repainted to the dim text token.
- The gallery lightbox title (`h4`) used the light theme's near-black.
- The recommendations band `#F2F4F5` fill is covered by the existing scrim; no
  action needed.

### SV — search results

- Valuation aside: the mint pill was already darkened, but its label and tick
  icon hardcoded `#187E0D` (≈2.9:1). Repainted to the light-green ink used by the
  other green pills.

### SV — ad detail

- "Ver N fotos" chip: dark ink on its own dark chip.
- Condensed `header-sticky`: `rgba(255,255,255,.6)` with backdrop blur, a bright
  band over the dark page once scrolled.
- Full-screen viewer: the canvas, last thumbnail and photo counter all fill with
  `bg-turbo-content-default`, which is the *ink* token (white in dark mode) used
  as a background. Repainted inside the viewer only; the token must stay white
  because body text uses it. The counter label was white-on-white and is now
  light-on-dark.
- Similar-ads spec strip (`ad-card-characteristics` items) kept the `#020309`
  icon ink; the earlier `h2`/`p` rule did not reach it.

### Blocked surfaces (need a reproducible state)

- OLX owner view: needs one active ad on the account. A live own-ad URL is
  enough to finish the "Contactar Anunciante" card check.
- OLX chat thread and report/share modals: no conversation and no reachable
  report trigger in the current ad layout.
- SV message popup: requires a logged-in viewer to open the composer.
