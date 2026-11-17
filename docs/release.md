# Release checklist

Versions are owned by release-please: it keeps a `chore(main): release X.Y.Z`
pull request up to date from Conventional Commits on `main`. **Merging that PR
is the release decision** — it bumps `manifest.json`, updates `CHANGELOG.md`,
cuts the tag and calls `publish.yml`. Never edit the version by hand.

## Before merging

- [ ] `node tools/check.mjs` passes locally, and the `checks` workflow is green
      on the release PR's base commit.
- [ ] Live audit against [the coverage audit](audit.md): every row marked `fixed`
      still holds on the current sites. Update the "Last live verification" date.
- [ ] If anything visible changed, refresh the affected files in `screenshots/`
      (desktop captures are 2732×1536, mobile 390×844) and re-read the README alt
      text so it still describes them.
- [ ] The release PR is mergeable and its changelog lists the expected fixes.

## Cutting the release

- [ ] Merge the release PR.
- [ ] Wait for the `release-please` workflow: it creates `vX.Y.Z` and calls
      `publish.yml` as a reusable workflow.
- [ ] `publish.yml` runs the structural guard, then attaches two assets to the
      GitHub Release: `olx-dark-theme-vX.Y.Z.zip` and the stable
      `olx-dark-theme.zip`.

## After the release

- [ ] Download `olx-dark-theme.zip`, load it unpacked (or reload the installed
      copy from `chrome://extensions`) and toggle the toolbar button on and off
      once on each site.
- [ ] Spot-check one surface from each audit section: OLX desktop, OLX mobile,
      Standvirtual desktop and Standvirtual narrow.
- [ ] Confirm the Release page lists both assets and the badge shows `ON`.

## Chrome Web Store (not enabled yet)

The `web-store` job is opt-in. To turn it on: register the one-time $5 developer
account, create the item by hand, add the `CWS_EXTENSION_ID`, `CWS_CLIENT_ID`,
`CWS_CLIENT_SECRET` and `CWS_REFRESH_TOKEN` secrets, then set the
`PUBLISH_TO_WEB_STORE` repository variable to `true`. Uploads land as drafts for
review; add `--auto-publish` in `publish.yml` to skip that step.

## Rolling back

`publish.yml` can be dispatched by hand for any tag (`workflow_dispatch` with
the `tag` input), so re-publishing an older release is enough to restore its
zips. The web store path would need a new version — Chrome does not allow
re-uploading a lower version number.
