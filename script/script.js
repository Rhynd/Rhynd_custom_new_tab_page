import { state } from './state.js';
import { elements, displayTopSites, clearSuggestions } from './ui.js';
import { fetchSuggestions, showInitialSuggestions } from './api.js';
import { debounce, performSearch } from './utils.js';
import { handleSearchInputKeyDown, handleGlobalKeyDown } from './keyboard.js';
import { initBackgroundManager } from './backgroundManager.js';

function init() {
    initBackgroundManager();

    if (!elements.searchForm || !elements.searchInput || !elements.geminiButton || !elements.matchesList || !elements.quickLinksGrid || !elements.searchContainer) {
        console.error("Required elements not found. Check your HTML IDs and classes.");
        return;
    }

    const DEBOUNCE_DELAY = 200;

    elements.searchForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const openInNewTab = event.shiftKey; 
        const selectedItem = elements.matchesList.querySelector('.suggestion-item.selected');

        if (selectedItem) {
            const data = selectedItem.suggestionData;
            if (data) {
                performSearch(data.url || data.text, openInNewTab);
            }
        } else {
            performSearch(elements.searchInput.value, openInNewTab);
        }
    });

    elements.geminiButton.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const geminiUrl = 'https://gemini.google.com/';
        const openInNewTab = e.button === 1 || e.ctrlKey || e.metaKey;

        performSearch(geminiUrl, openInNewTab);
    });

    elements.searchInput.addEventListener('focus', () => {
        state.userFocusedInput = true;
        const query = elements.searchInput.value.trim();
        if (query.length > 0) {
            fetchSuggestions(query);
        } else {
            elements.searchInput.setAttribute('aria-expanded', 'true');
            showInitialSuggestions();
        }
    });

    elements.searchInput.addEventListener('blur', () => {
        state.userFocusedInput = false;
    });

    const debouncedFetchSuggestions = debounce(fetchSuggestions, DEBOUNCE_DELAY);

    elements.searchInput.addEventListener('input', () => {
        const query = elements.searchInput.value.trim();
        state.originalUserQuery = query; 
        if (query.length > 0) {
            debouncedFetchSuggestions(query);
        } else {
            debouncedFetchSuggestions.cancel();
            showInitialSuggestions();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (document.activeElement === elements.searchInput) {
            handleSearchInputKeyDown(event);
        } else {
            handleGlobalKeyDown(event);
        }
    });

    document.addEventListener('mousedown', (event) => {
        if (!elements.searchContainer.contains(event.target)) {
            clearSuggestions();
        }
    });

    window.addEventListener('blur', () => {
        clearSuggestions();
        state.userFocusedInput = false;
    });

    window.addEventListener('focus', () => {
        if (document.activeElement === elements.searchInput && !state.userFocusedInput) {
            elements.searchInput.blur();
        }
    });

    displayTopSites();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}