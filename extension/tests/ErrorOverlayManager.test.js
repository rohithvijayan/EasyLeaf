const fs = require('fs');
const path = require('path');
const { test, describe, it, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

// Mock browser environment
const dom = new JSDOM(`<!DOCTYPE html>
<body>
    <div class="cm-editor">
        <div class="cm-content">
            <div class="cm-line">Line 1</div>
            <div class="cm-line">Line 2</div>
            <div class="cm-line">Line 3</div>
            <div class="cm-line">Line 4</div>
        </div>
    </div>
</body>
`);
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;

// Load the source file
const sourcePath = path.join(__dirname, '../content/controllers/ErrorOverlayManager.js');
const sourceCode = fs.readFileSync(sourcePath, 'utf8');
eval(sourceCode);

const ErrorOverlayManager = global.window.ErrorOverlayManager;

describe('ErrorOverlayManager', () => {
    let overlayManager;
    let mockEditorController;

    beforeEach(() => {
        // Reset DOM
        const cmContent = document.querySelector('.cm-content');
        cmContent.innerHTML = `
            <div class="cm-line">Line 1</div>
            <div class="cm-line">Line 2</div>
            <div class="cm-line">Line 3</div>
        `;

        mockEditorController = {};
        overlayManager = new ErrorOverlayManager(mockEditorController);
    });

    it('should find the correct line element', () => {
        const lineElement = overlayManager.getLineElement(2);
        assert.ok(lineElement);
        assert.strictEqual(lineElement.textContent, 'Line 2');
    });

    it('should add error class and tooltip to line', () => {
        overlayManager.showError(2, 'Test Error');

        const lineElement = overlayManager.getLineElement(2);
        assert.ok(lineElement.classList.contains('el-error-line'));

        const tooltip = lineElement.querySelector('.el-error-tooltip');
        assert.ok(tooltip);
        assert.strictEqual(tooltip.textContent, 'Error: Test Error');
    });

    it('should clear existing errors', () => {
        // Set error
        overlayManager.showError(1, 'Error 1');
        assert.ok(document.querySelector('.el-error-line'));

        // Clear
        overlayManager.clear();
        assert.strictEqual(document.querySelectorAll('.el-error-line').length, 0);
        assert.strictEqual(document.querySelectorAll('.el-error-tooltip').length, 0);
    });

    it('should handle missing lines gracefully', () => {
        // Line 10 doesn't exist
        overlayManager.showError(10, 'Out of bounds');
        // Should not crash
        assert.strictEqual(document.querySelectorAll('.el-error-line').length, 0);
    });

    it('should clear errors before showing a new one', () => {
        overlayManager.showError(1, 'Error 1');
        overlayManager.showError(2, 'Error 2');

        const lines = document.querySelectorAll('.el-error-line');
        assert.strictEqual(lines.length, 1);
        assert.strictEqual(lines[0].textContent, 'Line 2Error: Error 2');
    });
});
