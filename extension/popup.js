// Must match STORAGE_KEY in cursor-content.js, which applies the cursor on each page.
const STORAGE_KEY = 'mackCursorEnabled';

const toggle = document.getElementById('cursor-toggle');
const status = document.getElementById('status');

function render(enabled) {
  toggle.setAttribute('aria-pressed', String(enabled));
  toggle.textContent = enabled ? 'Turn off Mack cursor' : 'Turn on Mack cursor';
}

async function init() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  render(stored[STORAGE_KEY] === true);

  toggle.addEventListener('click', async () => {
    const next = toggle.getAttribute('aria-pressed') !== 'true';
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
      render(next);
      status.textContent = '';
    } catch {
      status.textContent = 'Something went wrong. Please try again.';
    }
  });
}

init();

document.getElementById('open-conversation').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/voice/conversation.html') });
});
