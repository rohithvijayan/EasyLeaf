/**
 * EasyLeaf Error Bubble
 * Displays AI-powered error explanations and fixes in a floating bubble.
 */

class ErrorBubble {
    constructor(editorController) {
        this.editor = editorController;
        this.bubbleElement = null;
        this.currentError = null;
        this.currentAiResult = null;
    }

    /**
     * Show the error bubble near a specific line.
     * @param {number} lineNumber - 1-based line number
     * @param {Object} error - { message }
     * @param {Object} aiResult - { explanation, fix, fixed_code }
     */
    show(lineNumber, error, aiResult) {
        this.hide(); // Clear existing bubble

        this.currentError = { lineNumber, ...error };
        this.currentAiResult = aiResult;

        // Find line element for positioning
        const lineElement = this.getLineElement(lineNumber);
        if (!lineElement) {
            console.warn('Could not find line element for bubble');
            return;
        }

        // Create bubble
        this.bubbleElement = document.createElement('div');
        this.bubbleElement.className = 'el-error-bubble';
        this.bubbleElement.innerHTML = this._buildContent(aiResult);

        // Position near the line
        const rect = lineElement.getBoundingClientRect();
        this.bubbleElement.style.position = 'fixed';
        this.bubbleElement.style.top = `${rect.bottom + 8}px`;
        this.bubbleElement.style.left = `${rect.left + 20}px`;
        this.bubbleElement.style.zIndex = '10005';

        document.body.appendChild(this.bubbleElement);

        // Attach event listeners
        this._attachListeners();
    }

    _buildContent(aiResult) {
        return `
            <div class="el-error-bubble__header">
                <span class="el-error-bubble__icon">🤖</span>
                <span class="el-error-bubble__title">AI Error Explainer</span>
                <button class="el-error-bubble__close" aria-label="Close">&times;</button>
            </div>
            <div class="el-error-bubble__body">
                <p class="el-error-bubble__explanation">${this._escapeHtml(aiResult.explanation)}</p>
                <p class="el-error-bubble__fix"><strong>Fix:</strong> ${this._escapeHtml(aiResult.fix)}</p>
                <div class="el-error-bubble__code">
                    <code>${this._escapeHtml(aiResult.fixed_code)}</code>
                </div>
            </div>
            <div class="el-error-bubble__footer">
                <button class="el-btn el-btn--fix el-error-bubble__apply">
                    ✨ Apply Fix
                </button>
            </div>
        `;
    }

    _attachListeners() {
        if (!this.bubbleElement) return;

        // Close button
        const closeBtn = this.bubbleElement.querySelector('.el-error-bubble__close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }

        // Apply Fix button
        const applyBtn = this.bubbleElement.querySelector('.el-error-bubble__apply');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyFix());
        }

        // Click outside to close
        setTimeout(() => {
            document.addEventListener('click', this._outsideClickHandler.bind(this), { once: true });
        }, 100);
    }

    _outsideClickHandler(e) {
        if (this.bubbleElement && !this.bubbleElement.contains(e.target)) {
            this.hide();
        }
    }

    /**
     * Apply the AI-suggested fix to the editor (S8).
     */
    applyFix() {
        if (!this.currentError || !this.currentAiResult) {
            console.warn('No fix to apply');
            return;
        }

        const lineNumber = this.currentError.lineNumber;
        const fixedCode = this.currentAiResult.fixed_code;

        console.log(`🔧 Applying fix to line ${lineNumber}:`, fixedCode);

        // Get full content
        const content = this.editor.getContent();
        if (!content) {
            console.error('Could not get editor content');
            return;
        }

        const lines = content.split('\n');
        const targetIndex = lineNumber - 1;

        if (targetIndex < 0 || targetIndex >= lines.length) {
            console.error('Line number out of range');
            return;
        }

        // Replace the line
        lines[targetIndex] = fixedCode;
        const newContent = lines.join('\n');

        const success = this.editor.setContent(newContent);

        if (success) {
            // Show success feedback
            if (window.easyLeaf?.ui) {
                window.easyLeaf.ui.showToast('✅ Fix applied!', 'success');
            }
            this.hide();

            // Trigger re-compile after a short delay
            setTimeout(() => {
                window.easyLeaf?.triggerCompile?.();
            }, 500);
        } else {
            if (window.easyLeaf?.ui) {
                window.easyLeaf.ui.showToast('Failed to apply fix', 'error');
            }
        }
    }

    hide() {
        if (this.bubbleElement) {
            this.bubbleElement.remove();
            this.bubbleElement = null;
        }
        this.currentError = null;
        this.currentAiResult = null;
    }

    getLineElement(lineNumber) {
        const lines = document.querySelectorAll('.cm-line, .ace_line');
        return lines[lineNumber - 1];
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

window.ErrorBubble = ErrorBubble;
