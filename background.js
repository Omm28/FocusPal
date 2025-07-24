// Extension state
let timerState = {
    isRunning: false,
    timeLeft: 25 * 60,
    currentSession: 'focus',
    completedSessions: 0,
    isBlocking: false
};

// Default blocked sites
const defaultBlockedSites = [
    'youtube.com',
    'instagram.com', 
    'twitter.com',
    'facebook.com',
    'reddit.com',
    'tiktok.com'
];

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ 
        timerState, 
        completedSessions: 0,
        blockedSites: defaultBlockedSites
    });
});

// Handle timer alarms
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'pomodoroTimer') {
        handleTimerTick();
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'startTimer':
            startTimer();
            sendResponse({success: true});
            break;
        case 'pauseTimer':
            pauseTimer();
            sendResponse({success: true});
            break;
        case 'resetTimer':
            resetTimer();
            sendResponse({success: true});
            break;
        case 'getState':
            sendResponse(timerState);
            break;
    }
});

function startTimer() {
    console.log('Starting timer and blocking...');
    timerState.isRunning = true;
    
    if (timerState.currentSession === 'focus') {
        startBlocking();
    }
    
    chrome.alarms.create('pomodoroTimer', { periodInMinutes: 1/60 });
    chrome.storage.local.set({ timerState });
    broadcastMessage({ action: 'timerStarted' });
}

function pauseTimer() {
    console.log('Pausing timer and stopping blocking...');
    timerState.isRunning = false;
    chrome.alarms.clear('pomodoroTimer');
    stopBlocking();
    chrome.storage.local.set({ timerState });
    broadcastMessage({ action: 'timerPaused' });
}

function resetTimer() {
    console.log('Resetting timer and stopping blocking...');
    timerState.isRunning = false;
    timerState.timeLeft = timerState.currentSession === 'focus' ? 25 * 60 : 5 * 60;
    
    chrome.alarms.clear('pomodoroTimer');
    stopBlocking();
    
    chrome.storage.local.set({ timerState });
    broadcastMessage({ action: 'timerReset' });
}

function handleTimerTick() {
    if (!timerState.isRunning) return;
    
    timerState.timeLeft--;
    
    if (timerState.timeLeft <= 0) {
        completeSession();
    }
    
    chrome.storage.local.set({ timerState });
    broadcastMessage({ action: 'timerUpdate', timeLeft: timerState.timeLeft });
}

function completeSession() {
    timerState.isRunning = false;
    chrome.alarms.clear('pomodoroTimer');
    
    if (timerState.currentSession === 'focus') {
        timerState.completedSessions++;
        timerState.currentSession = 'break';
        timerState.timeLeft = 5 * 60;
        
        stopBlocking();
        
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            title: 'Focus Session Complete! 🎉',
            message: 'Time for a 5-minute break!'
        });
        
    } else {
        timerState.currentSession = 'focus';
        timerState.timeLeft = 25 * 60;
        
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            title: 'Break Over! 💪',
            message: 'Ready for another focus session?'
        });
    }
    
    chrome.storage.local.set({ timerState, completedSessions: timerState.completedSessions });
    broadcastMessage({ action: 'sessionComplete' });
}

async function startBlocking() {
    console.log('Starting declarativeNetRequest blocking...');
    timerState.isBlocking = true;
    
    try {
        // Get current blocked sites from storage
        const result = await chrome.storage.local.get(['blockedSites']);
        const sites = result.blockedSites || defaultBlockedSites;
        
        // Create blocking rules
        const rules = sites.map((site, index) => ({
            id: index + 1,
            priority: 1,
            action: {
                type: 'redirect',
                redirect: {
                    url: chrome.runtime.getURL('blocked.html')
                }
            },
            condition: {
                urlFilter: `*://*.${site}/*`,
                resourceTypes: ['main_frame', 'sub_frame']
            }
        }));
        
        // Remove any existing rules first
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const ruleIdsToRemove = existingRules.map(rule => rule.id);
        
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ruleIdsToRemove,
            addRules: rules
        });
        
        console.log('Blocking rules added:', rules);
        
    } catch (error) {
        console.error('Error setting up blocking:', error);
    }
}

async function stopBlocking() {
    console.log('Stopping declarativeNetRequest blocking...');
    timerState.isBlocking = false;
    
    try {
        // Remove all dynamic rules
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const ruleIdsToRemove = existingRules.map(rule => rule.id);
        
        if (ruleIdsToRemove.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: ruleIdsToRemove
            });
        }
        
        console.log('All blocking rules removed');
        
    } catch (error) {
        console.error('Error removing blocking rules:', error);
    }
}

function broadcastMessage(message) {
    chrome.runtime.sendMessage(message).catch(() => {
        // Popup might be closed, that's okay
    });
}
