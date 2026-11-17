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

**Last live verification:** 17 Nov 2026, with the extension loaded (not injected
CSS). All `fixed` rows below were re-checked in that pass on OLX desktop, OLX
mobile, SV desktop and SV narrow.

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
| Seller page (dealer business site) | out of scope | dealer subdomains (`<dealer>.standvirtual.com`) are a separate app and are not in the manifest's host permissions |
| Chat popup (message composer) | blocked | needs a logged-in viewer; disabled send button stays light |

## Standvirtual — narrow layout (`www`, ≤~1024px)

`m.standvirtual.com` does not answer (connection timeout), so the narrow layout
is the responsive `www` app, themed by the desktop token layer. Spot-checked at
390×844.

| Surface | Status | Notes |
| --- | --- | --- |
| Home | clear | ad creative is bright (exempt) |
| Search results | fixed | sticky "Filtros" chip was white-on-white |
| Ad detail | clear | gallery, badges and sticky bar already themed |

## OLX mobile layout (`m.olx.pt`, narrow viewports)

Audited at a 390×844 viewport with touch emulation. `mobile.css` is registered
only for `m.olx.pt`.

| Surface | Status | Notes |
| --- | --- | --- |
| Home | clear | ad creative inside its own frame |
| Search results + filters | fixed | filters route (`/searchform/ads/…`) painted white |
| Ad detail | fixed | `#406367` meta inks (posted-at, member-since, category footer) |
| Ad detail gallery | clear | dark viewer with a readable `N de M` counter |
| Favourites (`/observed`) | fixed | white app shell, light `<main>`, white title bar |
| Account menu (`/account/menu/`) | fixed | shell, `<header>`, near-black row inks, cream/mint CTAs |
| Account: ad lists, wallet, payments, invoices, ratings | clear | re-scanned after the shell fix |
| Account: settings (`/account/settings/`) | fixed | list rows hardcoded `#02282C` |
| Chat list (`/myaccount/answers/`) | fixed | shell and `<main>` painted light; empty state's plus glyph is dark teal (cosmetic) |
| Publish entry (`/adding`) | fixed | white shell and title bar |
| Chat thread | blocked | no conversations on this account |
| Filters / sort sheets | fixed | same route as above |

Mobile fixes are one commit (`fix: theme the mobile account, filters and
publish shells`) on top of the palette rules that already apply at any width.

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

### SV — narrow layout

- The sticky strip above the results renders "Filtros" as a hardcoded white
  pill whose label takes the dark-theme ink — a blank white rectangle next to
  the dark "Pesquisa IA" and sort chips. Repainted through `[data-testid=
  "filters"] article > div`; desktop exposes no such structure.

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

### OLX — mobile

- Account-area routes are a second app shell (`#client-root`, not
  `#hydrate-root`) that paints a white page layer; their `<main>` carries the
  light content fill (`#FFF`, `#F2F4F5`, `#FAFBFB`) and their title bar is a
  page-level `<header>` painted white. All three are generated-class shells, so
  they are matched structurally (`#client-root > div`, `main`, `main header` —
  the header sits directly under `<main>` on favourites but inside the page's
  `<form>` on filters and publish).
- The filters route (`/searchform/ads/…`) is a full page rather than a sheet and
  had the same white `<main>` plus a near-black "Ordenar por" label.
- The account menu hardcodes `#02282C` on every row and section heading, fills
  its two shortcut cards with cream (`#FFF6D9`) and mint (`#C8F8F6`), and paints
  the item counter chip `#F2F4F5`. Repainted through the `user-menu-link`
  testid, with the teal "Editar" bubble left on its original dark ink.
- The settings list rows ("Login e segurança", "Editar perfil", …) hardcode
  `#02282C`; covered through `[data-testid="settings-list"]`.
- Ad detail reuses the desktop `#406367` inks (`member-since`,
  `l-categories-footer-content`), now covered by the shared palette rules.
- Cosmetic, left alone: the chat empty state's plus glyph is dark teal on dark,
  and the publish illustration is a white-background image asset.

### Blocked surfaces (need a reproducible state)

- OLX owner view: needs one active ad on the account. A live own-ad URL is
  enough to finish the "Contactar Anunciante" card check.
- OLX chat thread and report/share modals: no conversation and no reachable
  report trigger in the current ad layout.
- SV message popup: requires a logged-in viewer to open the composer.
