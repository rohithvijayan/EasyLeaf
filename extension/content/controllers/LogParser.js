/**
 * EasyLeaf Log Parser
 * Extracts structured error information from raw Overleaf/LaTeX logs.
 */

class LogParser {
    constructor() {
        this.patterns = [
            // Standard LaTeX error starting with "! " followed by line number on next line "l.12"
            // Example:
            // ! Undefined control sequence.
            // l.12 \mistake
            {
                regex: /^!\s+(.*?)\n\s*l\.(\d+)/gm,
                extract: (match) => ({
                    message: match[1].trim(),
                    line: parseInt(match[2], 10),
                    fullText: match[0]
                })
            },
            // File:Line style error (often from packages or compilers like LuaLaTeX/XeLaTeX)
            // Example: ./main.tex:12: Undefined control sequence.
            {
                regex: /^(.*?):(\d+):\s+(.*)$/gm,
                extract: (match) => ({
                    message: match[3].trim(),
                    line: parseInt(match[2], 10),
                    file: match[1].trim(),
                    fullText: match[0]
                })
            },
            // Runaway argument check
            // Example: Runaway argument?
            // { \textbf {oops} \end {document}
            // ! File ended while scanning use of \@newl@bel.
            {
                regex: /^Runaway argument\?[\s\S]*?!.*$/gm,
                extract: (match) => ({
                    message: "Runaway argument (unclosed brace?)",
                    line: null, // Hard to find line number for runaway args sometimes, but we try
                    fullText: match[0]
                })
            }
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
}

// Export to global scope for use in main.js
window.LogParser = LogParser;
