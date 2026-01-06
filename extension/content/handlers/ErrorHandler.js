/**
 * EasyLeaf Error Handler
 * Detects and extracts compile errors from Overleaf
 */

export class ErrorHandler {
    constructor(state) {
        this.state = state;
    }

    extractErrorInfo() {
        try {
            // Try to find error information in Overleaf's log panel
            const logPanel = document.querySelector(
                '.logs-pane, [class*="logs"], .log-entry'
            );

            if (!logPanel) {
                return this.extractFromAlerts();
            }

            const logText = logPanel.textContent || '';
            return this.parseLogText(logText);

        } catch (error) {
            console.error('Error extracting error info:', error);
            return null;
        }
    }

    extractFromAlerts() {
        // Try to get error from alert elements
        const alerts = document.querySelectorAll(
            '.alert-danger, [class*="error"], .compile-error'
        );

        for (const alert of alerts) {
            const text = alert.textContent?.trim();
            if (text && text.length > 5) {
                return {
                    message: text.slice(0, 200),
                    line: this.extractLineNumber(text),
                    context: ''
                };
            }
        }

        return null;
    }

    parseLogText(logText) {
        // Common LaTeX error patterns
        const errorPatterns = [
            // Standard LaTeX errors
            /^!\s*(.+?)$/m,
            // Line reference
            /l\.(\d+)\s+(.+)/,
            // Missing errors
            /Missing\s+(.+?)(?:\.|$)/i,
            // Undefined command
            /Undefined control sequence.*?\\(\w+)/i,
            // Package errors
            /Package\s+(\w+)\s+Error:\s*(.+)/,
        ];

        let message = '';
        let line = null;

        // Extract error message
        for (const pattern of errorPatterns) {
            const match = logText.match(pattern);
            if (match) {
                message = match[1] || match[0];
                break;
            }
        }

        // Extract line number
        line = this.extractLineNumber(logText);

        // Extract context (lines around the error)
        const context = this.extractContext(logText, line);

        return {
            message: message || 'Unknown compile error',
            line,
            context,
            fullLog: logText.slice(0, 1000)
        };
    }

    extractLineNumber(text) {
        // Try various line number patterns
        const patterns = [
            /l\.(\d+)/,           // l.45
            /line\s+(\d+)/i,      // line 45
            /:(\d+):/,            // :45:
            /at line (\d+)/i      // at line 45
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                return parseInt(match[1], 10);
            }
        }

        return null;
    }

    extractContext(logText, lineNumber) {
        if (!lineNumber) return '';

        try {
            // Try to get lines from the editor
            const lines = document.querySelectorAll('.cm-line, .ace_line');
            const targetIndex = lineNumber - 1;

            if (lines[targetIndex]) {
                const contextLines = [];

                // Get 2 lines before and after
                for (let i = Math.max(0, targetIndex - 2);
                    i <= Math.min(lines.length - 1, targetIndex + 2);
                    i++) {
                    contextLines.push(lines[i].textContent || '');
                }

                return contextLines.join('\n');
            }
        } catch (e) {
            console.error('Failed to extract context:', e);
        }

        return '';
    }

    // Common error classifications
    classifyError(message) {
        const classifications = {
            'syntax': [
                /Missing\s*[{}]/i,
                /Unexpected/i,
                /Extra\s*}/i
            ],
            'command': [
                /Undefined control sequence/i,
                /Unknown command/i
            ],
            'package': [
                /Package.*Error/i,
                /File.*not found/i
            ],
            'math': [
                /Missing \$/i,
                /Math.*mode/i
            ],
            'structure': [
                /\\begin.*\\end/i,
                /environment/i
            ]
        };

        for (const [type, patterns] of Object.entries(classifications)) {
            for (const pattern of patterns) {
                if (pattern.test(message)) {
                    return type;
                }
            }
        }

        return 'unknown';
    }
}
