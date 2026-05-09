export function initBackgroundManager() {
    const bgUploadInput = document.getElementById('bg-upload');
    const changeBgBtn = document.getElementById('change-bg-btn');

    if (!bgUploadInput || !changeBgBtn) return;

    // Load saved background on startup
    if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['customBackground'], (result) => {
            if (result.customBackground) {
                document.body.style.backgroundImage = `url(${result.customBackground})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundRepeat = 'no-repeat';
                document.body.style.backgroundAttachment = 'fixed';
            }
        });
    }

    // Click button to open file selector
    changeBgBtn.addEventListener('click', () => {
        bgUploadInput.click();
    });

    // Right-click to reset background to default
    changeBgBtn.addEventListener('contextmenu', (event) => {
        event.preventDefault(); // Prevent standard right-click menu
        
        // Clear inline styles so the CSS default returns
        document.body.style.backgroundImage = '';
        document.body.style.backgroundSize = '';
        document.body.style.backgroundPosition = '';
        document.body.style.backgroundRepeat = '';
        document.body.style.backgroundAttachment = '';
        
        // Clear from storage
        if (chrome.storage && chrome.storage.local) {
            chrome.storage.local.remove(['customBackground']);
        }
    });

    // When file is selected
    bgUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target.result;
                // Update body background immediately
                document.body.style.backgroundImage = `url(${dataUrl})`;
                document.body.style.backgroundSize = 'cover';
                document.body.style.backgroundPosition = 'center';
                document.body.style.backgroundRepeat = 'no-repeat';
                document.body.style.backgroundAttachment = 'fixed';
                
                // Save to storage
                if (chrome.storage && chrome.storage.local) {
                    chrome.storage.local.set({ customBackground: dataUrl }, () => {
                        if (chrome.runtime.lastError) {
                            console.error("Error saving background:", chrome.runtime.lastError);
                        }
                    });
                }
            };
            // Read image as Data URL
            reader.readAsDataURL(file);

            // Reset the input value so the same file can be selected again if needed
            event.target.value = '';
        }
    });
}
