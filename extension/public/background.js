// Background service worker for Quorum extension

// Listen for messages from the popup to open side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openSidePanel') {
    // Get the current window and open side panel
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.sidePanel.open({ windowId: tabs[0].windowId });
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No active tab' });
      }
    });
    return true; // Keep message channel open for async response
  }
});

// Enable side panel for all sites
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
