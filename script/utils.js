export function debounce(func, delay) {
    let timeoutId; 
    const debouncedFunc = function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };

    debouncedFunc.cancel = () => {
        clearTimeout(timeoutId);
    };

    return debouncedFunc;
}

export function performSearch(queryOrUrl, inNewTab = false) {
    let targetUrl;
    const query = (queryOrUrl || '').trim();
    if (!query) return;

    const isUrl = query.startsWith('http') || (query.includes('.') && !query.includes(' '));
    targetUrl = isUrl
        ? (query.startsWith('http') ? query : `https://${query}`)
        : `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    if (inNewTab) {
        chrome.tabs.create({ url: targetUrl, active: false });
    } else {
        window.location.href = targetUrl;
    }
}
