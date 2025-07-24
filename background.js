let timerState = {
  isRunning: false,
  timeLeft: 25 * 60,
  currentSession: 'focus',
  completedSessions: 0,
  isBlocking: false
};

// Ensure block rules accurately reflect user storage and timer state on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get('timerState', async (result) => {
    const state = result.timerState;
    if (!state || !state.isRunning) {
      // Not in active session: remove ALL blocking rules
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      const ids = rules.map(r => r.id);
      if (ids.length) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ids
        });
      }
    }
  });
});

// Remove/add rules whenever blocklist changes (if in a focus session)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.blockedSites) {
    if (timerState.isRunning && timerState.currentSession === 'focus') {
      startBlocking();
    }
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    timerState,
    completedSessions: 0,
    blockedSites: [] // user starts with empty blocklist
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomodoroTimer') handleTimerTick();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startTimer':
      startTimer(); sendResponse && sendResponse(); break;
    case 'pauseTimer':
      pauseTimer(); sendResponse && sendResponse(); break;
    case 'resetTimer':
      resetTimer(); sendResponse && sendResponse(); break;
    case 'skipSession':
    case 'forceSessionEnd':
      forceSessionEnd(); sendResponse && sendResponse(); break;
    case 'getState':
      sendResponse(timerState); break;
  }
  return true;
});

// ---- TIMER/BLOCKING LOGIC ----

function startTimer() {
  timerState.isRunning = true;
  if (timerState.currentSession === 'focus') startBlocking();
  chrome.alarms.create('pomodoroTimer', { periodInMinutes: 1/60 });
  chrome.storage.local.set({ timerState });
  broadcastMessage({ action: 'timerStarted' });
  notifyMusicPages('play');
}

function pauseTimer() {
  timerState.isRunning = false;
  chrome.alarms.clear('pomodoroTimer');
  stopBlocking();
  chrome.storage.local.set({ timerState });
  broadcastMessage({ action: 'timerPaused' });
  notifyMusicPages('pause');
}

function resetTimer() {
  timerState.isRunning = false;
  timerState.timeLeft = timerState.currentSession === 'focus' ? 25 * 60 : 5 * 60;
  chrome.alarms.clear('pomodoroTimer');
  stopBlocking();
  chrome.storage.local.set({ timerState });
  broadcastMessage({ action: 'timerReset' });
  notifyMusicPages('pause');
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
    notifyMusicPages('pause');
  } else {
    timerState.currentSession = 'focus';
    timerState.timeLeft = 25 * 60;
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
      title: 'Break Over! 💪',
      message: 'Ready for another focus session?'
    });
    notifyMusicPages('play');
  }
  chrome.storage.local.set({ timerState, completedSessions: timerState.completedSessions });
  broadcastMessage({ action: 'sessionComplete' });
}

// -- BLOCKING RULES, USER-ONLY BLOCKLIST & INSTANT REFRESH --

async function startBlocking() {
  timerState.isBlocking = true;
  try {
    const result = await chrome.storage.local.get(['blockedSites']);
    let sites = result.blockedSites || [];
    if (!sites.length) {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      if (existingRules.length) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: existingRules.map(rule => rule.id),
          addRules: []
        });
      }
      return;
    }
    const rules = sites.map((pattern, i) => ({
      id: i + 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { url: chrome.runtime.getURL('blocked.html') }
      },
      condition: {
        urlFilter: pattern,
        resourceTypes: ['main_frame', 'sub_frame']
      }
    }));
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    if (existingRules.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRules.map(rule => rule.id)
      });
    }
    await chrome.declarativeNetRequest.updateDynamicRules({
      addRules: rules
    });
  } catch (error) { console.error('Error setting up blocking:', error); }
}

async function stopBlocking() {
  timerState.isBlocking = false;
  try {
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const ruleIdsToRemove = existingRules.map(rule => rule.id);
    if (ruleIdsToRemove.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIdsToRemove
      });
    }
  } catch (error) { console.error('Error removing blocking rules:', error); }
}

function notifyMusicPages(playState) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.url && tab.url.includes('music.html')) {
        chrome.tabs.sendMessage(tab.id, { music: playState });
      }
    });
  });
}

function broadcastMessage(message) {
  chrome.runtime.sendMessage(message).catch(() => {});
}
