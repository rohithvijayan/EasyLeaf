/**
 * EasyLeaf State Manager
 * Handles extension state persistence and sync
 */

export class StateManager {
    constructor() {
        this.isBeginnerMode = false;
        this.lastGoodState = null;
        this.currentTemplate = null;
        this.settings = {
            showWalkthrough: true,
            showTooltips: true,
            autoFix: false
        };
    }

    async load() {
        try {
            const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

            this.isBeginnerMode = state.isBeginnerMode || false;
            this.lastGoodState = state.lastGoodState || null;

            console.log('State loaded:', { isBeginnerMode: this.isBeginnerMode });
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

    detectTemplate(content) {
        const patterns = {
            'jake-resume': /resumeSubheading|%-----------.*-----------/,
            'deedy-cv': /deedy-resume|\\namesection/,
            'altacv': /altacv|\\makecvheader/,
            'moderncv': /moderncv|\\cventry/,
            'simple': /\\documentclass\{article\}/
        };

        for (const [template, pattern] of Object.entries(patterns)) {
            if (pattern.test(content)) {
                this.currentTemplate = template;
                return template;
            }
        }

        return 'unknown';
    }
}
