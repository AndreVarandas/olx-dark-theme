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
`[class*="bg-[#E0F0FF]"]` (those are source code, not generated hashes).

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
form, and the legacy `/landingbundles` marketing page. Standvirtual: home, listing
pages, ad detail, the `/vender` landing page and the login app.

Two things are deliberately out of scope: `business.olx.pt` (the "Pacotes de anúncios"
footer link redirects there — a separate WordPress site, not in the allowlist) and
`help.olx.pt`. Not yet audited: OLX login, and Standvirtual account, messages and the
ad-publishing form.

## Commits and versions

The project targets semver, so commit messages must follow Conventional Commits:
`fix:` → patch, `feat:` → minor, `feat!:` / `BREAKING CHANGE:` → major. This is what
semver automation (release-please / semantic-release style, run CI-side — the repo
stays dependency-free) derives versions from. Use an English `type: imperative
summary` line under ~72 chars, with a body explaining the why when it isn't obvious.
Keep `manifest.json`'s `version` and the git tag in step — release-please does the
bumping for you. The baseline is `v0.2.0`.

The automation lives in `.github/workflows/` and stays inert until the repo gains a
GitHub remote: release-please keeps a release PR open (bumping `manifest.json`,
writing `CHANGELOG.md`); merging it cuts the tag, the GitHub Release and a zip of
the unpacked extension. Chrome Web Store upload is opt-in via the
`PUBLISH_TO_WEB_STORE` repo variable plus `CWS_*` secrets. CI-plumbing commits are
`ci:`/`chore:` so they do not consume a version bump.

## Things not to do

- Do not filter, invert or dim listing photos. Only ad creatives are dimmed (to 0.8
  brightness on OLX, because they render in cross-origin iframes no CSS can reach); empty
  ad slots are repainted.
- Do not add a popup or options page. The product decision is one toolbar button, nothing else.
- Do not widen `host_permissions` beyond the six exact origins in `manifest.json`. The
  same allowlist is repeated in `background.js` (`SITES[].hosts`) and `content.js`; keep
  all three in step when adding a host. Never go back to `*://*.<domain>/*` — that would
  cover help centres, blogs and sibling apps the theme was not built for.
- Do not turn on Standvirtual's `data-theme="nightdrive"`; keep the turbo palette vendored.
- There is no build step to add; keeping the extension dependency-free is deliberate.
- All user-facing strings (name, description, tooltips, badge text) are English.
