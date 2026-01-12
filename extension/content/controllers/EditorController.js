/**
 * EasyLeaf Editor Controller
 * Manages interactions with Overleaf's code editor
 */

export class EditorController {
    constructor(state) {
        this.state = state;
        this.lockedLines = new Set();
        this.hiddenRanges = [];
    }

    // ===== CONTENT ACCESS =====
    getContent() {
        try {
            // Try CodeMirror 6
            const cm6 = document.querySelector('.cm-editor');
            if (cm6 && cm6.cmView) {
                return cm6.cmView.state.doc.toString();
            }

            // Try Ace Editor
            const ace = window.ace?.edit(document.querySelector('.ace_editor'));
            if (ace) {
                return ace.getValue();
            }

            // Fallback: collect from line elements
            const lines = document.querySelectorAll('.cm-line, .ace_line');
            return Array.from(lines).map(l => l.textContent).join('\n');

        } catch (error) {
            console.error('Failed to get editor content:', error);
            return null;
        }
    }

    setContent(content) {
        try {
            // Try CodeMirror 6
            const cm6 = document.querySelector('.cm-editor');
            if (cm6 && cm6.cmView) {
                const { state } = cm6.cmView;
                cm6.cmView.dispatch({
                    changes: { from: 0, to: state.doc.length, insert: content }
                });
                return true;
            }

            // Try Ace Editor
            const ace = window.ace?.edit(document.querySelector('.ace_editor'));
            if (ace) {
                ace.setValue(content, -1);
                return true;
            }

            console.warn('Could not set content - editor not found');
            return false;

        } catch (error) {
            console.error('Failed to set editor content:', error);
            return false;
        }
    }

    // ===== CONTEXT EXTRACTION =====
    getContext(lineNumber, radius = 5) {
        const fullContent = this.getContent();
        if (!fullContent) return null;

        const lines = fullContent.split('\n');

        // 1. Extract Preamble
        let preambleEnd = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('\\begin{document}')) {
                preambleEnd = i;
                break;
            }
        }
        const preamble = lines.slice(0, preambleEnd + 1).join('\n');

        // 2. Extract Surrounding Context
        const targetIndex = lineNumber - 1; // 0-based
        const start = Math.max(0, targetIndex - radius);
        const end = Math.min(lines.length, targetIndex + radius + 1);
        const contextLines = lines.slice(start, end).join('\n');

        return {
            preamble,
            contextLines,
            fullContext: preamble + '\n...\n' + contextLines,
            lineContent: lines[targetIndex] || ''
        };
    }

    // ===== LOCKING =====
    lockStructuralElements() {
        const lines = document.querySelectorAll('.cm-line, .ace_line');

        const lockedPatterns = [
            /^\\documentclass/,
            /^\\begin\{document\}/,
            /^\\end\{document\}/,
            /^\\usepackage/,
            /^\\newcommand/,
            /^\\renewcommand/,
            /^\\titleformat/,
            /^\\setlength/,
            /^\\geometry/,
            /^\\hypersetup/
        ];

        lines.forEach((line, index) => {
            const text = line.textContent?.trim() || '';

            for (const pattern of lockedPatterns) {
                if (pattern.test(text)) {
                    this.lockLine(line, index);
                    break;
                }
            }
        });
    }

    lockLine(lineElement, lineNumber) {
        lineElement.classList.add('el-locked-line');

        // Add lock icon
        if (!lineElement.querySelector('.el-lock-icon')) {
            const icon = document.createElement('span');
            icon.className = 'el-lock-icon';
            icon.innerHTML = '🔒';
            icon.title = 'Beginner Mode: Do not edit';
            lineElement.insertBefore(icon, lineElement.firstChild);
        }

        this.lockedLines.add(lineNumber);
    }

    unlockAll() {
        document.querySelectorAll('.el-locked-line').forEach(line => {
            line.classList.remove('el-locked-line');
            line.querySelector('.el-lock-icon')?.remove();
        });

        this.lockedLines.clear();
    }

    // ===== HIDING PREAMBLE =====
    hideAdvancedContent() {
        const lines = document.querySelectorAll('.cm-line, .ace_line');
        let inPreamble = true;
        let preambleStart = 0;
        let preambleEnd = 0;

        lines.forEach((line, index) => {
            const text = line.textContent || '';

            if (text.includes('\\begin{document}')) {
                preambleEnd = index;
                inPreamble = false;
            }

            if (inPreamble && index > 0) {
                line.classList.add('el-preamble-hidden');
            }
        });

        // Add collapse indicator
        if (preambleEnd > 0) {
            const firstLine = lines[0];
            if (firstLine && !firstLine.querySelector('.el-preamble-collapse')) {
                const collapse = document.createElement('div');
                collapse.className = 'el-preamble-collapse';
                collapse.innerHTML = `
          <span class="el-collapse-icon">▶</span>
          <span class="el-collapse-text">Preamble hidden (${preambleEnd} lines) — click to expand</span>
        `;
                collapse.addEventListener('click', () => this.togglePreamble());
                firstLine.parentElement?.insertBefore(collapse, firstLine);
            }
        }

        this.hiddenRanges.push({ start: preambleStart, end: preambleEnd });
    }

    showAllContent() {
        document.querySelectorAll('.el-preamble-hidden').forEach(line => {
            line.classList.remove('el-preamble-hidden');
        });

        document.querySelector('.el-preamble-collapse')?.remove();
        this.hiddenRanges = [];
    }

    togglePreamble() {
        const hidden = document.querySelectorAll('.el-preamble-hidden');
        const isHidden = hidden.length > 0;

        if (isHidden) {
            hidden.forEach(line => line.classList.remove('el-preamble-hidden'));
            document.querySelector('.el-collapse-icon').textContent = '▼';
            document.querySelector('.el-collapse-text').textContent = 'Click to collapse preamble';
        } else {
            this.hideAdvancedContent();
        }
    }

    // ===== SECTION DETECTION =====
    detectSections() {
        const sections = [];
        const lines = document.querySelectorAll('.cm-line, .ace_line');

        const sectionPatterns = [
            { pattern: /%-+HEADING-+/, name: 'Heading', type: 'safe' },
            { pattern: /%-+EDUCATION-+/, name: 'Education', type: 'safe' },
            { pattern: /%-+EXPERIENCE-+/, name: 'Experience', type: 'safe' },
            { pattern: /%-+PROJECTS-+/, name: 'Projects', type: 'safe' },
            { pattern: /%-+SKILLS-+/, name: 'Skills', type: 'safe' },
            { pattern: /\\section\{(.+?)\}/, name: null, type: 'safe' },
            { pattern: /\\subsection\{(.+?)\}/, name: null, type: 'safe' }
        ];

        lines.forEach((line, index) => {
            const text = line.textContent || '';

            for (const { pattern, name, type } of sectionPatterns) {
                const match = text.match(pattern);
                if (match) {
                    sections.push({
                        lineNumber: index + 1,
                        name: name || match[1],
                        type,
                        element: line
                    });

                    // Add section badge
                    this.addSectionBadge(line, type);
                    break;
                }
            }
        });

        return sections;
    }

    addSectionBadge(lineElement, type) {
        if (lineElement.querySelector('.el-section-badge')) return;

        const badge = document.createElement('span');
        badge.className = `el-section-badge el-section-badge--${type}`;
        badge.textContent = type === 'safe' ? '✓ Safe to Edit' : '⚠ Caution';

        lineElement.appendChild(badge);
    }

    // ===== INSERTION =====
    insertAtCursor(text) {
        try {
            // Try CodeMirror 6
            const cm6 = document.querySelector('.cm-editor');
            if (cm6 && cm6.cmView) {
                const { state } = cm6.cmView;
                const pos = state.selection.main.head;
                cm6.cmView.dispatch({
                    changes: { from: pos, insert: text }
                });
                return true;
            }

            // Try Ace
            const ace = window.ace?.edit(document.querySelector('.ace_editor'));
            if (ace) {
                ace.insert(text);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Failed to insert text:', error);
            return false;
        }
    }

    insertAfterSection(sectionMarker, text) {
        const content = this.getContent();
        if (!content) return false;

        const markerIndex = content.indexOf(sectionMarker);
        if (markerIndex === -1) return false;

        // Find end of marker line
        const endOfLine = content.indexOf('\n', markerIndex);
        if (endOfLine === -1) return false;

        const newContent =
            content.slice(0, endOfLine + 1) +
            text + '\n' +
            content.slice(endOfLine + 1);

        return this.setContent(newContent);
    }
}
