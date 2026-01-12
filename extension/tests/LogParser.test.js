const fs = require('fs');
const path = require('path');
const { test, describe, it, before } = require('node:test');
const assert = require('node:assert');

// Mock window object
global.window = {};

// Load the source file
const sourcePath = path.join(__dirname, '../content/controllers/LogParser.js');
const sourceCode = fs.readFileSync(sourcePath, 'utf8');

// Execute the source code to load LogParser into global.window
eval(sourceCode);

const LogParser = global.window.LogParser;

describe('LogParser', () => {
    let parser;

    before(() => {
        parser = new LogParser();
    });

    it('should parse standard LaTeX error with "! " prefix', () => {
        const log = `
This is is some random text.
! Undefined control sequence.
l.12 \\mistake
        `;
        const result = parser.parse(log);
        assert.deepStrictEqual(result, {
            message: 'Undefined control sequence.',
            line: 12,
            fullText: '! Undefined control sequence.\nl.12'
        });
    });

    it('should parse File:Line style error', () => {
        const log = `
./main.tex:42: Undefined control sequence.
<argument> \\@nil
        `;
        const result = parser.parse(log);
        assert.deepStrictEqual(result, {
            message: 'Undefined control sequence.',
            line: 42,
            file: './main.tex',
            fullText: './main.tex:42: Undefined control sequence.'
        });
    });

    it('should parse Runaway argument error', () => {
        const log = [
            "Runaway argument?",
            "{ \\textbf {oops} \\end {document}",
            "! File ended while scanning use of \\@newl@bel."
        ].join('\n');

        const result = parser.parse(log);
        assert.ok(result);
        assert.strictEqual(result.message, 'Runaway argument (unclosed brace?)');
        assert.strictEqual(result.line, null);
    });

    it('should return null for clean logs', () => {
        const log = `
This is a clean log.
Output written on main.pdf (1 page, 3990 bytes).
Transcript written on main.log.
        `;
        const result = parser.parse(log);
        assert.strictEqual(result, null);
    });

    it('should handle Windows line endings', () => {
        const log = 'Something\r\n! Error here.\r\nl.5 \\cmd\r\n';
        const result = parser.parse(log);
        assert.strictEqual(result.line, 5);
        assert.strictEqual(result.message, 'Error here.');
    });

    it('should prioritize the first error found', () => {
        const log = `
! First Error.
l.10 \\error1

! Second Error.
l.20 \\error2
        `;
        const result = parser.parse(log);
        assert.strictEqual(result.line, 10);
        assert.strictEqual(result.message, 'First Error.');
    });
});
