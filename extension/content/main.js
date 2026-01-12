/**
 * EasyLeaf Content Script - Main Entry Point
 * Injected into Overleaf project pages
 * 
 * Features:
 * - Persistent line locking with MutationObserver
 * - Smart compile status detection
 * - Snippet insertion
 */

(function () {
    'use strict';

    // ===== STATE MANAGER =====
    class StateManager {
        constructor() {
            this.isBeginnerMode = false;
            this.lastGoodState = null;
            this.currentTemplate = null;
            this.hasError = false;
        }

        async load() {
            try {
                const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
                this.isBeginnerMode = state?.isBeginnerMode || false;
                this.lastGoodState = state?.lastGoodState || null;
                console.log('🌿 State loaded:', { isBeginnerMode: this.isBeginnerMode });
            } catch (error) {
                console.error('Failed to load state:', error);
            }
        }

        async save() {
            await chrome.runtime.sendMessage({
                type: 'SET_BEGINNER_MODE',
                payload: { enabled: this.isBeginnerMode }
            });
        }
    }

    // ===== EDITOR CONTROLLER =====
    class EditorController {
        constructor() {
            this.lockedLines = new Set();
            this.lockedPatterns = [
                /^\\documentclass/,
                /^\\begin\{document\}/,
                /^\\end\{document\}/,
                /^\\usepackage/,
                /^\\newcommand/,
                /^\\renewcommand/,
                /^\\titleformat/,
                /^\\setlength/,
                /^\\geometry/,
                /^\\hypersetup/,
                /^\\pagestyle/,
                /^\\input\{/,
                /^\\include\{/,
                /^%.*-{5,}/,  // Section comment markers
            ];
            this.keydownHandler = null;
            this.clickHandler = null;
            this.mutationObserver = null;
            this.isLockingEnabled = false;
            this.reapplyTimeout = null;
        }

        getContent() {
            try {
                const cmEditor = document.querySelector('.cm-editor');
                if (cmEditor) {
                    const cmContent = cmEditor.querySelector('.cm-content');
                    if (cmContent) {
                        return cmContent.textContent || '';
                    }
                }
                const lines = document.querySelectorAll('.cm-line, .ace_line');
                return Array.from(lines).map(l => l.textContent).join('\n');
            } catch (error) {
                console.error('Failed to get editor content:', error);
                return null;
            }
        }

        // Lock structural elements with persistent monitoring
        lockStructuralElements() {
            this.isLockingEnabled = true;
            this.applyLocks();
            this.setupKeyboardBlocking();
            this.setupClickBlocking();
            this.setupMutationObserver();
            console.log(`🔒 Locked ${this.lockedLines.size} lines with persistent monitoring`);
        }

        applyLocks() {
            const lines = document.querySelectorAll('.cm-line, .ace_line');
            this.lockedLines.clear();

            lines.forEach((line, index) => {
                const text = line.textContent?.trim() || '';
                let shouldLock = false;

                // Check against patterns
                for (const pattern of this.lockedPatterns) {
                    if (pattern.test(text)) {
                        shouldLock = true;
                        break;
                    }
                }

                // Also lock empty lines in preamble (before \begin{document})
                const content = this.getContent();
                const beginDocIndex = content?.indexOf('\\begin{document}');
                if (beginDocIndex !== -1) {
                    const linesBefore = content.substring(0, beginDocIndex).split('\n').length;
                    if (index < linesBefore - 1) {
                        shouldLock = true;
                    }
                }

                if (shouldLock) {
                    if (!line.classList.contains('el-locked-line')) {
                        line.classList.add('el-locked-line');
                        line.setAttribute('data-el-locked', 'true');
                    }
                    this.lockedLines.add(index);
                } else {
                    // Remove lock if it shouldn't be locked
                    if (line.classList.contains('el-locked-line')) {
                        line.classList.remove('el-locked-line');
                        line.removeAttribute('data-el-locked');
                    }
                }
            });
        }

        setupMutationObserver() {
            // Stop existing observer
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
            }

            const editorContainer = document.querySelector('.cm-content, .ace_editor');
            if (!editorContainer) return;

            this.mutationObserver = new MutationObserver((mutations) => {
                if (!this.isLockingEnabled) return;

                // Re-apply locks after a short delay to batch updates
                clearTimeout(this.reapplyTimeout);
                this.reapplyTimeout = setTimeout(() => {
                    this.applyLocks();
                }, 100);
            });

            this.mutationObserver.observe(editorContainer, {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: ['class']
            });
        }

        setupKeyboardBlocking() {
            if (this.keydownHandler) {
                document.removeEventListener('keydown', this.keydownHandler, true);
            }

            this.keydownHandler = (e) => {
                if (!window.easyLeaf?.state?.isBeginnerMode) return;

                const selection = window.getSelection();
                if (!selection || !selection.anchorNode) return;

                const lineElement = selection.anchorNode.closest?.('.cm-line, .ace_line')
                    || selection.anchorNode.parentElement?.closest?.('.cm-line, .ace_line');

                if (lineElement && lineElement.hasAttribute('data-el-locked')) {
                    const allowedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Escape'];

                    if (!allowedKeys.includes(e.key) && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        window.easyLeaf?.ui?.showToast('🔒 This line is protected in Beginner Mode', 'warning');
                        return false;
                    }

                    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                        e.preventDefault();
                        e.stopPropagation();
                        window.easyLeaf?.ui?.showToast('🔒 Cannot paste here - line is protected', 'warning');
                        return false;
                    }
                }
            };

            document.addEventListener('keydown', this.keydownHandler, true);
        }

        setupClickBlocking() {
            if (this.clickHandler) {
                document.removeEventListener('click', this.clickHandler, true);
            }

            this.clickHandler = (e) => {
                if (!window.easyLeaf?.state?.isBeginnerMode) return;

                const lineElement = e.target.closest?.('.cm-line, .ace_line');
                if (lineElement && lineElement.hasAttribute('data-el-locked')) {
                    lineElement.classList.add('el-locked-flash');
                    setTimeout(() => lineElement.classList.remove('el-locked-flash'), 300);
                }
            };

            document.addEventListener('click', this.clickHandler, true);
        }

        unlockAll() {
            this.isLockingEnabled = false;

            // Stop mutation observer
            if (this.mutationObserver) {
                this.mutationObserver.disconnect();
                this.mutationObserver = null;
            }

            // Remove visual indicators
            document.querySelectorAll('.el-locked-line').forEach(line => {
                line.classList.remove('el-locked-line');
                line.removeAttribute('data-el-locked');
            });

            // Remove event handlers
            if (this.keydownHandler) {
                document.removeEventListener('keydown', this.keydownHandler, true);
                this.keydownHandler = null;
            }
            if (this.clickHandler) {
                document.removeEventListener('click', this.clickHandler, true);
                this.clickHandler = null;
            }

            this.lockedLines.clear();
            console.log('🔓 All lines unlocked');
        }

        insertAtCursor(text) {
            console.log('📝 Attempting to insert text:', text.substring(0, 50) + '...');

            try {
                const selection = window.getSelection();
                if (selection && selection.anchorNode) {
                    const lineElement = selection.anchorNode.closest?.('.cm-line, .ace_line')
                        || selection.anchorNode.parentElement?.closest?.('.cm-line, .ace_line');

                    if (lineElement && lineElement.hasAttribute('data-el-locked') && window.easyLeaf?.state?.isBeginnerMode) {
                        return this.insertViaClipboard(text);
                    }
                }

                const cmEditor = document.querySelector('.cm-editor');
                if (cmEditor && cmEditor.cmView) {
                    const view = cmEditor.cmView;
                    const { state } = view;
                    const pos = state.selection.main.head;
                    view.dispatch({
                        changes: { from: pos, insert: '\n' + text + '\n' }
                    });
                    console.log('✅ Inserted via CodeMirror 6 view');
                    return true;
                }

                document.execCommand('insertText', false, '\n' + text + '\n');
                console.log('✅ Inserted via execCommand');
                return true;

            } catch (error) {
                console.error('Failed to insert text:', error);
                return this.insertViaClipboard(text);
            }
        }

        async insertViaClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);
                console.log('📋 Text copied to clipboard');
                return 'clipboard';
            } catch (error) {
                console.error('Clipboard fallback failed:', error);
                return false;
            }
        }

        replaceSelection(text) {
            console.log('📝 Replacing selection with:', text.substring(0, 50) + '...');

            try {
                // Try CodeMirror 6 approach first
                const cmEditor = document.querySelector('.cm-editor');
                if (cmEditor && cmEditor.cmView) {
                    const view = cmEditor.cmView;
                    const { state } = view;
                    const ranges = state.selection.ranges;

                    if (ranges.length > 0) {
                        view.dispatch({
                            changes: ranges.map(range => ({
                                from: range.from,
                                to: range.to,
                                insert: text
                            }))
                        });
                        console.log('✅ Replaced via CodeMirror 6 view');
                        return true;
                    }
                }

                // Fallback to execCommand
                document.execCommand('insertText', false, text);
                console.log('✅ Replaced via execCommand');
                return true;

            } catch (error) {
                console.error('Failed to replace text:', error);
                return this.insertViaClipboard(text);
            }
        }
    }

    // ===== COMPILE STATUS DETECTOR =====
    class CompileStatusDetector {
        constructor(ui) {
            this.ui = ui;
            this.observer = null;
            this.lastStatus = 'unknown';
            this.checkInterval = null;
            this.parser = window.LogParser ? new window.LogParser() : null;
        }

        start() {
            // Initial check after delay
            setTimeout(() => this.checkCompileStatus(), 2000);

            // Periodic check every 3 seconds
            this.checkInterval = setInterval(() => this.checkCompileStatus(), 3000);
        }

        checkCompileStatus() {
            let newStatus = 'ready';

            // Check for compiling state FIRST
            const recompileBtn = document.querySelector('[class*="recompile"], button[aria-label*="Recompile"]');
            if (recompileBtn) {
                const btnText = recompileBtn.textContent?.toLowerCase() || '';
                const btnClasses = recompileBtn.className?.toLowerCase() || '';

                if (btnText.includes('compiling') || btnClasses.includes('loading') || btnClasses.includes('spinning')) {
                    newStatus = 'compiling';
                    this.updateStatus(newStatus);
                    return;
                }
            }

            // Check for ACTUAL errors in logs (be more specific)
            const logsPane = document.querySelector('.logs-pane, [class*="logs"]');
            if (logsPane && logsPane.offsetParent !== null) {
                const logText = logsPane.textContent || '';

                // Look for specific error patterns
                const hasRealError = /\d+\s+error/i.test(logText) && !/0\s+error/i.test(logText);
                const hasErrorLine = /^!.*error/im.test(logText);

                if (hasRealError || hasErrorLine) {
                    newStatus = 'error';
                    this.updateStatus(newStatus);

                    if (this.parser) {
                        const error = this.parser.parse(logText);
                        if (error) {
                            console.log('🌿 Extracted Error:', error);
                            window.dispatchEvent(new CustomEvent('el-compile-error', {
                                detail: error
                            }));
                        }
                    }
                    return;
                }
            }

            // Check for visible error entries
            const errorEntries = document.querySelectorAll('.log-entry-error');
            let hasVisibleError = false;
            for (const entry of errorEntries) {
                if (entry.offsetParent !== null && entry.textContent.trim().length > 0) {
                    hasVisibleError = true;
                    break;
                }
            }

            if (hasVisibleError) {
                newStatus = 'error';
            }

            this.updateStatus(newStatus);
        }

        updateStatus(newStatus) {
            if (newStatus !== this.lastStatus) {
                this.lastStatus = newStatus;
                this.ui.updateCompileStatus(newStatus);

                if (window.easyLeaf?.state) {
                    window.easyLeaf.state.hasError = (newStatus === 'error');
                }
            }
        }

        stop() {
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
        }
    }

    // ===== UI MANAGER =====
    class UIManager {
        constructor(state) {
            this.state = state;
            this.toastTimeout = null;
        }

        injectTopBar() {
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
          <span class="el-badge el-badge--neutral">
            <span class="el-badge__dot"></span>
            Checking...
          </span>
        </div>
      `;

            document.body.appendChild(topBar);

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

        updateCompileStatus(status) {
            const statusEl = document.querySelector('#el-compile-status');
            if (!statusEl) return;

            const badges = {
                ready: `
          <span class="el-badge el-badge--success">
            <span class="el-badge__dot"></span>
            Healthy
          </span>`,
                error: `
          <span class="el-badge el-badge--error el-clickable" id="el-error-badge">
            <span class="el-badge__dot el-pulse"></span>
            Error Detected
          </span>`,
                compiling: `
          <span class="el-badge el-badge--warning">
            <span class="el-badge__dot el-spin"></span>
            Compiling...
          </span>`,
                unknown: `
          <span class="el-badge el-badge--neutral">
            <span class="el-badge__dot"></span>
            Checking...
          </span>`
            };

            statusEl.innerHTML = badges[status] || badges.unknown;

            if (status === 'error') {
                const errorBadge = statusEl.querySelector('#el-error-badge');
                if (errorBadge) {
                    errorBadge.addEventListener('click', () => {
                        const logsBtn = document.querySelector('[class*="logs-toggle"], [aria-label*="logs"]');
                        if (logsBtn) logsBtn.click();
                    });
                }
            }
        }

        showToast(message, type = 'success') {
            if (this.toastTimeout) {
                clearTimeout(this.toastTimeout);
            }

            document.querySelector('.el-toast')?.remove();

            const icons = {
                success: '✓',
                error: '✗',
                warning: '🔒',
                info: 'ℹ'
            };

            const toast = document.createElement('div');
            toast.className = `el-toast el-toast--${type}`;
            toast.innerHTML = `
        <span class="el-toast__icon">${icons[type] || icons.info}</span>
        <span class="el-toast__message">${this.escapeHtml(message)}</span>
      `;

            document.body.appendChild(toast);
            this.toastTimeout = setTimeout(() => toast.remove(), 3000);
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text || '';
            return div.innerHTML;
        }
    }

    // ===== MAIN EASYLEAF CLASS =====
    class EasyLeaf {
        constructor() {
            this.state = new StateManager();
            this.editor = new EditorController();
            this.errorOverlay = window.ErrorOverlayManager ? new window.ErrorOverlayManager(this.editor) : null;
            this.errorBubble = window.ErrorBubble ? new window.ErrorBubble(this.editor) : null;
            this.apiClient = window.ApiClient ? new window.ApiClient() : null;
            this.ui = null;
            this.statusDetector = null;
            this.isInitialized = false;
        }

        async init() {
            console.log('🌿 EasyLeaf initializing...');

            try {
                await this.waitForEditor();
                await this.state.load();

                this.ui = new UIManager(this.state);
                this.ui.injectTopBar();

                this.statusDetector = new CompileStatusDetector(this.ui);
                this.statusDetector.start();

                this.statusDetector.start();

                this.setupMessageListener();
                this.setupErrorListeners();

                if (this.state.isBeginnerMode) {
                    this.enableBeginnerMode();
                }

                this.isInitialized = true;
                console.log('🌿 EasyLeaf ready!');

            } catch (error) {
                console.error('EasyLeaf initialization failed:', error);
            }
        }

        async waitForEditor() {
            return new Promise((resolve, reject) => {
                let attempts = 0;
                const maxAttempts = 50;

                const check = () => {
                    attempts++;
                    const editor = document.querySelector('.cm-editor, .ace_editor, .cm-content');

                    if (editor) {
                        console.log('✅ Editor found');
                        resolve(editor);
                        return;
                    }

                    if (attempts >= maxAttempts) {
                        reject(new Error('Editor not found'));
                        return;
                    }

                    setTimeout(check, 200);
                };

                check();
            });
        }

        setupMessageListener() {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                console.log('📨 Content script received message:', message.type);

                switch (message.type) {
                    case 'INSERT_SNIPPET':
                        const result = this.editor.insertAtCursor(message.payload.latex);
                        if (result === 'clipboard') {
                            this.ui.showToast('Copied to clipboard! Press Ctrl+V to paste in an editable area.', 'info');
                        } else if (result) {
                            this.ui.showToast('Section inserted!', 'success');
                        } else {
                            this.ui.showToast('Failed to insert. Try pasting manually.', 'error');
                        }
                        sendResponse({ success: !!result });
                        break;

                    case 'APPLY_CUSTOMIZATION':
                        this.applyCustomization(message.payload);
                        sendResponse({ success: true });
                        break;

                    case 'TRIGGER_COMPILE':
                        this.triggerCompile();
                        sendResponse({ success: true });
                        break;

                    case 'SET_BEGINNER_MODE':
                        if (message.payload.enabled) {
                            this.enableBeginnerMode();
                        } else {
                            this.disableBeginnerMode();
                        }
                        sendResponse({ success: true });
                        break;
                    case 'TRANSFORM_TEXT':
                        try {
                            const result = this.transformSelection(message.payload.type);
                            sendResponse({ success: true, result });
                        } catch (e) {
                            console.error('Transform error:', e);
                            sendResponse({ success: false, error: e.toString() });
                        }
                        break;
                }

                return true;
            });
        }

        setupErrorListeners() {
            window.addEventListener('el-compile-error', async (e) => {
                const error = e.detail;
                if (this.errorOverlay && error.line) {
                    console.log('⚡ Showing error overlay on line', error.line);
                    this.errorOverlay.showError(error.line, error.message);

                    // Context Extraction (S3)
                    const context = this.editor.getContext(error.line);
                    if (context) {
                        console.log('🧠 Context Extracted:', {
                            line: error.line,
                            message: error.message,
                            context
                        });

                        // S6: Call Backend API
                        if (this.apiClient) {
                            console.log('🌐 Calling AI backend...');

                            // Show loading state (Phase 4)
                            if (this.errorBubble) {
                                this.errorBubble.showLoading(error.line);
                            }

                            const aiResult = await this.apiClient.explainError({
                                message: error.message,
                                line: error.line,
                                lineContent: context.lineContent,
                                context: context
                            });
                            console.log('🤖 AI Response:', aiResult);

                            // Store result for later use (e.g., in bubble UI)
                            window.easyLeaf.lastAiResult = aiResult;

                            // S7: Show Error Bubble with AI result
                            if (this.errorBubble) {
                                this.errorBubble.show(error.line, error, aiResult);
                            }

                            // Dispatch event for UI to pick up
                            window.dispatchEvent(new CustomEvent('el-ai-response', {
                                detail: { error, aiResult }
                            }));
                        }
                    }
                }
            });

            // Clear errors on new compile or edit
            const observer = new MutationObserver(() => {
                const logsPane = document.querySelector('.logs-pane, [class*="logs"]');
                if (logsPane && !logsPane.textContent.includes('error')) {
                    // If error gone from logs, clear overlay
                    // Note: This is a bit aggressive, might clear unrelated errors. 
                    // Ideally we listen to "compile success" event.
                }
            });

            // For now, let's keep it simple: Clear when user edits
            document.addEventListener('input', () => {
                if (this.errorOverlay) this.errorOverlay.clear();
            }, { capture: true });
        }

        transformSelection(type) {
            const selection = window.getSelection();
            const text = selection.toString();

            if (!text) {
                this.ui.showToast('Select text to transform', 'info');
                return;
            }

            let newText = text;
            switch (type) {
                case 'uppercase':
                    newText = text.toUpperCase();
                    break;
                case 'lowercase':
                    newText = text.toLowerCase();
                    break;
                case 'titlecase':
                    newText = text.replace(/\w\S*/g, (txt) => {
                        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
                    });
                    break;
            }

            this.editor.replaceSelection(newText);
        }

        async toggleBeginnerMode() {
            const newState = !this.state.isBeginnerMode;
            this.state.isBeginnerMode = newState;

            await chrome.runtime.sendMessage({
                type: 'SET_BEGINNER_MODE',
                payload: { enabled: newState }
            });

            if (newState) {
                this.enableBeginnerMode();
                this.ui.showToast('🔒 Beginner Mode ON - Preamble is now protected!', 'success');
            } else {
                this.disableBeginnerMode();
                this.ui.showToast('🔓 Beginner Mode OFF - Full editing enabled', 'info');
            }
        }

        enableBeginnerMode() {
            console.log('🟢 Enabling Beginner Mode with persistent locking');
            this.editor.lockStructuralElements();
            this.ui.updateToggleState(true);
        }

        disableBeginnerMode() {
            console.log('⚪ Disabling Beginner Mode');
            this.editor.unlockAll();
            this.ui.updateToggleState(false);
        }

        applyCustomization(payload) {
            console.log('🎨 Applying customization:', payload);
            this.ui.showToast(`${payload.type} updated!`, 'success');
        }

        triggerCompile() {
            console.log('🔄 Triggering compile...');

            // Try multiple robust selectors
            const selectors = [
                '.btn-recompile',                   // Standard class
                'button[aria-label="Recompile"]',   // Accessibility label
                'button[tooltip="Recompile"]',      // Tooltip attribute
                '.toolbar-pdf-left .btn-primary'    // Structural location
            ];

            let compileBtn = null;
            for (const selector of selectors) {
                const candidates = document.querySelectorAll(selector);
                for (const btn of candidates) {
                    // Ensure it's visible
                    if (btn.offsetParent !== null) {
                        compileBtn = btn;
                        break;
                    }
                }
                if (compileBtn) break;
            }

            if (compileBtn) {
                console.log('✅ Found compile button:', compileBtn);

                // Dispatch full mouse event sequence for React/complex handlers
                const events = ['mousedown', 'mouseup', 'click'];
                events.forEach(eventType => {
                    const event = new MouseEvent(eventType, {
                        view: window,
                        bubbles: true,
                        cancelable: true,
                        buttons: 1
                    });
                    compileBtn.dispatchEvent(event);
                });

                this.ui.showToast('Compiling...', 'info');
            } else {
                console.error('❌ Compile button not found');
                this.ui.showToast('Could not find compile button. Is the PDF viewer open?', 'error');
            }
        }
    }

    // ===== INITIALIZE =====
    const easyLeaf = new EasyLeaf();
    window.easyLeaf = easyLeaf;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => easyLeaf.init());
    } else {
        easyLeaf.init();
    }

})();
