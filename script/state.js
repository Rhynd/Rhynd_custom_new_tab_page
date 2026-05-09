export const state = {
    abortController: new AbortController(),
    userFocusedInput: false,
    expandedGroups: new Set(),
    originalUserQuery: '',
    isDisplayingInitialSuggestions: false
};
