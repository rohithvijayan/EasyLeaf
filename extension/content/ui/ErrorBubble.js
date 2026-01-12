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
        this.isEducationalModeOpen = false;
    }

    /**
     * Show a loading state while waiting for AI response.
     * @param {number} lineNumber - 1-based line number
     */
    showLoading(lineNumber) {
        this.hide();

        const lineElement = this.getLineElement(lineNumber);
        if (!lineElement) return;

        this.bubbleElement = document.createElement('div');
        this.bubbleElement.className = 'el-error-bubble el-error-bubble--loading';
        this.bubbleElement.innerHTML = `
            <div class="el-error-bubble__header">
                <span class="el-error-bubble__icon">🤖</span>
                <span class="el-error-bubble__title">AI Error Explainer</span>
                <button class="el-error-bubble__close" aria-label="Close">&times;</button>
            </div>
            <div class="el-error-bubble__body">
                <div class="el-loading">
                    <div class="el-spinner"></div>
                    <span>Analyzing error...</span>
                </div>
            </div>
        `;

        const rect = lineElement.getBoundingClientRect();
        this.bubbleElement.style.position = 'fixed';
        this.bubbleElement.style.top = `${rect.bottom + 8}px`;
        this.bubbleElement.style.left = `${rect.left + 20}px`;
        this.bubbleElement.style.zIndex = '10005';

        document.body.appendChild(this.bubbleElement);

        // Close button listener
        const closeBtn = this.bubbleElement.querySelector('.el-error-bubble__close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
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
        this.isEducationalModeOpen = false;

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
        const educationalContent = this._getEducationalNote(aiResult);

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
                ${educationalContent ? `
                <div class="el-error-bubble__educational">
                    <button class="el-error-bubble__why-btn">
                        <span class="el-error-bubble__why-icon">💡</span>
                        Why did this happen?
                    </button>
                    <div class="el-error-bubble__why-content" style="display: none;">
                        <p>${this._escapeHtml(educationalContent)}</p>
                    </div>
                </div>
                ` : ''}
            </div>
            <div class="el-error-bubble__footer">
                <button class="el-btn el-btn--fix el-error-bubble__apply">
                    ✨ Apply Fix
                </button>
            </div>
        `;
    }

    _getEducationalNote(aiResult) {
        // Generate educational content based on error type
        const explanation = aiResult.explanation?.toLowerCase() || '';

        if (explanation.includes('misspell') || explanation.includes('typo')) {
            return "LaTeX commands must be spelled exactly right. Unlike some programming languages, LaTeX doesn't have autocorrection.";
        }
        if (explanation.includes('brace') || explanation.includes('{') || explanation.includes('}')) {
            return "Every opening brace { must have a matching closing brace }. Think of them like parentheses - they always come in pairs!";
        }
        if (explanation.includes('environment')) {
            return "Environments in LaTeX start with \\begin{name} and must end with \\end{name}. The names must match exactly!";
        }
        if (explanation.includes('package')) {
            return "Packages add extra features to LaTeX. If you use a command from a package, you need to include it in your preamble with \\usepackage{packagename}.";
        }

        return null; // No educational content for unknown errors
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

        // Educational "Why?" toggle
        const whyBtn = this.bubbleElement.querySelector('.el-error-bubble__why-btn');
        const whyContent = this.bubbleElement.querySelector('.el-error-bubble__why-content');
        if (whyBtn && whyContent) {
            whyBtn.addEventListener('click', () => {
                this.isEducationalModeOpen = !this.isEducationalModeOpen;
                whyContent.style.display = this.isEducationalModeOpen ? 'block' : 'none';
                whyBtn.classList.toggle('active', this.isEducationalModeOpen);
            });
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

