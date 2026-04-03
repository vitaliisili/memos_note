let windowId = null;

// On install or startup, apply the display mode setting
chrome.runtime.onInstalled.addListener(applyDisplayMode);
chrome.runtime.onStartup.addListener(applyDisplayMode);

// React to setting changes
chrome.storage.onChanged.addListener((changes) => {
  if (changes.displayMode) applyDisplayMode();
});

function applyDisplayMode() {
  chrome.storage.local.get(['displayMode'], (data) => {
    const mode = data.displayMode || 'popup';
    if (mode === 'window') {
      chrome.action.setPopup({ popup: '' });
    } else {
      chrome.action.setPopup({ popup: 'popup.html' });
    }
  });
}

// Only fires when popup is empty string (window mode)
chrome.action.onClicked.addListener(async () => {
  if (windowId !== null) {
    try {
      await chrome.windows.get(windowId);
      chrome.windows.update(windowId, { focused: true });
      return;
    } catch {
      windowId = null;
    }
  }

  const win = await chrome.windows.create({
    url: 'popup.html',
    type: 'normal',
    width: 960,
    height: 680
  });
  windowId = win.id;
});

chrome.windows.onRemoved.addListener((id) => {
  if (id === windowId) windowId = null;
});
