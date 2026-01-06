/**
 * EasyLeaf UI Manager
 * Handles all UI injection and updates
 */

export class UIManager {
    constructor(state) {
        this.state = state;
        this.elements = {};
    }

    // ===== TOP BAR =====
    injectTopBar() {
        // Remove existing if present
        document.querySelector('.el-topbar')?.remove();

        const topBar = document.createElement('div');
        topBar.className = 'el-topbar';
        topBar.innerHTML = `
      <div class="el-topbar__brand">
        <div class="el-topbar__logo">🌿</div>
        <span class="el-topbar__title">Beginner Mode</span>
      </div>
      <div class="el-toggle ${this.state.isBeginnerMode ? 'active' : ''}" 
           role="switch" 
           aria-checked="${this.state.isBeginnerMode}"
           id="el-beginner-toggle">
        <div class="el-toggle__knob"></div>
      </div>
      <div class="el-topbar__divider"></div>
      <div class="el-topbar__status" id="el-compile-status">
        <span class="el-badge el-badge--success">
          <svg class="el-badge__icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5z"/>
          </svg>
          Ready
        </span>
      </div>
    `;

        document.body.appendChild(topBar);
        this.elements.topBar = topBar;

        // Add toggle listener
        const toggle = topBar.querySelector('#el-beginner-toggle');
        toggle.addEventListener('click', () => {
            window.easyLeaf.toggleBeginnerMode();
        });
    }

    updateToggleState(enabled) {
        const toggle = document.querySelector('#el-beginner-toggle');
        if (toggle) {
            toggle.classList.toggle('active', enabled);
            toggle.setAttribute('aria-checked', enabled);
        }
    }

    showCompileStatus(status) {
        const statusEl = document.querySelector('#el-compile-status');
        if (!statusEl) return;

        const badges = {
            success: `
        <span class="el-badge el-badge--success">
          <svg class="el-badge__icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm3.78-9.72a.75.75 0 0 0-1.06-1.06L6.75 9.19 5.28 7.72a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l4.5-4.5z"/>
          </svg>
          Healthy
        </span>`,
            error: `
        <span class="el-badge el-badge--error el-clickable" id="el-error-badge">
          <svg class="el-badge__icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
          </svg>
          Error — click to fix
        </span>`,
            compiling: `
        <span class="el-badge el-badge--warning">
          <svg class="el-badge__icon el-spin" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM4.5 7.5a.5.5 0 0 0 0 1h5.293l-1.647 1.646a.5.5 0 0 0 .708.708l2.5-2.5a.5.5 0 0 0 0-.708l-2.5-2.5a.5.5 0 0 0-.708.708L9.793 7.5H4.5z"/>
          </svg>
          Compiling...
        </span>`
        };

        statusEl.innerHTML = badges[status] || badges.success;
    }

    // ===== FILE TREE OVERLAY =====
    injectFileTreeOverlay() {
        // This will overlay on top of Overleaf's file tree
        const fileTree = document.querySelector('.file-tree-list, [class*="file-tree"]');
        if (!fileTree) return;

        // Add our badges to files
        this.updateFileTreeBadges();
    }

    updateFileTreeBadges() {
        const files = document.querySelectorAll('.file-tree-item, [class*="file-tree"] li');

        files.forEach(file => {
            const fileName = file.textContent?.trim();
            if (!fileName) return;

            // Remove existing badge
            file.querySelector('.el-file-badge')?.remove();

            const badge = document.createElement('span');
            badge.className = 'el-file-badge';

            if (fileName.endsWith('.tex') && !fileName.includes('preamble')) {
                badge.className += ' el-badge el-badge--success';
                badge.textContent = 'Safe';
            } else if (fileName.endsWith('.sty') || fileName.endsWith('.cls')) {
                badge.className += ' el-badge el-badge--locked';
                badge.innerHTML = '🔒 Locked';
            }

            file.appendChild(badge);
        });
    }

    filterFileTree() {
        const files = document.querySelectorAll('.file-tree-item, [class*="file-tree"] li');

        files.forEach(file => {
            const fileName = file.textContent?.trim().toLowerCase();

            // Hide advanced files in beginner mode
            if (fileName?.endsWith('.sty') ||
                fileName?.endsWith('.cls') ||
                fileName?.endsWith('.bib') ||
                fileName?.includes('preamble')) {
                file.classList.add('el-hidden');
            }
        });
    }

    showAllFiles() {
        document.querySelectorAll('.el-hidden').forEach(el => {
            el.classList.remove('el-hidden');
        });
    }

    // ===== ERROR DRAWER =====
    showErrorDrawer(errorInfo, options = {}) {
        // Remove existing
        document.querySelector('.el-error-drawer')?.remove();

        const drawer = document.createElement('div');
        drawer.className = 'el-error-drawer';
        drawer.innerHTML = `
      <div class="el-error-drawer__header">
        <svg class="el-error-drawer__icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <h2 class="el-error-drawer__title">Compile Error: ${this.escapeHtml(errorInfo.message?.slice(0, 50) || 'Unknown Error')}</h2>
        <button class="el-error-drawer__close" id="el-close-drawer">×</button>
      </div>
      <div class="el-error-drawer__body">
        ${options.loading ? `
          <div class="el-loading">
            <div class="el-spinner"></div>
            <span>Analyzing error...</span>
          </div>
        ` : `
          <p class="el-error-drawer__message">
            ${this.escapeHtml(options.explanation?.explanation || 'Analyzing your error...')}
          </p>
          ${options.explanation?.learning_tip ? `
            <div class="el-hint">
              <span class="el-hint__icon">💡</span>
              ${this.escapeHtml(options.explanation.learning_tip)}
            </div>
          ` : ''}
        `}
      </div>
      <div class="el-error-drawer__footer">
        <div class="el-error-drawer__actions">
          <button class="el-btn el-btn--fix" id="el-auto-fix">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M7.5 5.6L5 7l1.4-2.5L5 2l2.5 1.4L10 2 8.6 4.5 10 7 7.5 5.6zm12 9.8L22 14l-1.4 2.5L22 19l-2.5-1.4L17 19l1.4-2.5L17 14l2.5 1.4zM22 2l-2.5 1.4L17 2l1.4 2.5L17 7l2.5-1.4L22 7l-1.4-2.5L22 2zM9.5 10.5l-4 4L3 12l-1 1 3.5 3.5 5-5-1-1z"/>
            </svg>
            Attempt Auto-Fix
          </button>
          <button class="el-btn el-btn--secondary" id="el-show-error">
            Show me where
          </button>
          <button class="el-btn el-btn--ghost" id="el-restore-btn">
            ↩ Restore last working
          </button>
        </div>
      </div>
    `;

        document.body.appendChild(drawer);
        this.elements.errorDrawer = drawer;

        // Add listeners
        drawer.querySelector('#el-close-drawer')?.addEventListener('click', () => {
            drawer.remove();
        });

        drawer.querySelector('#el-auto-fix')?.addEventListener('click', async () => {
            if (options.explanation?.suggested_fix) {
                await this.applyFix(options.explanation.suggested_fix);
            }
        });

        drawer.querySelector('#el-show-error')?.addEventListener('click', () => {
            this.highlightErrorLine(errorInfo.line);
        });

        drawer.querySelector('#el-restore-btn')?.addEventListener('click', async () => {
            await this.restoreLastGoodState();
        });

        // Also show undo FAB
        this.showUndoFAB();
    }

    hideErrorDrawer() {
        document.querySelector('.el-error-drawer')?.remove();
        document.querySelector('.el-undo-fab')?.remove();
    }

    showUndoFAB() {
        // Remove existing
        document.querySelector('.el-undo-fab')?.remove();

        const fab = document.createElement('button');
        fab.className = 'el-undo-fab';
        fab.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/>
      </svg>
    `;
        fab.title = 'Restore last working version';

        fab.addEventListener('click', () => this.restoreLastGoodState());

        document.body.appendChild(fab);
    }

    async restoreLastGoodState() {
        const response = await chrome.runtime.sendMessage({ type: 'RESTORE_GOOD_STATE' });

        if (response.content) {
            // Apply to editor
            window.easyLeaf.editor.setContent(response.content);
            this.showToast('Restored! Document reverted to last working version.');
            this.hideErrorDrawer();
        } else {
            this.showToast('No saved version available', 'error');
        }
    }

    async applyFix(fix) {
        // Apply the suggested fix
        this.showToast('Applying fix...', 'info');

        // TODO: Implement actual fix application
        // This would modify the editor content based on the diff

        this.showToast('Fix applied! Recompiling...', 'success');
    }

    highlightErrorLine(lineNumber) {
        if (!lineNumber) return;

        // Try to scroll to and highlight the error line
        const lines = document.querySelectorAll('.cm-line, .ace_line');
        const targetLine = lines[lineNumber - 1];

        if (targetLine) {
            targetLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetLine.classList.add('el-error-line');

            // Remove highlight after 3 seconds
            setTimeout(() => {
                targetLine.classList.remove('el-error-line');
            }, 3000);
        }
    }

    // ===== INLINE ACTIONS =====
    showInlineActions(lineElement) {
        // Remove existing
        document.querySelector('.el-inline-actions')?.remove();

        const actions = document.createElement('div');
        actions.className = 'el-inline-actions';
        actions.innerHTML = `
      <button class="el-inline-action" data-action="bullet">
        <span>+</span> Add Bullet
      </button>
      <button class="el-inline-action" data-action="skill">
        <span>+</span> Add Skill
      </button>
      <button class="el-inline-action el-inline-action--primary" data-action="experience">
        <span>+</span> Add Experience
      </button>
    `;

        lineElement.appendChild(actions);
    }

    // ===== TOOLTIPS =====
    addTooltips() {
        // Add tooltips to locked elements
        document.querySelectorAll('.el-locked-line').forEach(el => {
            el.setAttribute('title', 'This controls layout. You don\'t need to edit this.');
        });
    }

    removeTooltips() {
        document.querySelectorAll('[title]').forEach(el => {
            if (el.title.includes('layout')) {
                el.removeAttribute('title');
            }
        });
    }

    // ===== TOAST =====
    showToast(message, type = 'success') {
        // Remove existing
        document.querySelector('.el-toast')?.remove();

        const toast = document.createElement('div');
        toast.className = `el-toast el-toast--${type}`;
        toast.innerHTML = `
      <span class="el-toast__icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
      <span class="el-toast__message">${this.escapeHtml(message)}</span>
    `;

        document.body.appendChild(toast);

        // Auto-dismiss
        setTimeout(() => toast.remove(), 4000);
    }

    // ===== UTILITIES =====
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }
}
