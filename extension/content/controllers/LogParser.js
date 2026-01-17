/**
 * EasyLeaf Log Parser
 * Extracts structured error information from raw Overleaf/LaTeX logs.
 */

class LogParser {
    constructor() {
        this.patterns = [
            // ========================================
            // PRIORITY 1: MULTI-LINE PATTERNS WITH l.XX
            // These handle errors where l.XX may be several lines after ! Error
            // ========================================

            // 1. Any "!" error with l.XX somewhere after it (multi-line)
            // This is the most comprehensive pattern - matches up to 10 lines ahead
            {
                regex: /^!\s+([^\n]+)(?:[\s\S]{0,500}?)l\.(\d+)/gm,
                extract: (match) => ({
                    message: match[1].trim(),
                    line: parseInt(match[2], 10),
                    fullText: match[0],
                    type: 'error'
                })
            },

            // ========================================
            // PRIORITY 2: FILE:LINE FORMAT
            // ========================================

            // 2. File:Line style error (packages, LuaTeX, etc.)
            // Example: ./main.tex:12: Undefined control sequence.
            {
                regex: /^(\.\/?[^:]+):(\d+):\s+(.*)$/gm,
                extract: (match) => ({
                    message: match[3].trim(),
                    line: parseInt(match[2], 10),
                    file: match[1].trim(),
                    fullText: match[0],
                    type: 'error'
                })
            },

            // 3. LaTeX Error: ... on input line X
            {
                regex: /^LaTeX Error:\s+(.*?)\s+on input line\s+(\d+)\.?/gm,
                extract: (match) => ({
                    message: match[1].trim(),
                    line: parseInt(match[2], 10),
                    fullText: match[0],
                    type: 'error'
                })
            },

            // ========================================
            // PRIORITY 3: SPECIAL CASES (no line number)
            // ========================================

            // 4. Runaway argument (unclosed brace)
            {
                regex: /^Runaway argument\?[\s\S]*?!.*$/gm,
                extract: (match) => ({
                    message: "Runaway argument (likely an unclosed curly brace '}')",
                    line: null,
                    fullText: match[0],
                    type: 'error'
                })
            },

            // 5. Emergency Stop (Fatal)
            {
                regex: /^!\s+Emergency stop\./gm,
                extract: (match) => ({
                    message: "Emergency stop (compilation aborted fatally)",
                    line: null,
                    fullText: match[0],
                    type: 'critical'
                })
            }

            // NOTE: Removed catch-all pattern - it was causing duplicates
            // All errors should be caught by pattern 1 (multi-line)
        ];
    }

    /**
 * Parse raw log text and return the first critical error found.
 * We prioritize the first error as it's usually the root cause.
 * @param {string} logText 
 * @returns {Object|null} { line, message, file, context }
 */
    parse(logText) {
        if (!logText) return null;

        // Clean up common noise
        // Replace potential invisible characters or weird line breaks
        const cleanText = logText.replace(/\r\n/g, '\n');

        for (const pattern of this.patterns) {
            // Reset lastIndex for stateful global regex
            pattern.regex.lastIndex = 0;
            const match = pattern.regex.exec(cleanText);

            if (match) {
                const error = pattern.extract(match);
                // Basic validation
                if (error.message) {
                    return error;
                }
            }
        }

        return null;
    }

    /**
     * Parse raw log text and return ALL errors found.
     * Includes Unicode cleaning and deduplication.
     * @param {string} logText 
     * @returns {Array} Array of error objects
     */
    parseAll(logText) {
        if (!logText) return [];

        // Clean up:
        // 1. Normalize line breaks
        // 2. Remove invisible Unicode control characters (U+200B, U+202A, U+202C, etc.)
        let cleanText = logText
            .replace(/\r\n/g, '\n')
            .replace(/[\u200B-\u200D\u2028\u2029\u202A-\u202E\uFEFF]/g, '');

        const errors = [];
        const seen = new Set(); // For deduplication

        for (const pattern of this.patterns) {
            pattern.regex.lastIndex = 0;
            let match;

            while ((match = pattern.regex.exec(cleanText)) !== null) {
                const error = pattern.extract(match);
                if (error && error.message) {
                    // Create a unique key for deduplication
                    // If we have a line number, use it; otherwise use the full message
                    const key = error.line
                        ? `${error.line}:${error.message.substring(0, 50)}`
                        : `null:${error.message}`;

                    if (!seen.has(key)) {
                        seen.add(key);
                        errors.push(error);
                    }
                }
            }
        }

        // Sort by line number (errors with line numbers first, then by line number)
        errors.sort((a, b) => {
            if (a.line === null && b.line === null) return 0;
            if (a.line === null) return 1; // null lines go to end
            if (b.line === null) return -1;
            return a.line - b.line;
        });

        return errors;
    }
}

// Export to global scope for use in main.js
window.LogParser = LogParser;
