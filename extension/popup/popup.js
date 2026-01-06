/**
 * EasyLeaf Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.getElementById('beginnerToggle');
    const status = document.getElementById('status');
    const openPanelBtn = document.getElementById('openPanel');
    const openSettingsBtn = document.getElementById('openSettings');

    // Load initial state
    const state = await chrome.storage.local.get(['isBeginnerMode']);
    if (state.isBeginnerMode) {
        toggle.classList.add('active');
    }

    // Check if we're on Overleaf
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isOnOverleaf = tab?.url?.includes('overleaf.com/project');

    if (isOnOverleaf) {
        status.innerHTML = `
      <div class="status-card active">
        <span class="status-icon">🟢</span>
        <span class="status-text">Connected to Overleaf project</span>
      </div>
    `;
    }

    // Toggle handler
    toggle.addEventListener('click', async () => {
        toggle.classList.toggle('active');
        const isEnabled = toggle.classList.contains('active');

        await chrome.storage.local.set({ isBeginnerMode: isEnabled });

        // Notify content script
        if (isOnOverleaf) {
            chrome.tabs.sendMessage(tab.id, {
                type: 'SET_BEGINNER_MODE',
                payload: { enabled: isEnabled }
            });
        }
    });

    // Open side panel
    openPanelBtn.addEventListener('click', async () => {
        if (isOnOverleaf) {
            await chrome.sidePanel.open({ tabId: tab.id });
            window.close();
        } else {
            alert('Please open an Overleaf project first');
        }
    });

    // Settings (placeholder)
    openSettingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage?.() || alert('Settings coming soon!');
    });
});
