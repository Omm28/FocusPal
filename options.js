document.addEventListener('DOMContentLoaded', function() {
    const newSiteInput = document.getElementById('newSiteInput');
    const addSiteBtn = document.getElementById('addSiteBtn');
    const sitesList = document.getElementById('sitesList');
    const focusTime = document.getElementById('focusTime');
    const breakTime = document.getElementById('breakTime');
    const saveBtn = document.getElementById('saveBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    // Load initial data
    loadBlockedSites();
    loadStats();
    
    // Event listeners
    addSiteBtn.addEventListener('click', addSite);
    newSiteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addSite();
    });
    saveBtn.addEventListener('click', saveSettings);
    resetBtn.addEventListener('click', resetToDefaults);
    
    function loadBlockedSites() {
        chrome.runtime.sendMessage({action: 'getBlockedSites'}, (response) => {
            displaySites(response || []);
        });
    }
    
    function displaySites(sites) {
        sitesList.innerHTML = '';
        sites.forEach((site, index) => {
            const siteElement = document.createElement('div');
            siteElement.className = 'site-item';
            
            // Clean up the URL for display
            const displayUrl = site.replace('*://*.', '').replace('/*', '');
            
            siteElement.innerHTML = `
                <span class="site-url">${displayUrl}</span>
                <button class="remove-btn" data-index="${index}">Remove</button>
            `;
            
            sitesList.appendChild(siteElement);
        });
        
        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                removeSite(index);
            });
        });
    }
    
    function addSite() {
        const url = newSiteInput.value.trim();
        if (!url) return;
        
        // Format the URL properly
        let formattedUrl = url.toLowerCase();
        if (!formattedUrl.includes('.')) {
            alert('Please enter a valid website URL (e.g., youtube.com)');
            return;
        }
        
        // Convert to the format Chrome expects
        if (!formattedUrl.startsWith('*://')) {
            formattedUrl = `*://*.${formattedUrl}/*`;
        }
        
        chrome.runtime.sendMessage({action: 'getBlockedSites'}, (currentSites) => {
            if (currentSites.includes(formattedUrl)) {
                alert('This site is already blocked!');
                return;
            }
            
            const updatedSites = [...currentSites, formattedUrl];
            chrome.runtime.sendMessage({
                action: 'updateBlockedSites',
                sites: updatedSites
            }, () => {
                newSiteInput.value = '';
                displaySites(updatedSites);
            });
        });
    }
    
    function removeSite(index) {
        chrome.runtime.sendMessage({action: 'getBlockedSites'}, (currentSites) => {
            const updatedSites = currentSites.filter((_, i) => i !== index);
            chrome.runtime.sendMessage({
                action: 'updateBlockedSites',
                sites: updatedSites
            }, () => {
                displaySites(updatedSites);
            });
        });
    }
    
    function loadStats() {
        chrome.storage.local.get(['completedSessions', 'totalSessions'], (result) => {
            document.getElementById('todaySessions').textContent = result.completedSessions || 0;
            document.getElementById('totalSessions').textContent = result.totalSessions || 0;
        });
    }
    
    function saveSettings() {
        const settings = {
            focusTime: parseInt(focusTime.value),
            breakTime: parseInt(breakTime.value)
        };
        
        chrome.storage.local.set(settings, () => {
            // Show success message
            saveBtn.textContent = 'Saved!';
            saveBtn.style.background = '#27ae60';
            
            setTimeout(() => {
                saveBtn.textContent = 'Save Settings';
                saveBtn.style.background = '#4CAF50';
            }, 2000);
        });
    }
    
    function resetToDefaults() {
        if (confirm('Are you sure you want to reset all settings to defaults?')) {
            const defaultSites = [
                '*://*.youtube.com/*',
                '*://*.instagram.com/*',
                '*://*.twitter.com/*',
                '*://*.facebook.com/*',
                '*://*.reddit.com/*',
                '*://*.tiktok.com/*'
            ];
            
            chrome.runtime.sendMessage({
                action: 'updateBlockedSites',
                sites: defaultSites
            });
            
            focusTime.value = 25;
            breakTime.value = 5;
            
            displaySites(defaultSites);
        }
    }
});
