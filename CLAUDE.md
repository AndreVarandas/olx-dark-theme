# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 Chrome extension that darkens `*.olx.pt` and `*.standvirtual.com`. It is
CSS-only theming: no bundler, no dependencies, no package.json, no tests, no lint step. The
extension is loaded unpacked from this directory, so a change is live after
`chrome://extensions` → reload (and a page refresh).

Both sites belong to the OLX Group and share a design-token system, so one extension with
one toolbar button covers both. The palettes are site-specific.

## Commands

```bash
# Verify the extension is structurally valid before reloading it
node --check src/background.js && node --check src/content.js
python3 -c "import json; json.load(open('manifest.json'))"

# Regenerate icons (dependency-free, writes icons/icon-{16,32,48,128}.png)
python3 tools/make-icons.py
```

Loading unpacked requires the native file picker, so it cannot be automated — ask the user
to do it via `chrome://extensions` → Developer mode → Load unpacked.

## How the theme works

`src/background.js` registers each site's stylesheets as a content script **dynamically,
only while the theme is enabled**, at `runAt: 'document_start'`. This is what makes first
paint flash-free: Chrome has the CSS applied before anything renders. `src/content.js`
therefore runs only while enabled; it picks the site's flag from the hostname
(`html[data-olxd="1"]` or `html[data-svd="1"]`) and sets it unconditionally and
synchronously — no storage read on the paint path.

Every rule in every stylesheet is scoped under that site's flag, which is what makes
toggling instant: removing the attribute restores the light site with no reload and no
orphaned styles. Tabs already open when the theme is enabled never ran the content script,
so `enable()` injects CSS + `content.js` by hand and `disable()` reverses both.

### OLX.pt (`src/olx/`)

React + Tailwind on top of a semantic design-token layer (`--color-background-primary`,
plus a camelCase duplicate family `--colorsBackgroundSecondary`). Tailwind utilities such
as `bg-background-primary` resolve through those variables, so **overriding roughly 90
variables re-skins the whole site**. That is the entire strategy; do not write
per-component rules for things the tokens already cover.

Three constraints are load-bearing and easy to break:

1. **Overrides must target `html`, `body` and `#hydrate-root` together** (`src/olx/tokens.css`).
   OLX declares the tokens on those elements, and an element's own declaration beats an
   inherited `!important` value. An override on `:root` alone silently does nothing.
2. **Every token exists twice**, kebab-case and camelCase. Both are used in the wild; set both.
3. **`html`/`body` are transparent** — the browser paints the white canvas. It must be set
   explicitly (`src/olx/theme.css`).

`m.olx.pt` is not a separate app: below roughly a 1024-px viewport OLX redirects the
desktop site to it, and it serves the same React app in its mobile layout under the same
flag and the same tokens. It is its own `SITES` entry so it can append
`src/olx/mobile.css`, which covers the hardcoded mobile chrome (the white page layer under
`#hydrate-root`, the "Continua na app" install banner keyed on
`data-testid="app-install-banner-title"`, the Swiper photo placeholders and the bottom
navigation keyed on `data-testid="bottom-bar-container"`). Don't "fix" the muted meta
text: `--primitivesColorsLightGray06Gray` (#406367) doubles as the border colour in ~130
places, so raising it for contrast would brighten every hairline.

### Standvirtual.com (`src/sv/`)

Next.js (`#__next` instead of `#hydrate-root`) with **four** token layers, all overridden:

| Layer      | Example                          | Where it is declared |
| ---------- | -------------------------------- | -------------------- |
| primitives | `--primitivesColorsGray07Black`  | `:root`              |
| semantic   | `--color-background-primary`     | `:root`              |
| camelCase  | `--colorsBackgroundPrimary`      | `:root`              |
| turbo      | `--color-turbo-content-default`  | `:root` and the site's `nightdrive` theme |

Notes that matter:

- The semantic and camelCase layers are declared on `:root` with a high-specificity
  selector, so overrides go on `html`, `body` and `#__next` **without `!important`**: the
  body/#__next declarations are element-level and win over inheritance for everything
  below them. (`<html>` itself keeps the light values; nothing below it inherits from it.)
- The site ships an internal dark theme, `html[data-theme="nightdrive"]`, covering only the
  turbo layer and exposed nowhere in the UI. **Do not switch it on** — the dark turbo
  values are vendored into `src/sv/tokens.css`, so the extension keeps working if that
  theme is renamed or removed.
- Some brand aliases (`--color-blue-light`, `--color-gray`, `--color-02-gray`, …) reference
  an undefined legacy family and fall back to hardcoded light hexes. They must be
  overridden by name; overriding the primitives does not reach them.
- The listing cards, footer and `login.standvirtual.com` are older emotion components that
  hardcode colours; `src/sv/patches.css` covers them structurally.

### The toggle

`chrome.action.onClicked` calls `enable()` / `disable()` for both sites at once. Enable
registers both content scripts, then themes every open tab whose URL matches either site.
Disable unregisters both, removes each tab's stylesheets and sends `theme:off`.

## Writing patches

`src/sv/patches.css` and `src/olx/patches.css` exist for components that hardcode colours
instead of using tokens. Match on stable hooks — `data-testid` (Standvirtual exposes many:
`search-results`, `page-header`, `banner-link`, `photo-gallery-item`, `main-services`,
`price-drop-savings-badge`, `motors-layout`, `desktop-header`, `tabs`; OLX: `main`, `aside`,
`seller_card`, `l-card`, `qa-advert-slot`, `home-page`, `search-submit`,
`post-new-ad-button`), ids, element type, or arbitrary Tailwind values such as
`[class*="bg-[#E0F0FF]"]` (those are source code, not generated hashes). Standvirtual
also forwards stable attributes as hooks — `data-applied-filter-chip`,
`data-clear-all-button`, `data-testid="data-table-header"` / `"desktop-datatable"`,
`data-has-background`, `data-variant` — and its editorial app uses Tailwind-style
utility classes such as `bg-bgWhite`, `text-textDefault` and `border-borderDefault`.
The legacy pages (e.g. `/sitemap`) are plain BEM under `body.carspt` (`.page-top`,
`.helpinfo`, `#siteWrap`), and the account shell is keyed on a section whose `h2 > span`
id ends in `-heading`. OLX's design-system components also expose stable class names
(`n-checkbox-label-label`, `n-textinput-layout`), the legacy 404 shell is `.c-wrapper` /
`.c-container`, and `/landingbundles` is plain BEM (`.badge-new`, `.bundle-item`,
`.lp-bundles-*`).

**Never match generated emotion / CSS-module classes** like `.css-1ek5um8`, `.ooa-ljs66p`,
`.css-16c4qoj` or `.CJYm8`; they change on every deploy.

Available tokens for patch rules, on both sites: `--olxd-page`, `--olxd-surface`,
`--olxd-surface-2`, `--olxd-surface-3`, `--olxd-text`, `--olxd-text-dim`,
`--olxd-text-muted`, `--olxd-line`, `--olxd-line-strong`, `--olxd-accent`,
`--olxd-on-accent`. Standvirtual adds `--olxd-action` (brand blue fill).

Watch for the token-dual-use trap: OLX writes utilities like
`text-background-action-primary`, using a *background* token as a text colour. When a token
is darkened for use as a surface, any `text-<that-token>` utility becomes dark-on-dark.
`src/olx/patches.css` already corrects the known ones.

## Verifying a change

The fastest loop is to inject the stylesheets into a live tab (fetching from `localhost`
is blocked by the page's CSP, so pass the CSS text inline), set the site flag via
`setAttribute('data-olxd','1')` or `setAttribute('data-svd','1')`, and drive the MCP
browser tools. The team's acceptance test is a luminance audit: walk the DOM, and for every
visible element compute background luminance; anything above ~190 that is not an image or
an ad creative is a leftover light surface. Also scan leaf text nodes for contrast —
dark-on-dark (colour luminance < 90 over a background < 70) and, more generally, a WCAG
ratio below ~2.5 against the nearest opaque ancestor background. Skip text over images.

Verified so far — OLX: home, category listings, search results, ad detail, header menu,
footer, ad slots, "A tua conta" (`/myaccount`), payment history, user settings,
candidate profile, the chat list plus a conversation thread, favourites
(`/favoritos/*`, rendered by the `observed-page` component), saved searches, the
package-purchase flow (`/purchase/packages/*`) and wallet top-up, the ad-publishing
form, the legacy `/landingbundles` marketing page, the standalone 404 shell
("Houston, temos um problema!"), and the mobile layout on `m.olx.pt` (listing pages
only so far — the mobile account, chat and ad-detail screens are not audited).
Standvirtual: home, listing pages
(including the `/carros/<city|brand>` filter landings and the new-car catalogue),
ad detail and the new-car store pages, the `/vender` landing page, the login app, the
whole account shell (`/contapessoal/active|waiting|messages|newinvoices|preferences`),
favourites, saved searches, `/avaliacao-do-carro`, the editorial site
(`/diarioautomovel` index and articles), `/sitemap`, and the publishing entry form
(`/carros/anunciar`).

Deliberately out of scope, because they are outside the allowlist: `business.olx.pt`
(the "Pacotes de anúncios" footer link redirects there — a separate WordPress site),
`help.olx.pt`, and on the Standvirtual side `ajuda.standvirtual.com` (the Cookies
footer link redirects there), `carros.standvirtual.com` (the check-up service) and the
`*.standvirtual.com` dealer subdomains. Not yet audited: OLX login, and the Standvirtual
publishing wizard behind the entry form (reaching it means creating a real listing).

## Commits and versions

The project targets semver, so commit messages must follow Conventional Commits:
`fix:` → patch, `feat:` → minor, `feat!:` / `BREAKING CHANGE:` → major. This is what
semver automation (release-please / semantic-release style, run CI-side — the repo
stays dependency-free) derives versions from. **Below 1.0.0 the config enables
`bump-minor-pre-major` and `bump-patch-for-minor-pre-major`**, so today the arithmetic
is `fix:`/`feat:` → patch (0.2.1 → 0.2.2) and `feat!:`/`BREAKING CHANGE:` → minor
(0.2.1 → 0.3.0); the major bump starts only once the version reaches 1.0.0. Keep
writing `feat!:` for a break regardless — it is what earns the minor bump and records
the break in the changelog. Use an English `type: imperative summary` line under ~72
chars, with a body explaining the why when it isn't obvious.
Keep `manifest.json`'s `version` and the git tag in step — release-please does the
bumping for you. The baseline is `v0.2.0`.

The automation lives in `.github/workflows/`: release-please keeps a release PR open
(bumping `manifest.json`, writing `CHANGELOG.md`); merging it cuts the tag and the
GitHub Release. Publishing is not chained automatically — release-please creates the
release with the workflow token, and such events do not trigger further workflows —
so run `publish.yml` for the tag. The tag must already have a GitHub Release — the
workflow uploads to it and does not create one. It validates, then attaches two zips
of the unpacked extension (version-named, plus stable-named so
`releases/latest/download/olx-dark-theme.zip` never goes stale). The release assets
are uploaded with `--clobber`, so re-running for a tag is safe; the opt-in web-store
job, however, re-uploads whenever it runs:

```bash
TAG=$(gh release list --limit 1 --json tagName --jq '.[0].tagName')
gh workflow run publish.yml -f tag="$TAG"
```

Chrome Web Store upload is opt-in via the `PUBLISH_TO_WEB_STORE` repo variable plus
`CWS_*` secrets; the store item itself must be created once by hand (see
`publish.yml`). CI-plumbing commits are `ci:`/`chore:` so they do not consume a
version bump.

release-please config traps: it builds its path map **only** from the config's
`packages` key — a flat config without `packages` is a silent no-op (green runs,
nothing released). `release-type` must be a real strategy; there is no `chrome-ext`
type — this repo uses `simple` plus a JSON extra-file that bumps `manifest.json`'s
`$.version`.

## Things not to do

- Do not filter, invert or dim listing photos. Only ad creatives are dimmed (to 0.8
  brightness on OLX, because they render in cross-origin iframes no CSS can reach); empty
  ad slots are repainted.
- Do not add a popup or options page. The product decision is one toolbar button, nothing else.
- Do not widen `host_permissions` beyond the seven exact origins in `manifest.json`. The
  same allowlist is repeated in `background.js` (`SITES[].hosts`) and `content.js`; keep
  all three in step when adding a host. Never go back to `*://*.<domain>/*` — that would
  cover help centres, blogs and sibling apps the theme was not built for.
- Do not turn on Standvirtual's `data-theme="nightdrive"`; keep the turbo palette vendored.
- There is no build step to add; keeping the extension dependency-free is deliberate.
- All user-facing strings (name, description, tooltips, badge text) are English.
