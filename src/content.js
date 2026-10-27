// OLX & Standvirtual Dark — flag setter.
//
// This file only runs while the theme is enabled (it is registered together
// with the stylesheets), so it can set the flag unconditionally and
// synchronously, before first paint. Removing the flag turns every themed rule
// off instantly, without a reload.
//
// One script serves both sites: the stylesheet for each site is scoped to its
// own flag, so the two palettes can never leak into each other.

(() => {
  const root = document.documentElement;
  const { hostname } = location;

  // Exact hosts, mirroring manifest.json's host_permissions. Nothing else on
  // either domain is themed: help centres, blogs, static hosts and sibling
  // apps stay untouched. Keep this list and the manifest in step.
  const OLX_HOSTS = ['olx.pt', 'www.olx.pt', 'm.olx.pt'];
  const SV_HOSTS = [
    'standvirtual.com',
    'www.standvirtual.com',
    'm.standvirtual.com',
    'login.standvirtual.com',
  ];

  const flag = OLX_HOSTS.includes(hostname)
    ? 'data-olxd'
    : SV_HOSTS.includes(hostname)
      ? 'data-svd'
      : null;
  if (!flag) return;

  let on = true;

  const apply = () => {
    if (on) root.setAttribute(flag, '1');
  };

  // Always set the flag: this file is also re-injected by hand when the theme
  // is enabled on a tab that was already open, and on that second run the
  // flag may have been cleared by a previous toggle.
  apply();

  // Standvirtual hydrates a Next.js tree; re-assert after the document is
  // parsed in case hydration touches <html> attributes. Guarded by `on` so a
  // toggle-off that happens before parsing is not undone.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  }

  if (window.__themeInstalled) return;
  window.__themeInstalled = true;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'theme:off') {
      on = false;
      root.removeAttribute(flag);
    }
    if (msg?.type === 'theme:on') {
      on = true;
      apply();
    }
  });
})();
