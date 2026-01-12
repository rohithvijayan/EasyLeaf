const fs = require('fs');
const path = require('path');
const { test, describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock fetch
global.fetch = async (url, options) => {
    // Simulate successful API response
    if (url.includes('/debugger/explain/')) {
        return {
            ok: true,
            json: async () => ({
                explanation: 'Test explanation',
                fix: 'Test fix',
                fixed_code: 'Fixed code'
            })
        };
    }
    return { ok: false };
};

// Mock window
global.window = {};

// Load the source file
const sourcePath = path.join(__dirname, '../content/services/ApiClient.js');
const sourceCode = fs.readFileSync(sourcePath, 'utf8');
eval(sourceCode);

const ApiClient = global.window.ApiClient;

describe('ApiClient', () => {
    let client;

    beforeEach(() => {
        client = new ApiClient();
        client.clearCache();
    });

    it('should call the explain API correctly', async () => {
        const result = await client.explainError({
            message: 'Undefined control sequence',
            lineContent: '\\mistake',
            context: { preamble: '', contextLines: '' }
        });

        assert.strictEqual(result.explanation, 'Test explanation');
        assert.strictEqual(result.fix, 'Test fix');
    });

    it('should cache responses', async () => {
        const errorData = {
            message: 'Test Error',
            lineContent: '\\test',
            context: {}
        };

        // First call
        await client.explainError(errorData);

        // Second call should use cache
        let fetchCalled = false;
        const originalFetch = global.fetch;
        global.fetch = async () => { fetchCalled = true; return { ok: true, json: async () => ({}) }; };

        await client.explainError(errorData);

        assert.strictEqual(fetchCalled, false);
        global.fetch = originalFetch;
    });

    it('should handle API errors gracefully', async () => {
        // Override fetch to simulate error
        global.fetch = async () => { throw new Error('Network error'); };

        const result = await client.explainError({
            message: 'Error',
            lineContent: '\\line',
            context: {}
        });

        assert.strictEqual(result.explanation, 'Could not connect to AI service.');
    });
});
