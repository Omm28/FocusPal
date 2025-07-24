let timerState = {
    isRunning: false,
    timeLeft: 25 * 60,
    currentSession: 'focus',
    completedSessions: 0,
    isBlocking: false
};

const defaultBlockedSites = [
    'youtube.com',
    'instagram.com',
    'twitter.com',
    'facebook.com',
    'reddit.com',
    'tiktok.com'
];

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        timerState,
        completedSessions: 0,
        blockedSites: defaultBlockedSites
    });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'pomodoroTimer') {
        handleTimerTick();
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'startTimer':
            startTimer();
            sendResponse && sendResponse();
            break;
        case 'pauseTimer':
            pauseTimer();
            sendResponse && sendResponse();
            break;
        case 'resetTimer':
            resetTimer();
            sendResponse && sendResponse();
            break;
        case 'skipSession':
        case 'forceSessionEnd':
            forceSessionEnd();
            sendResponse && sendResponse();
            break;
        case 'getState':
            sendResponse(timerState);
            break;
    }
    return true; // Async
});

function startTimer() {
    timerState.isRunning = true;
    if (timerState.currentSession === 'focus') startBlocking();
    chrome.alarms.create('pomodoroTimer', { periodInMinutes: 1 / 60 }); // every second
    chrome.storage.local.set({ timerState });
    broadcastMessage({ action: 'timerStarted' });
}

function pauseTimer() {
    timerState.isRunning = false;
    chrome.alarms.clear('pomodoroTimer');
    stopBlocking();
    chrome.storage.local.set({ timerState });
    broadcastMessage({ action: 'timerPaused' });
}

function resetTimer() {
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
    } else {
        chrome.storage.local.set({ timerState });
        broadcastMessage({ action: 'timerUpdate', timeLeft: timerState.timeLeft });
    }
}

function forceSessionEnd() {
    timerState.timeLeft = 0;
    completeSession();
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
    timerState.isBlocking = true;
    try {
        const result = await chrome.storage.local.get(['blockedSites']);
        const sites = result.blockedSites || defaultBlockedSites;
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
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const ruleIdsToRemove = existingRules.map(rule => rule.id);
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ruleIdsToRemove,
            addRules: rules
        });
    } catch (error) {
        console.error('Error setting up blocking:', error);
    }
}

async function stopBlocking() {
    timerState.isBlocking = false;
    try {
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const ruleIdsToRemove = existingRules.map(rule => rule.id);
        if (ruleIdsToRemove.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: ruleIdsToRemove
            });
        }
    } catch (error) {
        console.error('Error removing blocking rules:', error);
    }
}

function broadcastMessage(message) {
    chrome.runtime.sendMessage(message).catch(() => {});
}
