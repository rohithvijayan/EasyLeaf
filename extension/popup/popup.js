/**
 * EasyLeaf Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
    const beginnerToggle = document.getElementById('beginnerToggle');
    const aiAssistToggle = document.getElementById('aiAssistToggle');
    const status = document.getElementById('status');
    const openPanelBtn = document.getElementById('openPanel');
    const openSettingsBtn = document.getElementById('openSettings');

    // Load initial state
    const state = await chrome.storage.local.get(['isBeginnerMode', 'isAiAssistEnabled']);

    if (state.isBeginnerMode) {
        beginnerToggle.classList.add('active');
    }

    // AI Assist defaults to enabled
    if (state.isAiAssistEnabled !== false) {
        aiAssistToggle.classList.add('active');
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

    // Beginner Mode toggle handler
    beginnerToggle.addEventListener('click', async () => {
        beginnerToggle.classList.toggle('active');
        const isEnabled = beginnerToggle.classList.contains('active');

        await chrome.storage.local.set({ isBeginnerMode: isEnabled });

        // Notify content script
        if (isOnOverleaf) {
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    type: 'SET_BEGINNER_MODE',
                    payload: { enabled: isEnabled }
                });
            } catch (e) {
                console.log('Content script not ready, state saved for next load');
            }
        }
    });

    // AI Assist toggle handler
    aiAssistToggle.addEventListener('click', async () => {
        aiAssistToggle.classList.toggle('active');
        const isEnabled = aiAssistToggle.classList.contains('active');

        await chrome.storage.local.set({ isAiAssistEnabled: isEnabled });

        // Notify content script
        if (isOnOverleaf) {
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    type: 'SET_AI_ASSIST',
                    payload: { enabled: isEnabled }
                });
            } catch (e) {
                console.log('Content script not ready, state saved for next load');
            }
        }
    });

    // Open side panel
    openPanelBtn.addEventListener('click', async () => {
        if (isOnOverleaf) {
            try {
                await chrome.sidePanel.open({ tabId: tab.id });
                window.close();
            } catch (e) {
                // Fallback: Try to set the panel
                await chrome.sidePanel.setOptions({
                    tabId: tab.id,
                    path: 'sidepanel/index.html',
                    enabled: true
                });
                window.close();
            }
        } else {
            alert('Please open an Overleaf project first');
        }
    });

    // Settings (placeholder)
    openSettingsBtn.addEventListener('click', () => {
        alert('Settings coming soon!');
    });
});
