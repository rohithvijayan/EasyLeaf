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
        </div>
    </div>
</body>
`);
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;

// Mock easyLeaf
global.window.easyLeaf = {
    ui: {
        showToast: () => { }
    },
    triggerCompile: () => { }
};

// Load the source file
const sourcePath = path.join(__dirname, '../content/ui/ErrorBubble.js');
const sourceCode = fs.readFileSync(sourcePath, 'utf8');
eval(sourceCode);

const ErrorBubble = global.window.ErrorBubble;

describe('ErrorBubble', () => {
    let bubble;
    let mockEditorController;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = `
            <div class="cm-editor">
                <div class="cm-content">
                    <div class="cm-line">Line 1</div>
                    <div class="cm-line">Error line</div>
                    <div class="cm-line">Line 3</div>
                </div>
            </div>
        `;

        mockEditorController = {
            getContent: () => "Line 1\nError line\nLine 3",
            setContent: () => true
        };

        bubble = new ErrorBubble(mockEditorController);
    });

    afterEach(() => {
        bubble.hide();
    });

    it('should create and show the bubble', () => {
        bubble.show(2, { message: 'Test Error' }, {
            explanation: 'Test explanation',
            fix: 'Test fix',
            fixed_code: 'Fixed line'
        });

        const bubbleEl = document.querySelector('.el-error-bubble');
        assert.ok(bubbleEl);
        assert.ok(bubbleEl.innerHTML.includes('Test explanation'));
        assert.ok(bubbleEl.innerHTML.includes('Fixed line'));
    });

    it('should hide the bubble', () => {
        bubble.show(2, { message: 'Test' }, { explanation: 'x', fix: 'y', fixed_code: 'z' });
        assert.ok(document.querySelector('.el-error-bubble'));

        bubble.hide();
        assert.strictEqual(document.querySelector('.el-error-bubble'), null);
    });

    it('should have an Apply Fix button', () => {
        bubble.show(2, { message: 'Test' }, { explanation: 'x', fix: 'y', fixed_code: 'z' });

        const applyBtn = document.querySelector('.el-error-bubble__apply');
        assert.ok(applyBtn);
        assert.ok(applyBtn.textContent.includes('Apply Fix'));
    });

    it('should call setContent when applying fix', () => {
        let setContentCalled = false;
        mockEditorController.setContent = (content) => {
            setContentCalled = true;
            assert.ok(content.includes('Fixed code'));
            return true;
        };

        bubble.show(2, { message: 'Test' }, { explanation: 'x', fix: 'y', fixed_code: 'Fixed code' });
        bubble.applyFix();

        assert.ok(setContentCalled);
    });

    it('should show loading state', () => {
        bubble.showLoading(2);

        const bubbleEl = document.querySelector('.el-error-bubble');
        assert.ok(bubbleEl);
        assert.ok(bubbleEl.classList.contains('el-error-bubble--loading'));
        assert.ok(bubbleEl.innerHTML.includes('Analyzing error'));
    });

    it('should show educational content for typo errors', () => {
        bubble.show(2, { message: 'Typo' }, {
            explanation: 'You misspelled the command',
            fix: 'Fix typo',
            fixed_code: 'fixed'
        });

        const whyBtn = document.querySelector('.el-error-bubble__why-btn');
        assert.ok(whyBtn, 'Why button should exist for typo errors');
    });
});
