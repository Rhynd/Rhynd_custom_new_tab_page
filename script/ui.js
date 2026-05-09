import { state } from './state.js';
import { performSearch } from './utils.js';

export const elements = {
    get searchForm() { return document.getElementById('search-form'); },
    get searchInput() { return document.getElementById('search-input'); },
    get geminiButton() { return document.getElementById('gemini-icon-button'); },
    get matchesList() { return document.getElementById('matches-list'); },
    get quickLinksGrid() { return document.getElementById('quick-links-grid'); },
    get searchContainer() { return document.querySelector('.search-container'); }
};

export function displayTopSites() {
    const MAX_QUICK_LINKS = 8;
    if (chrome.topSites) {
        chrome.topSites.get((sites) => {
            const topSites = sites.slice(0, MAX_QUICK_LINKS);
            elements.quickLinksGrid.innerHTML = '';
            topSites.forEach(site => {
                const linkItem = document.createElement('a');
                linkItem.href = site.url;
                linkItem.className = 'link-item';
                linkItem.title = site.title;

                const faviconUrl = chrome.runtime.getURL(`_favicon/?pageUrl=${encodeURIComponent(site.url)}&size=32`);

                const linkIcon = document.createElement('div');
                linkIcon.className = 'link-icon';
                const img = document.createElement('img');
                img.src = faviconUrl;
                img.alt = `Favicon for ${site.title || site.url}`;
                linkIcon.appendChild(img);

                const linkTitle = document.createElement('span');
                linkTitle.textContent = site.title || new URL(site.url).hostname;

                linkItem.appendChild(linkIcon);
                linkItem.appendChild(linkTitle);

                elements.quickLinksGrid.appendChild(linkItem);
            });
        });
    }
}

export function clearSuggestions() {
    state.isDisplayingInitialSuggestions = false;
    elements.searchContainer.classList.remove('has-suggestions');
    elements.searchForm.classList.remove('suggestions-active');
    elements.matchesList.innerHTML = '';
    elements.searchInput.setAttribute('aria-expanded', 'false');
    state.expandedGroups.clear();
}

export function displaySuggestions(suggestions, isInitial = false) {
    state.isDisplayingInitialSuggestions = isInitial;
    elements.matchesList.innerHTML = '';
    if (suggestions.length > 0) {
        elements.searchContainer.classList.add('has-suggestions');
        elements.searchForm.classList.add('suggestions-active');

        const presentGroups = new Set();

        suggestions.forEach(suggestion => {
            const item = createSuggestionItem(suggestion);

            if (suggestion.isGroup) {
                const groupKey = suggestion.url || suggestion.text;
                presentGroups.add(groupKey);
                item.dataset.groupKey = groupKey;

                if (state.expandedGroups.has(groupKey)) {
                    item.classList.add('expanded');
                }

                const sublist = document.createElement('div');
                sublist.className = 'suggestion-sublist';
                suggestion.items.forEach(subItemData => {
                    const subItem = createSuggestionItem(subItemData);
                    subItem.dataset.groupKey = groupKey;
                    sublist.appendChild(subItem);
                });
                item.appendChild(sublist);

                const arrow = item.querySelector('.suggestion-arrow');
                if (arrow) {
                    arrow.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const isCurrentlyExpanded = item.classList.contains('expanded');

                        document.querySelectorAll('.suggestion-item.expanded').forEach(otherItem => {
                            if (otherItem !== item) {
                                const otherKey = otherItem.dataset.groupKey;
                                otherItem.classList.remove('expanded');
                                if (otherKey) state.expandedGroups.delete(otherKey);
                            }
                        });

                        if (!isCurrentlyExpanded) {
                            item.classList.add('expanded');
                            state.expandedGroups.add(groupKey);
                        } else {
                            item.classList.remove('expanded');
                            state.expandedGroups.delete(groupKey);
                        }
                    });
                }
            }

            elements.matchesList.appendChild(item);
        });

        for (const key of Array.from(state.expandedGroups)) {
            if (!presentGroups.has(key)) {
                state.expandedGroups.delete(key);
            }
        }
    } else {
        clearSuggestions();
    }
}

export function createSuggestionItem(suggestion) {
    const item = document.createElement('div');
    item.suggestionData = suggestion;
    item.className = 'suggestion-item';
    if (suggestion.isGroup) {
        item.classList.add('suggestion-group');
    }
    item.setAttribute('role', 'option');

    const searchIconTemplate = document.getElementById('template-search-icon');
    const bookmarkIconTemplate = document.getElementById('template-bookmark-icon');

    let iconHtml;
    if (suggestion.type === 'history' && suggestion.url) {
        iconHtml = `<img class="favicon" src="${chrome.runtime.getURL(`_favicon/?pageUrl=${encodeURIComponent(suggestion.url)}&size=32`)}" alt="">`;
    } else if (suggestion.type === 'bookmark') {
        iconHtml = bookmarkIconTemplate.outerHTML;
    } else {
        iconHtml = searchIconTemplate.outerHTML;
    }

    let displayText = suggestion.text.length > 70 ? suggestion.text.substring(0, 70) + '...' : suggestion.text;

    const content = document.createElement('div');
    content.className = 'suggestion-content';
    content.innerHTML = iconHtml;
    item.appendChild(content);
    const textSpan = document.createElement('span');
    textSpan.className = 'suggestion-text';
    textSpan.textContent = displayText;
    content.appendChild(textSpan);

    const rightContainer = document.createElement('div');
    rightContainer.className = 'suggestion-right-container';
    item.appendChild(rightContainer);

    if (suggestion.isGroup) {
        const arrow = document.createElement('div');
        arrow.className = 'suggestion-arrow';
        arrow.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>`;
        rightContainer.appendChild(arrow);
    }

    if (suggestion.type === 'history' && !suggestion.isGroup) {
        const deleteButton = document.createElement('button');
        deleteButton.className = 'suggestion-delete-button';
        deleteButton.title = `Remove this history item`;
        deleteButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDeleteSuggestion(suggestion, item);
        });
        rightContainer.appendChild(deleteButton);
    }

    item.addEventListener('mousedown', (e) => {
        if (e.target.closest('.suggestion-delete-button, .suggestion-arrow')) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        performSearch(suggestion.url || suggestion.text, e.button === 1 || e.ctrlKey || e.metaKey);
    });

    return item;
}

export async function handleDeleteSuggestion(suggestion, element) {
    if (suggestion.type === 'history' && suggestion.url && chrome.history) {
        await new Promise(resolve => chrome.history.deleteUrl({ url: suggestion.url }, resolve));
    }

    const visibleItems = Array.from(elements.matchesList.querySelectorAll('.suggestion-item:not(.suggestion-sublist .suggestion-item), .suggestion-item.expanded .suggestion-sublist .suggestion-item'));
    const deletedIndex = visibleItems.findIndex(item => item === element);

    const parentGroupElement = element.closest('.suggestion-group');
    const sublist = element.parentElement;

    element.remove();
    selectNextItemAfterDeletion(deletedIndex);

    if (parentGroupElement && sublist && sublist.classList.contains('suggestion-sublist')) {
        if (sublist.childElementCount <= 1) {
            const remainingItemElement = sublist.querySelector('.suggestion-item');
            if (remainingItemElement && remainingItemElement.suggestionData) {
                const newItem = createSuggestionItem(remainingItemElement.suggestionData);
                parentGroupElement.replaceWith(newItem);
                newItem.classList.add('selected');
                return;
            } else {
                parentGroupElement.remove();
                if (elements.matchesList.childElementCount === 0) {
                    clearSuggestions();
                }
            }
        }
    } else {
        if (elements.matchesList.childElementCount === 0) {
            clearSuggestions();
        }
    }
}

export async function handleDeleteGroupSuggestion(groupSuggestion, groupElement) {
    if (!groupSuggestion.isGroup || !groupSuggestion.items) return;

    const deletePromises = groupSuggestion.items.map(item => {
        if (item.url && chrome.history) {
            return new Promise(resolve => chrome.history.deleteUrl({ url: item.url }, resolve));
        }
        return Promise.resolve();
    });

    await Promise.all(deletePromises);

    const visibleItems = Array.from(elements.matchesList.querySelectorAll('.suggestion-item:not(.suggestion-sublist .suggestion-item), .suggestion-item.expanded .suggestion-sublist .suggestion-item'));
    const deletedIndex = visibleItems.findIndex(item => item === groupElement);

    groupElement.remove();
    selectNextItemAfterDeletion(deletedIndex);
}

export function selectNextItemAfterDeletion(deletedIndex) {
    const newVisibleItems = Array.from(elements.matchesList.querySelectorAll('.suggestion-item:not(.suggestion-sublist .suggestion-item), .suggestion-item.expanded .suggestion-sublist .suggestion-item'));

    if (newVisibleItems.length === 0) {
        clearSuggestions();
        return;
    }

    const newIndex = Math.min(deletedIndex, newVisibleItems.length - 1);
    const itemToSelect = newVisibleItems[newIndex];

    if (itemToSelect) {
        itemToSelect.classList.add('selected');
        if (!state.isDisplayingInitialSuggestions && itemToSelect.suggestionData) {
            elements.searchInput.value = itemToSelect.suggestionData.text;
        }
    }
}
