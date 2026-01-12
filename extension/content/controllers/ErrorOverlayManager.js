/**
 * EasyLeaf Error Overlay Manager
 * Handles visual indication of errors in the editor.
 */

class ErrorOverlayManager {
    constructor(editorController) {
        this.editor = editorController;
        this.activeErrorLine = null;
        this.overlayElement = null;
    }

    /**
     * Show an error indicator on a specific line.
     * @param {number} lineNumber - 1-based line number
     * @param {string} message - Error message
     */
    showError(lineNumber, message) {
        this.clear();

        if (!lineNumber) return;

        // Find the line element
        const lineElement = this.getLineElement(lineNumber);
        if (lineElement) {
            this.highlightLine(lineElement, message);
            this.activeErrorLine = lineNumber;
        } else {
            console.warn(`Could not find DOM element for line ${lineNumber}`);
        }
    }

    clear() {
        // Remove existing highlights
        document.querySelectorAll('.el-error-line').forEach(el => {
            el.classList.remove('el-error-line');
            const tooltip = el.querySelector('.el-error-tooltip');
            if (tooltip) tooltip.remove();
        });
        this.activeErrorLine = null;
    }

    getLineElement(lineNumber) {
        // This is a heuristic - it assumes lines are rendered and 1-indexed.
        // In CodeMirror 6, meaningful lines have class .cm-line

        // Try to find via text content or index if simple
        const lines = document.querySelectorAll('.cm-line, .ace_line');
        return lines[lineNumber - 1];

        // Note: This is fragile for huge documents due to virtualization. 
        // A more robust method involves using CM API which we might need to expose via EditorController later.
    }

    highlightLine(element, message) {
        element.classList.add('el-error-line');

        // Add a tooltip/indicator
        const tooltip = document.createElement('div');
        tooltip.className = 'el-error-tooltip';
        tooltip.textContent = `Error: ${message}`;

        // Append to the line (or relatively positioned container)
        element.appendChild(tooltip);
    }
}

window.ErrorOverlayManager = ErrorOverlayManager;
