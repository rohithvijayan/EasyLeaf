/**
 * EasyLeaf Background Service Worker
 * Handles message routing, API calls, and state management
 */

// API Configuration
const API_BASE_URL = 'https://interoceanic-elliot-unelectric.ngrok-free.dev/api/v1';

// State
let isBeginnerMode = false;

// Initialize
chrome.runtime.onInstalled.addListener(async () => {
    console.log('EasyLeaf installed');

    // Set default state
    await chrome.storage.local.set({
        isBeginnerMode: false,
        lastGoodState: null,
        errorCache: {}
    });
});

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
    switch (message.type) {
        case 'GET_STATE':
            return await getState();

        case 'SET_BEGINNER_MODE':
            return await setBeginnerMode(message.payload.enabled);

        case 'EXPLAIN_ERROR':
            return await explainError(message.payload);

        case 'EXPLAIN_AI_ERROR':
            return await explainAIError(message.payload);

        case 'SAVE_GOOD_STATE':
            return await saveGoodState(message.payload);

        case 'RESTORE_GOOD_STATE':
            return await restoreGoodState();

        case 'GENERATE_SNIPPET':
            return await generateSnippet(message.payload);

        default:
            console.warn('Unknown message type:', message.type);
            return { error: 'Unknown message type' };
    }
}

// State management
async function getState() {
    const state = await chrome.storage.local.get([
        'isBeginnerMode',
        'isAiAssistEnabled',
        'lastGoodState'
    ]);
    return state;
}

async function setBeginnerMode(enabled) {
    await chrome.storage.local.set({ isBeginnerMode: enabled });
    isBeginnerMode = enabled;
    return { success: true, isBeginnerMode: enabled };
}

// Error explanation via API
async function explainError(errorData) {
    // Check local cache first
    const { errorCache } = await chrome.storage.local.get('errorCache');
    const cacheKey = generateCacheKey(errorData.error_message);

    if (errorCache[cacheKey]) {
        return { ...errorCache[cacheKey], cached: true };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/errors/explain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(errorData)
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();

        // Cache result
        errorCache[cacheKey] = result;
        await chrome.storage.local.set({ errorCache });

        return result;
    } catch (error) {
        console.error('Error explaining error:', error);
        return getFallbackExplanation(errorData.error_message);
    }
}

// AI Error explanation via Groq API (for Error Explainer feature)
async function explainAIError(errorData) {
    const cacheKey = `${errorData.message}:${errorData.lineContent}`;
    const { aiErrorCache = {} } = await chrome.storage.local.get('aiErrorCache');

    // Check cache
    if (aiErrorCache[cacheKey]) {
        console.log('🎯 Service Worker: Cache hit for AI error explanation');
        return aiErrorCache[cacheKey];
    }

    try {
        console.log('🌐 Service Worker: Calling AI backend...', errorData);
        const response = await fetch(`${API_BASE_URL}/debugger/explain/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error_message: errorData.message,
                invalid_line: errorData.lineContent,
                context: {
                    preamble: errorData.context?.preamble || '',
                    contextLines: errorData.context?.contextLines || ''
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const result = await response.json();
        console.log('🤖 Service Worker: AI Response received:', result);

        // Cache the result
        aiErrorCache[cacheKey] = result;
        await chrome.storage.local.set({ aiErrorCache });

        return result;

    } catch (error) {
        console.error('🔴 Service Worker: API Error:', error);
        return {
            explanation: 'Could not connect to AI service.',
            fix: 'Check if the backend is running.',
            fixed_code: errorData.lineContent
        };
    }
}

// Version management
async function saveGoodState(stateData) {
    const states = await chrome.storage.local.get('goodStates') || { goodStates: [] };
    const goodStates = states.goodStates || [];

    // Keep only last 5 states
    goodStates.unshift({
        content: stateData.content,
        timestamp: Date.now(),
        lineCount: stateData.lineCount
    });

    if (goodStates.length > 5) {
        goodStates.pop();
    }

    await chrome.storage.local.set({
        goodStates,
        lastGoodState: goodStates[0]
    });

    return { success: true };
}

async function restoreGoodState() {
    const { lastGoodState } = await chrome.storage.local.get('lastGoodState');

    if (!lastGoodState) {
        return { error: 'No saved state available' };
    }

    return { content: lastGoodState.content };
}

// Snippet generation via API
async function generateSnippet(snippetData) {
    try {
        const response = await fetch(`${API_BASE_URL}/snippets/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(snippetData)
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error generating snippet:', error);
        return { error: 'Failed to generate snippet' };
    }
}

// Utility functions
function generateCacheKey(errorMessage) {
    return btoa(errorMessage.slice(0, 100)).replace(/[^a-zA-Z0-9]/g, '');
}

function getFallbackExplanation(errorMessage) {
    const patterns = {
        'Missing }': {
            explanation: 'You forgot to close a curly brace somewhere.',
            severity: 'error',
            learning_tip: 'Every { needs a matching }'
        },
        'Undefined control sequence': {
            explanation: "You used a command that LaTeX doesn't recognize.",
            severity: 'error',
            learning_tip: 'Check spelling or make sure the package is loaded'
        },
        'Missing $ inserted': {
            explanation: 'You need to use $ signs around math symbols.',
            severity: 'error',
            learning_tip: 'Math mode requires $..$ or \\[...\\]'
        }
    };

    for (const [pattern, response] of Object.entries(patterns)) {
        if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
            return { ...response, cached: true, fallback: true };
        }
    }

    return {
        explanation: "There's an error in your document. Check the highlighted line.",
        severity: 'error',
        cached: true,
        fallback: true
    };
}

// Side panel control
chrome.action.onClicked.addListener(async (tab) => {
    if (tab.url?.includes('overleaf.com/project')) {
        await chrome.sidePanel.open({ tabId: tab.id });
    }
});
