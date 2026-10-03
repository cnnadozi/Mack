const MARKER = 'mackCursor';

// Hotspot sits on the arrow tip. PNGs are inlined so the page never needs extension file access.
const CURSORS = {
  default: { path: 'assets/cursor-default.png', x: 4, y: 3 },
  clickable: { path: 'assets/cursor-clickable.png', x: 4, y: 3 },
};

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function cursorUrl({ path, x, y }) {
  const response = await fetch(chrome.runtime.getURL(path));
  const dataUrl = await blobToDataUrl(await response.blob());
  return `url("${dataUrl}") ${x} ${y}`;
}

// Text fields keep the normal I-beam so typing position stays easy to see.
function cursorCss(defaultCursor, clickableCursor) {
  return `
*, *::before, *::after { cursor: ${defaultCursor}, auto !important; }
input, textarea, [contenteditable=""], [contenteditable="true"] { cursor: text !important; }
a[href], a[href] *, button, button *, summary, label, select,
[role="button"], [role="button"] *, [role="link"], [role="link"] *,
input[type="button"], input[type="submit"], input[type="reset"],
input[type="checkbox"], input[type="radio"] { cursor: ${clickableCursor}, pointer !important; }
`;
}

let cursorCssText = '';

const toggle = document.getElementById('cursor-toggle');
const status = document.getElementById('status');

function render(enabled) {
  toggle.setAttribute('aria-pressed', String(enabled));
  toggle.textContent = enabled ? 'Turn off Mack cursor' : 'Turn on Mack cursor';
}

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function runInPage(tabId, func, args) {
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return result.result;
}

async function isEnabled(tabId) {
  return runInPage(tabId, (marker) => marker in document.documentElement.dataset, [MARKER]);
}

async function setEnabled(tabId, enabled) {
  const target = { tabId };
  if (enabled) {
    await chrome.scripting.insertCSS({ target, css: cursorCssText });
  } else {
    await chrome.scripting.removeCSS({ target, css: cursorCssText });
  }
  // The marker lives on the page, so it resets together with the CSS on navigation.
  await runInPage(
    tabId,
    (marker, on) => {
      if (on) document.documentElement.dataset[marker] = '';
      else delete document.documentElement.dataset[marker];
    },
    [MARKER, enabled],
  );
}

async function init() {
  const [defaultCursor, clickableCursor] = await Promise.all([
    cursorUrl(CURSORS.default),
    cursorUrl(CURSORS.clickable),
  ]);
  cursorCssText = cursorCss(defaultCursor, clickableCursor);

  let tabId;
  try {
    tabId = await activeTabId();
    render(await isEnabled(tabId));
  } catch {
    // Chrome blocks extensions on its own pages (chrome://, the Web Store).
    toggle.disabled = true;
    status.textContent = "Mack can't run on this page. Try a normal website.";
    return;
  }

  toggle.addEventListener('click', async () => {
    const next = toggle.getAttribute('aria-pressed') !== 'true';
    try {
      await setEnabled(tabId, next);
      render(next);
      status.textContent = '';
    } catch {
      status.textContent = 'Something went wrong. Reload the page and try again.';
    }
  });
}

init();
