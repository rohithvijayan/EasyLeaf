/**
 * EasyLeaf Content Script - Main Entry Point
 * Injected into Overleaf project pages
 */

// Core modules
import { UIManager } from './ui/UIManager.js';
import { ErrorHandler } from './handlers/ErrorHandler.js';
import { EditorController } from './controllers/EditorController.js';
import { StateManager } from './state/StateManager.js';

class EasyLeaf {
    constructor() {
        this.ui = null;
        this.errorHandler = null;
        this.editor = null;
        this.state = null;
        this.isInitialized = false;
    }

    async init() {
        console.log('🌿 EasyLeaf initializing...');

        try {
            // Wait for Overleaf editor to be ready
            await this.waitForEditor();

            // Initialize modules
            this.state = new StateManager();
            await this.state.load();

            this.ui = new UIManager(this.state);
            this.errorHandler = new ErrorHandler(this.state);
            this.editor = new EditorController(this.state);

            // Setup UI
            this.ui.injectTopBar();
            this.ui.injectFileTreeOverlay();

            // Setup observers
            this.setupCompileObserver();

            // Apply initial state
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

                // Look for CodeMirror 6 or Ace editor
                const editor = document.querySelector('.cm-editor, .ace_editor');

                if (editor) {
                    resolve(editor);
                    return;
                }

                if (attempts >= maxAttempts) {
                    reject(new Error('Editor not found after maximum attempts'));
                    return;
                }

                setTimeout(check, 200);
            };

            check();
        });
    }

    setupCompileObserver() {
        // Watch for compile button clicks and log panel changes
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                // Check for compile status changes
                if (this.isCompileSuccess(mutation)) {
                    this.handleCompileSuccess();
                } else if (this.isCompileError(mutation)) {
                    this.handleCompileError();
                }
            }
        });

        // Observe the PDF container and logs area
        const pdfContainer = document.querySelector('[class*="pdf-viewer"], .pdf-viewer');
        const logsContainer = document.querySelector('[class*="logs"], .logs-pane');

        if (pdfContainer) {
            observer.observe(pdfContainer, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ['class']
            });
        }

        if (logsContainer) {
            observer.observe(logsContainer, {
                subtree: true,
                childList: true
            });
        }
    }

    isCompileSuccess(mutation) {
        // Check for successful compile indicators
        const target = mutation.target;
        if (target.classList?.contains('pdf-viewer') ||
            target.querySelector?.('.pdf-page')) {
            return true;
        }
        return false;
    }

    isCompileError(mutation) {
        // Check for error indicators in logs
        const target = mutation.target;
        const errorIndicators = [
            '.log-entry-error',
            '[class*="error"]',
            '.alert-danger'
        ];

        for (const selector of errorIndicators) {
            if (target.matches?.(selector) || target.querySelector?.(selector)) {
                return true;
            }
        }
        return false;
    }

    async handleCompileSuccess() {
        console.log('✅ Compile success');

        // Update UI
        this.ui.showCompileStatus('success');

        // Save good state
        const content = this.editor.getContent();
        if (content) {
            await chrome.runtime.sendMessage({
                type: 'SAVE_GOOD_STATE',
                payload: {
                    content: content,
                    lineCount: content.split('\n').length
                }
            });
        }
    }

    async handleCompileError() {
        console.log('❌ Compile error detected');

        // Update UI
        this.ui.showCompileStatus('error');

        // Extract error info
        const errorInfo = this.errorHandler.extractErrorInfo();

        if (errorInfo) {
            // Show error drawer with "Analyzing..." state
            this.ui.showErrorDrawer(errorInfo, { loading: true });

            // Request LLM explanation
            const explanation = await chrome.runtime.sendMessage({
                type: 'EXPLAIN_ERROR',
                payload: errorInfo
            });

            // Update drawer with explanation
            this.ui.showErrorDrawer(errorInfo, {
                loading: false,
                explanation
            });
        }
    }

    enableBeginnerMode() {
        console.log('🟢 Enabling Beginner Mode');
        this.editor.lockStructuralElements();
        this.editor.hideAdvancedContent();
        this.ui.filterFileTree();
        this.ui.addTooltips();
        this.ui.updateToggleState(true);
    }

    disableBeginnerMode() {
        console.log('⚪ Disabling Beginner Mode');
        this.editor.unlockAll();
        this.editor.showAllContent();
        this.ui.showAllFiles();
        this.ui.removeTooltips();
        this.ui.updateToggleState(false);
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
        } else {
            this.disableBeginnerMode();
        }
    }
}

// Initialize when DOM is ready
const easyLeaf = new EasyLeaf();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => easyLeaf.init());
} else {
    easyLeaf.init();
}

// Export for module access
window.easyLeaf = easyLeaf;
