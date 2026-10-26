// OLX & Standvirtual Dark — service worker.
//
// Each site's theme is a content script registered *dynamically*: it only
// exists while the theme is on. That is what makes the first paint flash-free —
// Chrome has the CSS applied at document_start, before anything is rendered.

const SITES = [
  {
    id: 'olx-dark',
    hosts: ['olx.pt', 'www.olx.pt'],
    matches: ['*://olx.pt/*', '*://www.olx.pt/*'],
    css: ['src/olx/tokens.css', 'src/olx/theme.css', 'src/olx/patches.css'],
    js: ['src/content.js'],
  },
  {
    id: 'sv-dark',
    hosts: ['standvirtual.com', 'www.standvirtual.com', 'm.standvirtual.com', 'login.standvirtual.com'],
    matches: [
      '*://standvirtual.com/*',
      '*://www.standvirtual.com/*',
      '*://m.standvirtual.com/*',
      '*://login.standvirtual.com/*',
    ],
    css: ['src/sv/tokens.css', 'src/sv/theme.css', 'src/sv/patches.css'],
    js: ['src/content.js'],
  },
];

const ALL_MATCHES = SITES.flatMap((site) => site.matches);
const ALL_IDS = SITES.map((site) => site.id);

const BADGE_ON = '#23E5DB';
const BADGE_OFF = '#3A3A3A';

function siteFor(url) {
  try {
    const { hostname } = new URL(url);
    return SITES.find((site) => site.hosts.includes(hostname));
  } catch {
    return undefined;
  }
}

async function readEnabled() {
  const { enabled } = await chrome.storage.sync.get('enabled');
  return enabled !== false; // dark on by default
}

async function setBadge(on) {
  await chrome.action.setBadgeText({ text: on ? 'ON' : 'OFF' });
  await chrome.action.setBadgeBackgroundColor({ color: on ? BADGE_ON : BADGE_OFF });
  if (chrome.action.setBadgeTextColor) {
    await chrome.action.setBadgeTextColor({ color: on ? '#001414' : '#E6E6E6' });
  }
  await chrome.action.setTitle({
    title: on ? 'Dark theme: on — click to turn off' : 'Dark theme: off — click to turn on',
  });
}

async function themedTabs() {
  return chrome.tabs.query({ url: ALL_MATCHES });
}

async function enable() {
  await chrome.storage.sync.set({ enabled: true });

  // Always replace the registrations rather than skipping existing ones: a
  // registration persists across restarts and extension updates, and an old
  // one may point at stylesheets that have since been renamed or moved.
  try {
    await chrome.scripting.unregisterContentScripts({ ids: ALL_IDS });
  } catch {
    // Nothing registered yet — fine.
  }

  for (const site of SITES) {
    try {
      await chrome.scripting.registerContentScripts([{
        id: site.id,
        matches: site.matches,
        css: site.css,
        js: site.js,
        runAt: 'document_start',
        persistAcrossSessions: true,
      }]);
    } catch (err) {
      // A second click can race the first registration; that is harmless.
      if (!String(err).includes('Duplicate')) throw err;
    }
  }

  // Tabs already open never ran the content script, so theme them by hand.
  // removeCSS first keeps repeated toggles from stacking copies of the sheet.
  for (const tab of await themedTabs()) {
    const site = siteFor(tab.url || '');
    if (!site) continue;
    chrome.scripting.removeCSS({ target: { tabId: tab.id }, files: site.css })
      .catch(() => {})
      .then(() => chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: site.css }))
      .catch(() => {});
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: site.js }).catch(() => {});
    chrome.tabs.sendMessage(tab.id, { type: 'theme:on' }).catch(() => {});
  }

  await setBadge(true);
}

async function disable() {
  await chrome.storage.sync.set({ enabled: false });

  try {
    await chrome.scripting.unregisterContentScripts({ ids: ALL_IDS });
  } catch {
    // Nothing registered — fine.
  }

  for (const tab of await themedTabs()) {
    const site = siteFor(tab.url || '');
    if (!site) continue;
    chrome.scripting.removeCSS({ target: { tabId: tab.id }, files: site.css }).catch(() => {});
    chrome.tabs.sendMessage(tab.id, { type: 'theme:off' }).catch(() => {});
  }

  await setBadge(false);
}

async function toggle() {
  if (await readEnabled()) await disable();
  else await enable();
}

// Single button: the toolbar icon.
chrome.action.onClicked.addListener(() => {
  toggle();
});

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled } = await chrome.storage.sync.get('enabled');
  if (enabled === undefined) await chrome.storage.sync.set({ enabled: true });
  await (enabled === false ? disable() : enable());
});

chrome.runtime.onStartup.addListener(async () => {
  await (await readEnabled() ? enable() : disable());
});
