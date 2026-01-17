/**
 * EasyLeaf Error List Sidebar
 * Displays all detected errors in a sidebar with AI explanations and a "Fix All" button.
 */

class ErrorListSidebar {
    constructor(editorController) {
        this.editor = editorController;
        this.sidebarElement = null;
        this.currentErrors = [];
        this.currentAiResults = [];
        this.isEducationalModeOpen = false;
        this.isVisible = false;
    }

    /**
     * Show the sidebar with a list of errors.
     * @param {Array} errors - Array of error objects { line, message, file, context }
     * @param {Array} aiResults - Array of AI results corresponding to errors
     */
    show(errors, aiResults) {
        this.currentErrors = errors;
        this.currentAiResults = aiResults;
        this.isVisible = true;

        // Remove existing sidebar if any
        if (this.sidebarElement) {
            this.sidebarElement.remove();
        }

        // Create sidebar container
        this.sidebarElement = document.createElement('div');
        this.sidebarElement.className = 'el-error-sidebar open';
        this.sidebarElement.innerHTML = `
            <div class="el-error-sidebar__header">
                <span class="el-error-sidebar__icon">🤖</span>
                <span class="el-error-sidebar__title">
                    AI Error Assistant 
                    <span class="el-badge el-badge--error">${errors.length} Errors</span>
                </span>
                <button class="el-error-sidebar__close" aria-label="Close">&times;</button>
            </div>
            
            <div class="el-error-sidebar__body">
                ${this._buildErrorCards(errors, aiResults)}
            </div>

            <div class="el-error-sidebar__footer">
                <button class="el-btn el-btn--fix el-error-sidebar__fix-all">
                    ✨ One Click Fix All
                </button>
            </div>
        `;

        document.body.appendChild(this.sidebarElement);
        this._attachListeners();
    }

    _buildErrorCards(errors, aiResults) {
        if (!errors || errors.length === 0) {
            return '<div class="el-empty-state">No errors detected via AI.</div>';
        }

        return errors.map((error, index) => {
            const result = aiResults[index];
            if (!result) return ''; // Skip if analysis failed

            return `
                <div class="el-error-card" data-index="${index}">
                    <div class="el-error-card__header">
                        <span class="el-badge el-badge--error">Line ${error.line || '?'}</span>
                        <span class="el-error-card__file">${error.file || ''}</span>
                    </div>
                    
                    <div class="el-error-card__message">${this._escapeHtml(error.message)}</div>
                    
                    <div class="el-error-card__ai-content">
                        <p class="el-error-card__explanation">${this._escapeHtml(result.explanation)}</p>
                        
                        <div class="el-error-card__fix-preview">
                            <div class="el-error-card__code-label">Suggested Fix:</div>
                            <code>${this._escapeHtml(result.fixed_code)}</code>
                        </div>
                    </div>

                    <button class="el-btn el-btn--secondary el-btn--sm el-error-card__apply-single" data-index="${index}">
                        Apply This Fix
                    </button>
                </div>
            `;
        }).join('');
    }

    _attachListeners() {
        if (!this.sidebarElement) return;

        // Close button
        const closeBtn = this.sidebarElement.querySelector('.el-error-sidebar__close');
        closeBtn?.addEventListener('click', () => {
            console.log('👆 Sidebar Close Clicked');
            this.hide();
        });

        // Fix All button
        const fixAllBtn = this.sidebarElement.querySelector('.el-error-sidebar__fix-all');
        fixAllBtn?.addEventListener('click', () => {
            console.log('👆 Fix All Clicked');
            this.applyAllFixes();
        });

        // Individual Apply buttons
        this.sidebarElement.querySelectorAll('.el-error-card__apply-single').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                console.log('👆 Single Fix Clicked, index:', index);
                this.applySingleFix(index);
            });
        });
    }

    hide() {
        if (this.sidebarElement) {
            this.sidebarElement.classList.remove('open');
            setTimeout(() => {
                this.sidebarElement.remove();
                this.sidebarElement = null;
            }, 300); // Wait for transition
        }
        this.isVisible = false;
    }

    /**
     * Apply all fixes sequentially from bottom to top to preserve line numbers.
     */
    async applyAllFixes() {
        console.log('🛠️ applyAllFixes started');
        console.log('📊 Current Errors:', this.currentErrors);

        if (!this.currentErrors || this.currentErrors.length === 0) {
            console.warn('⚠️ No errors to fix!');
            return;
        }

        // Sort fixes by line number descending
        const fixes = this.currentErrors
            .map((error, index) => ({
                line: error.line,
                code: this.currentAiResults[index]?.fixed_code,
                index
            }))
            .filter(f => f.line && f.code)
            .sort((a, b) => b.line - a.line);

        console.log('📉 Calculated Fixes to Apply:', fixes);

        if (fixes.length === 0) {
            console.warn('⚠️ No valid fixes found after filtering (missing line or code?)');
            console.log('Check AI Results:', this.currentAiResults);
            return;
        }

        let appliedCount = 0;

        // Apply fixes
        const content = this.editor.getContent();
        if (!content) {
            console.error('❌ Could not get editor content');
            return;
        }

        const lines = content.split('\n');

        for (const fix of fixes) {
            const lineIdx = fix.line - 1;
            if (lineIdx >= 0 && lineIdx < lines.length) {
                // Check if line content roughly matches context to be safe?
                // For now, simpler is better for MVP sidebar
                lines[lineIdx] = fix.code;
                appliedCount++;

                // Mark card as applied visually
                const card = this.sidebarElement.querySelector(`.el-error-card[data-index="${fix.index}"]`);
                if (card) card.classList.add('applied');
            }
        }

        if (appliedCount > 0) {
            console.log(`✨ Applying ${appliedCount} fixes`);
            // Update editor
            const success = this.editor.setContent(lines.join('\n'));

            if (success) {
                this._showToast(`✨ Applied ${appliedCount} fixes! Recompiling...`, 'success');
                setTimeout(() => {
                    window.easyLeaf?.triggerCompile?.();
                    this.hide();
                }, 1000);
            } else {
                console.error('❌ Failed to set editor content');
            }
        }
    }

    applySingleFix(index) {
        console.log('🛠️ applySingleFix started for index', index);
        const error = this.currentErrors[index];
        const result = this.currentAiResults[index];

        if (!error || !result) {
            console.warn('❌ Missing error or result for index', index);
            return;
        }

        // Reuse single fix logic
        // We handle getting content fresh here as well
        const content = this.editor.getContent();
        if (!content) {
            console.error('❌ Could not get editor content');
            return;
        }

        const lines = content.split('\n');
        const lineIdx = error.line - 1;

        if (lineIdx >= 0 && lineIdx < lines.length) {
            lines[lineIdx] = result.fixed_code;
            if (this.editor.setContent(lines.join('\n'))) {
                this._showToast('Fix applied!', 'success');

                // Mark card as applied
                const card = this.sidebarElement.querySelector(`.el-error-card[data-index="${index}"]`);
                if (card) {
                    card.classList.add('applied');
                    const btn = card.querySelector('button');
                    if (btn) {
                        btn.disabled = true;
                        btn.textContent = 'Applied';
                    }
                }
            } else {
                console.error('❌ Failed to set content for single fix');
            }
        } else {
            console.error('❌ Line number out of bounds:', lineIdx, lines.length);
        }
    }

    _showToast(msg, type) {
        if (window.easyLeaf?.ui) {
            window.easyLeaf.ui.showToast(msg, type);
        }
    }

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}

window.ErrorListSidebar = ErrorListSidebar;
