/**
 * EasyLeaf Side Panel Script
 * Resume Builder functionality
 */

// Form configurations for each section type
const FORM_CONFIGS = {
    education: {
        title: 'Add Education',
        fields: [
            { name: 'institution', label: 'Institution', placeholder: 'e.g., MIT, Stanford University' },
            { name: 'location', label: 'Location', placeholder: 'e.g., Cambridge, MA' },
            { name: 'degree', label: 'Degree', placeholder: 'e.g., B.S. Computer Science' },
            { name: 'dates', label: 'Dates', placeholder: 'e.g., Aug 2020 – May 2024' },
            { name: 'gpa', label: 'GPA (optional)', placeholder: 'e.g., 3.8/4.0' },
            { name: 'coursework', label: 'Relevant Coursework (optional)', placeholder: 'e.g., Algorithms, ML, Databases', type: 'textarea' }
        ]
    },
    experience: {
        title: 'Add Experience',
        fields: [
            { name: 'company', label: 'Company', placeholder: 'e.g., Google, Microsoft' },
            { name: 'location', label: 'Location', placeholder: 'e.g., Mountain View, CA' },
            { name: 'role', label: 'Role', placeholder: 'e.g., Software Engineer Intern' },
            { name: 'dates', label: 'Dates', placeholder: 'e.g., Jun 2023 – Aug 2023' },
            { name: 'bullet1', label: 'Achievement 1', placeholder: 'Start with an action verb...', type: 'textarea' },
            { name: 'bullet2', label: 'Achievement 2 (optional)', placeholder: 'Quantify impact when possible...', type: 'textarea' },
            { name: 'bullet3', label: 'Achievement 3 (optional)', placeholder: 'Mention technologies used...', type: 'textarea' }
        ]
    },
    skill: {
        title: 'Add Skill Category',
        fields: [
            { name: 'category', label: 'Category', placeholder: 'e.g., Programming Languages, Frameworks' },
            { name: 'skills', label: 'Skills', placeholder: 'e.g., Python, JavaScript, React, Node.js', type: 'textarea' }
        ]
    },
    project: {
        title: 'Add Project',
        fields: [
            { name: 'name', label: 'Project Name', placeholder: 'e.g., Personal Portfolio Website' },
            { name: 'technologies', label: 'Technologies', placeholder: 'e.g., React, Node.js, MongoDB' },
            { name: 'description', label: 'Description', placeholder: 'What does the project do?', type: 'textarea' },
            { name: 'link', label: 'Link (optional)', placeholder: 'e.g., github.com/user/project' }
        ]
    }
};

// LaTeX snippet templates
const SNIPPET_TEMPLATES = {
    bullet: '\\item ',
    bold: '\\textbf{}',
    italic: '\\textit{}',
    link: '\\href{URL}{TEXT}',
    itemize: '\\begin{itemize}\n    \\item \n\\end{itemize}'
};

class SidePanel {
    constructor() {
        this.currentType = null;
        this.init();
    }

    init() {
        this.setupQuickActions();
        this.setupSnippets();
        this.setupTextTools();
        this.setupCustomization();
        this.setupCompileButton();
    }

    setupTextTools() {
        document.querySelectorAll('.text-tool').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tool = btn.dataset.tool;
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (!tab?.id) throw new Error('No active tab');

                    await chrome.tabs.sendMessage(tab.id, {
                        type: 'TRANSFORM_TEXT',
                        payload: { type: tool }
                    });
                    this.showToast('Text transformed!');
                } catch (error) {
                    console.error('Text tool error:', error);
                    this.showToast('Failed to transform text', 'error');
                }
            });
        });
    }

    setupQuickActions() {
        const buttons = document.querySelectorAll('.quick-action');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;

                // Update active state
                buttons.forEach(b => b.classList.remove('quick-action--active'));
                btn.classList.add('quick-action--active');

                // Show form
                this.showForm(type);
            });
        });
    }

    showForm(type) {
        const config = FORM_CONFIGS[type];
        if (!config) return;

        this.currentType = type;
        const container = document.getElementById('formContainer');
        const title = document.getElementById('formTitle');
        const form = document.getElementById('sectionForm');

        title.textContent = config.title;

        // Build form HTML
        let fieldsHTML = config.fields.map(field => `
      <div class="form-group">
        <label class="form-label">${field.label}</label>
        ${field.type === 'textarea'
                ? `<textarea class="form-input form-textarea" name="${field.name}" placeholder="${field.placeholder}"></textarea>`
                : `<input type="text" class="form-input" name="${field.name}" placeholder="${field.placeholder}">`
            }
      </div>
    `).join('');

        fieldsHTML += `
      <div class="form-checkbox">
        <label>
            <input type="checkbox" name="include_header" checked>
            Add Section Header
        </label>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelForm">Cancel</button>
        <button type="submit" class="btn btn--primary">Insert Section</button>
      </div>
    `;

        form.innerHTML = fieldsHTML;
        container.style.display = 'block';

        // Setup form handlers
        form.onsubmit = (e) => this.handleFormSubmit(e);
        const cancelBtn = document.getElementById('cancelForm');
        cancelBtn.onclick = () => {
            container.style.display = 'none';
        };
    }

    async handleFormSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        try {
            // Request snippet from backend
            const response = await chrome.runtime.sendMessage({
                type: 'GENERATE_SNIPPET',
                payload: {
                    type: this.currentType,
                    type: this.currentType,
                    data: {
                        ...data,
                        include_header: data.include_header === 'on'
                    }
                }
            });

            if (response.latex) {
                // Send to content script to insert
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                chrome.tabs.sendMessage(tab.id, {
                    type: 'INSERT_SNIPPET',
                    payload: { latex: response.latex }
                });

                // Show success feedback
                this.showToast('Section added successfully!');

                // Hide form
                document.getElementById('formContainer').style.display = 'none';
                e.target.reset();
            } else {
                // Fallback: generate locally
                const latex = this.generateLocalSnippet(this.currentType, data);
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                chrome.tabs.sendMessage(tab.id, {
                    type: 'INSERT_SNIPPET',
                    payload: { latex }
                });

                this.showToast('Section added!');
                document.getElementById('formContainer').style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to insert section:', error);
            this.showToast('Failed to insert section', 'error');
        }
    }

    generateLocalSnippet(type, data) {
        // Fallback local snippet generation
        const templates = {
            education: `\\resumeSubheading
  {${data.institution || 'Institution'}}{${data.location || 'Location'}}
  {${data.degree || 'Degree'}}{${data.dates || 'Dates'}}`,

            experience: `\\resumeSubheading
  {${data.company || 'Company'}}{${data.location || 'Location'}}
  {${data.role || 'Role'}}{${data.dates || 'Dates'}}
  \\resumeItemListStart
    \\resumeItem{${data.bullet1 || 'Achievement 1'}}
    ${data.bullet2 ? `\\resumeItem{${data.bullet2}}` : ''}
    ${data.bullet3 ? `\\resumeItem{${data.bullet3}}` : ''}
  \\resumeItemListEnd`,

            skill: `\\textbf{${data.category || 'Category'}}: ${data.skills || 'Skills'}`,

            project: `\\resumeProjectHeading
  {\\textbf{${data.name || 'Project'}} $|$ \\emph{${data.technologies || 'Tech'}}}{}
  \\resumeItemListStart
    \\resumeItem{${data.description || 'Description'}}
  \\resumeItemListEnd`
        };

        return templates[type] || '';
    }

    setupSnippets() {
        document.querySelectorAll('.snippet-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const type = btn.dataset.snippet;
                const snippet = SNIPPET_TEMPLATES[type];

                if (snippet) {
                    try {
                        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                        if (!tab?.id) throw new Error('No active tab');

                        await chrome.tabs.sendMessage(tab.id, {
                            type: 'INSERT_SNIPPET',
                            payload: { latex: snippet }
                        });
                        this.showToast('Snippet inserted!');
                    } catch (error) {
                        console.error('Snippet error:', error);
                        this.showToast('Failed to insert snippet', 'error');
                    }
                } else {
                    console.error('Unknown snippet type:', type);
                }
            });
        });
    }

    setupCustomization() {
        // Font size slider
        const fontSlider = document.getElementById('fontSizeSlider');
        fontSlider?.addEventListener('input', (e) => {
            this.applyCustomization('fontSize', e.target.value);
        });

        // Spacing slider
        const spacingSlider = document.getElementById('spacingSlider');
        spacingSlider?.addEventListener('input', (e) => {
            this.applyCustomization('spacing', e.target.value);
        });

        // Margin presets
        document.querySelectorAll('.segment__option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.segment__option').forEach(b =>
                    b.classList.remove('segment__option--active'));
                btn.classList.add('segment__option--active');
                this.applyCustomization('margin', btn.dataset.margin);
            });
        });
    }

    async applyCustomization(type, value) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, {
            type: 'APPLY_CUSTOMIZATION',
            payload: { type, value }
        });
    }

    setupCompileButton() {
        document.getElementById('compileBtn')?.addEventListener('click', async () => {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_COMPILE' });
        });
    }

    showToast(message, type = 'success') {
        // Remove existing toast
        document.querySelector('.toast')?.remove();

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `
      <span class="toast__icon">${type === 'success' ? '✓' : '✗'}</span>
      <span class="toast__message">${message}</span>
    `;
        toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#22C55E' : '#EF4444'};
      color: white;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      z-index: 1000;
      animation: slideUp 0.3s ease;
    `;

        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from { opacity: 0; transform: translate(-50%, 20px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
`;
document.head.appendChild(style);

// Initialize
const panel = new SidePanel();
