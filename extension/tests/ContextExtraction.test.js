const fs = require('fs');
const path = require('path');
const { test, describe, it, before } = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');

// Mock DOM
const dom = new JSDOM(`<!DOCTYPE html><body><div class="cm-editor"></div></body>`);
global.window = dom.window;
global.document = dom.window.document;
global.Node = dom.window.Node;

// Load code
const sourcePath = path.join(__dirname, '../content/controllers/EditorController.js');
// The source uses export class which Node eval might dislike if we don't handle it.
// We'll do a simple replace to make it CommonJS friendly for the test runner.
let sourceCode = fs.readFileSync(sourcePath, 'utf8');
sourceCode = sourceCode.replace('export class EditorController', 'global.window.EditorController = class EditorController');
eval(sourceCode);

const EditorController = global.window.EditorController;

describe('Context Extraction', () => {
    let editor;

    // Mock getContent
    const mockContent = [
        '\\documentclass{article}',
        '\\usepackage{graphicx}',
        '\\begin{document}', // Line 3 (0-indexed 2)
        '\\section{Intro}',
        'Here is some text.', // Line 5
        '\\textbf{Bold} text.',
        '\\error{here}',      // Line 7
        'More text.',
        'Even more text.',
        '\\end{document}'
    ].join('\n');

    before(() => {
        editor = new EditorController({});
        // Mock the getContent method directly on the instance
        editor.getContent = () => mockContent;
    });

    it('should extract correct preamble', () => {
        const context = editor.getContext(5);
        const expectedPreamble = [
            '\\documentclass{article}',
            '\\usepackage{graphicx}',
            '\\begin{document}'
        ].join('\n');

        assert.strictEqual(context.preamble, expectedPreamble);
    });

    it('should extract surrounding lines (radius 1)', () => {
        const context = editor.getContext(7, 1); // Line 7 is error
        // Lines: 6, 7, 8 (indices 5, 6, 7)
        // 5: \textbf{Bold} text.
        // 6: \error{here}
        // 7: More text.

        const expectedContext = [
            '\\textbf{Bold} text.',
            '\\error{here}',
            'More text.'
        ].join('\n');

        assert.strictEqual(context.contextLines, expectedContext);
    });

    it('should handle boundaries (start of file)', () => {
        const context = editor.getContext(1, 2);
        // Start index would be negative, shoud clamp to 0
        // Lines 1, 2, 3 (indices 0, 1, 2)
        const expectedContext = [
            '\\documentclass{article}',
            '\\usepackage{graphicx}',
            '\\begin{document}'
        ].join('\n');

        assert.strictEqual(context.contextLines, expectedContext);
    });

    it('should return null if content is empty', () => {
        editor.getContent = () => null;
        const context = editor.getContext(5);
        assert.strictEqual(context, null);
    });
});
