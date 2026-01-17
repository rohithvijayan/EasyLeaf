/**
 * EasyLeaf API Client
 * Handles communication with the backend API.
 */

class ApiClient {
    constructor() {
        // ============================================
        // ⚠️ CONFIGURATION: Change this URL for development
        // ============================================
        // For local development with ngrok:
        //   1. Run: ngrok http 8000
        //   2. Copy the https URL (e.g., https://abc123.ngrok.io)
        //   3. Paste it below
        // For production, use your deployed backend URL.
        // ============================================

        // CHANGE THIS to your ngrok URL when testing:
        this.baseUrl = 'https://localhost:8000/api/v1';
        // Example with ngrok: this.baseUrl = 'https://abc123.ngrok-free.app/api/v1';

        this.cache = new Map();
    }

    /**
     * Request an AI explanation for a LaTeX error.
     * @param {Object} errorData - { message, line, lineContent, context }
     * @returns {Promise<Object>} - { explanation, fix, fixed_code }
     */
    async explainError(errorData) {
        const cacheKey = `${errorData.message}:${errorData.lineContent}`;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            console.log('🎯 Cache hit for error explanation');
            return this.cache.get(cacheKey);
        }

        try {
            const response = await fetch(`${this.baseUrl}/debugger/explain/`, {
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

            // Cache the result
            this.cache.set(cacheKey, result);

            return result;

        } catch (error) {
            console.error('🔴 API Client Error:', error);
            return {
                explanation: 'Could not connect to AI service.',
                fix: 'Check if the backend is running.',
                fixed_code: errorData.lineContent
            };
        }
    }

    clearCache() {
        this.cache.clear();
    }
}

window.ApiClient = ApiClient;
