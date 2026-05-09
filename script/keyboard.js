import { state } from './state.js';
import { elements, clearSuggestions, handleDeleteGroupSuggestion, handleDeleteSuggestion } from './ui.js';
import { showInitialSuggestions, fetchSuggestions } from './api.js';
import { performSearch } from './utils.js';

export function handleSearchInputKeyDown(event) {
    const selectedItem = elements.matchesList.querySelector('.suggestion-item.selected');

    switch (event.key) {
        case 'Escape':
            if (elements.searchContainer.classList.contains('has-suggestions')) {
                clearSuggestions();
            } else {
                elements.searchInput.blur();
            }
            break;

        case 'Enter':
        case ' ':
            if (!elements.searchContainer.classList.contains('has-suggestions')) {
                event.preventDefault();
                const query = elements.searchInput.value.trim();
                query ? fetchSuggestions(query) : showInitialSuggestions();
            } else if (event.key === 'Enter' && selectedItem?.suggestionData) {
                event.preventDefault();
                const openInNewTab = event.shiftKey;
                performSearch(selectedItem.suggestionData.url || selectedItem.suggestionData.text, openInNewTab);
            }
            break;

        case 'ArrowDown':
        case 'ArrowUp':
            event.preventDefault();
            navigateSuggestions(event.key);
            break;

        case 'ArrowRight':
            if (selectedItem?.classList.contains('suggestion-group') && !selectedItem.classList.contains('expanded')) {
                event.preventDefault();
                const arrow = selectedItem.querySelector('.suggestion-arrow');
                if (arrow) arrow.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            }
            break;

        case 'ArrowLeft':
            const group = selectedItem?.closest('.suggestion-group');
            if (group?.classList.contains('expanded')) {
                event.preventDefault();
                const arrow = group.querySelector('.suggestion-arrow');
                if (arrow) arrow.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

                selectedItem.classList.remove('selected');
                group.classList.add('selected');

                if (!state.isDisplayingInitialSuggestions) {
                    elements.searchInput.value = group.suggestionData.text;
                }
                group.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            break;

        case 'Delete':
            if (selectedItem?.suggestionData?.type === 'history') {
                event.preventDefault();
                if (selectedItem.suggestionData.isGroup) {
                    handleDeleteGroupSuggestion(selectedItem.suggestionData, selectedItem);
                } else {
                    handleDeleteSuggestion(selectedItem.suggestionData, selectedItem);
                }
            }
            break;
    }
}

export function handleGlobalKeyDown(event) {
    const target = event.target;
    const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    const isActionKey = event.key.length === 1 || event.key === 'Enter';

    if (!isTyping && isActionKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        if (event.key === 'Enter') {
            event.preventDefault();
            elements.searchInput.focus();
            showInitialSuggestions();
        } else {
            elements.searchInput.focus();
        }
    }
}

export function navigateSuggestions(key) {
    const items = Array.from(elements.matchesList.querySelectorAll('.suggestion-item:not(.suggestion-sublist .suggestion-item), .suggestion-item.expanded .suggestion-sublist .suggestion-item'));
    if (items.length === 0) return;

    let currentIndex = items.findIndex(item => item.classList.contains('selected'));

    if (currentIndex === -1) {
        state.originalUserQuery = elements.searchInput.value;
    }

    if (currentIndex !== -1) {
        items[currentIndex].classList.remove('selected');
    }

    let nextIndex;
    if (key === 'ArrowDown') {
        nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
            if (currentIndex !== -1) items[currentIndex].classList.remove('selected');
            elements.searchInput.value = state.originalUserQuery;
            return;
        }
    } else if (key === 'ArrowUp') {
        if (currentIndex === 0) {
            items[currentIndex].classList.remove('selected');
            elements.searchInput.value = state.originalUserQuery;
            return;
        }
        nextIndex = currentIndex === -1 ? items.length - 1 : currentIndex - 1;
    }

    const newItem = items[nextIndex];
    if (newItem && newItem.suggestionData) {
        newItem.classList.add('selected');
        if (!state.isDisplayingInitialSuggestions) {
            elements.searchInput.value = newItem.suggestionData.text;
        }

        newItem.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        });
    }
}
