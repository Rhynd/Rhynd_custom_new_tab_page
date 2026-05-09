import { state } from './state.js';
import { displaySuggestions } from './ui.js';

const MAX_INITIAL_HISTORY = 100;
const MAX_QUERY_HISTORY = 50;
const MAX_SUGGESTIONS = 10;

export function groupHistoryItems(historyItems) {
    const uniqueHistoryItems = [];
    const seenUrls = new Set();
    for (const item of historyItems) {
        if (item.url && !seenUrls.has(item.url)) {
            uniqueHistoryItems.push(item);
            seenUrls.add(item.url);
        }
    }

    const itemsByDomain = new Map();
    uniqueHistoryItems.forEach(item => {
        try {
            const domain = new URL(item.url).hostname.replace(/^www\./, '');
            if (!itemsByDomain.has(domain)) {
                itemsByDomain.set(domain, []);
            }
            itemsByDomain.get(domain).push(item);
        } catch (e) { /* Ignore invalid URLs */ }
    });

    const processedSuggestions = [];
    for (const [domain, items] of itemsByDomain.entries()) {
        items.sort((a, b) => b.lastVisitTime - a.lastVisitTime);

        const mappedItems = items.map(item => ({
            text: item.title || item.url,
            url: item.url,
            type: 'history',
            id: item.id,
            lastVisitTime: item.lastVisitTime
        }));

        if (items.length > 1) {
            const simpleUrlItem = items.find(item => {
                try {
                    const url = new URL(item.url);
                    return url.pathname === '/' && url.search === '' && url.hash === '';
                } catch {
                    return false;
                }
            });

            const groupUrl = simpleUrlItem ? simpleUrlItem.url : items[0].url;

            processedSuggestions.push({
                text: domain,
                url: groupUrl,
                type: 'history',
                isGroup: true,
                items: mappedItems,
                latestVisitTime: items[0].lastVisitTime
            });
        } else {
            processedSuggestions.push(mappedItems[0]);
        }
    }

    return processedSuggestions.sort((a, b) => {
        const timeA = a.latestVisitTime || a.lastVisitTime || 0;
        const timeB = b.latestVisitTime || b.lastVisitTime || 0;
        return timeB - timeA;
    });
}

export function showInitialSuggestions() {
    if (typeof chrome.history === 'undefined') return;
    state.abortController.abort();
    state.abortController = new AbortController();

    chrome.history.search({ text: '', maxResults: MAX_INITIAL_HISTORY }, (historyItems) => {
        const filtered = historyItems.filter(item => item.url && item.title !== 'New Tab');
        const suggestions = groupHistoryItems(filtered);
        displaySuggestions(suggestions, true);
    });
}

export async function fetchSuggestions(query) {
    state.abortController.abort();
    state.abortController = new AbortController();
    const signal = state.abortController.signal;

    const fetchGoogleSuggestions = async () => {
        try {
            const endpoint = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`;
            const res = await fetch(endpoint, { signal });
            if (!res.ok) return [];
            const data = await res.json();
            const list = Array.isArray(data?.[1]) ? data[1] : [];
            return list
                .map(s => (typeof s === 'string' ? s : s?.[0]))
                .filter(Boolean)
                .map(text => ({ text, type: 'search' }));
        } catch (error) {
            if (error.name === 'AbortError') return []; 
            return [];
        }
    };

    const fetchHistorySuggestions = async () => {
        if (typeof chrome.history === 'undefined') return [];
        try {
            const items = await new Promise((resolve, reject) => {
                chrome.history.search({ text: query, maxResults: MAX_QUERY_HISTORY }, (results) => {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    resolve(results);
                });
            });
            return groupHistoryItems(items);
        } catch (error) {
            console.error("Error fetching history suggestions:", error);
            return []; 
        }
    };

    const fetchBookmarkSuggestions = async () => {
        if (typeof chrome.bookmarks === 'undefined') return [];
        try {
            const items = await new Promise((resolve, reject) => {
                chrome.bookmarks.search(query, (results) => {
                    if (chrome.runtime.lastError) {
                        return reject(chrome.runtime.lastError);
                    }
                    resolve(results);
                });
            });
            const suggestions = items
                .filter(item => item.url) 
                .map(item => ({
                    text: item.title || item.url,
                    url: item.url,
                    type: 'bookmark'
                }));
            return suggestions;
        } catch (error) {
            console.error("Error fetching bookmark suggestions:", error);
            return [];
        }
    };

    const [historySuggestions, googleSuggestions, bookmarkSuggestions] = await Promise.all([
        fetchHistorySuggestions(),
        fetchGoogleSuggestions(),
        fetchBookmarkSuggestions()
    ]);

    if (signal.aborted) return; 

    const combined = [];
    const seen = new Set();

    const addSuggestion = (suggestion) => {
        const key = suggestion.url || (suggestion.text || '').toLowerCase();
        if (key && !seen.has(key) && combined.length < MAX_SUGGESTIONS) {
            combined.push(suggestion);
            seen.add(key);
        }
    };

    bookmarkSuggestions.forEach(addSuggestion);
    historySuggestions.forEach(addSuggestion);
    googleSuggestions.forEach(addSuggestion);

    displaySuggestions(combined);
}
