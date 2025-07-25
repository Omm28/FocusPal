// == FOCUSPAL background.js ==

// Initial state (timeLeft set by initializeTimerState)
let timerState = {
  isRunning: false,
  timeLeft: 0,
  currentSession: 'focus',
  completedSessions: 0,
  isBlocking: false
};

// --- INITIALIZATION LOGIC ---
function initializeTimerState() {
  chrome.storage.local.get(['focusTime', 'breakTime', 'timerState'], (result) => {
    const focusMins = parseInt(result.focusTime) || 25;
    const breakMins = parseInt(result.breakTime) || 5;
    let session = (result.timerState && result.timerState.currentSession) ? result.timerState.currentSession : 'focus';
    timerState = {
      isRunning: false,
      timeLeft: session === 'focus' ? focusMins * 60 : breakMins * 60,
      currentSession: session,
      completedSessions: 0,
      isBlocking: false
    };
    chrome.storage.local.set({ timerState });
  });
}

// On install/start, always pull durations from settings and ensure no ghost blocking.
chrome.runtime.onInstalled.addListener(() => { initializeTimerState(); });
chrome.runtime.onStartup.addListener(() => { 
  initializeTimerState();
  chrome.storage.local.get('timerState', async (result) => {
    const state = result.timerState;
    if (!state || !state.isRunning) {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      const ids = rules.map(r => r.id);
      if (ids.length) {
        await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: ids });
      }
    }
  });
});

// --- Blocking rules: always update DNR instantly if blocklist changes during focus ---
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.blockedSites) {
    if (timerState.isRunning && timerState.currentSession === 'focus') {
      startBlocking();
    }
  }
});

// --- Messaging interface (all timer logic and instant-save magic) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startTimer': startTimer(); sendResponse && sendResponse(); break;
    case 'pauseTimer': pauseTimer(); sendResponse && sendResponse(); break;
    case 'resetTimer': resetTimer(); sendResponse && sendResponse(); break;
    case 'skipSession':
    case 'forceSessionEnd': forceSessionEnd(); sendResponse && sendResponse(); break;
    case 'getState': sendResponse(timerState); break;
    case 'timerSettingsChanged':
      chrome.storage.local.get(['focusTime', 'breakTime'], result => {
        if (!timerState.isRunning) {
          const focusMins = parseInt(result.focusTime) || 25;
          const breakMins = parseInt(result.breakTime) || 5;
          timerState.timeLeft = timerState.currentSession === 'focus'
            ? focusMins * 60
            : breakMins * 60;
          chrome.storage.local.set({ timerState }, () => {
            chrome.runtime.sendMessage({ action: 'timerUpdate' });
          });
        }
      });
      break;
  }
  return true;
});

// --- TIMER/BLOCKING/SYNC LOGIC ---
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'pomodoroTimer') handleTimerTick();
});

function startTimer() {
  timerState.isRunning = true;
  if (timerState.currentSession === 'focus') startBlocking();
  chrome.alarms.create('pomodoroTimer', { periodInMinutes: 1 / 60 });
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
  chrome.storage.local.get(['focusTime', 'breakTime'], (result) => {
    const focusMins = parseInt(result.focusTime) || 25;
    const breakMins = parseInt(result.breakTime) || 5;
    timerState.timeLeft = timerState.currentSession === 'focus'
      ? focusMins * 60 : breakMins * 60;
    chrome.alarms.clear('pomodoroTimer');
    stopBlocking();
    chrome.storage.local.set({ timerState });
    broadcastMessage({ action: 'timerReset' });
    notifyMusicPages && notifyMusicPages('pause');
  });
}

function handleTimerTick() {
  // console.log("Alarm triggered, timer tick"); // DEBUG
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

// -- Date Utility --
function formatDateOnly(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

// --- COMPLETE SESSION: transitions, updates, NOTIFICATION, and auto-start ---
function completeSession() {
  timerState.isRunning = false;
  chrome.alarms.clear('pomodoroTimer');
  chrome.storage.local.get(
    ['focusTime', 'breakTime', 'lastSessionDate', 'streak', 'sessionsToday'],
    (result) => {
      const today = formatDateOnly();
      const yesterday = formatDateOnly(new Date(Date.now() - 86400000));
      let newStreak = 1;
      let newToday = result.sessionsToday || 0;
      const focusMins = parseInt(result.focusTime) || 25;
      const breakMins = parseInt(result.breakTime) || 5;

      // --- SESSION SWITCH + NOTIFICATION ---
      let nextType, nextTime, nTitle, nMsg, musicState;
      if (timerState.currentSession === 'focus') {
        timerState.completedSessions++;
        if (result.lastSessionDate === today) newToday += 1;
        else newToday = 1;
        if (result.lastSessionDate === yesterday) newStreak = (result.streak || 1) + 1;
        else if (result.lastSessionDate === today) newStreak = result.streak || 1;

        // Going to break
        nextType = 'break';
        nextTime = breakMins * 60;
        nTitle = "Focus complete!";
        nMsg = "Nice work – it's break time. Enjoy a short rest, you've earned it!";
        musicState = 'pause';
        stopBlocking();
      } else {
        // Going back to focus
        nextType = 'focus';
        nextTime = focusMins * 60;
        nTitle = "Break’s over";
        nMsg = "Let's refocus and get back into your flow. Time for your next session!";
        musicState = 'play';
        // (blocking will turn on automatically when timer starts)
      }

      // Switch session and show NOTIFICATION
      timerState.currentSession = nextType;
      timerState.timeLeft = nextTime;

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png', // <-- make sure this path is correct!
        title: nTitle,
        message: nMsg
      });

      notifyMusicPages && notifyMusicPages(musicState);

      // Save updated stats and streaks
      chrome.storage.local.set({
        timerState,
        completedSessions: timerState.completedSessions,
        lastSessionDate: today,
        streak: newStreak,
        sessionsToday: newToday
      });

      broadcastMessage({ action: 'sessionComplete' });

      // === AUTO-START NEXT SESSION ===
      timerState.isRunning = true;
      chrome.alarms.create('pomodoroTimer', { periodInMinutes: 1 / 60 });
      chrome.storage.local.set({ timerState });
      if (nextType === 'focus') startBlocking();
    }
  );
}

// --- Blocklist DNR update ---
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
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
  } catch (error) {
    console.error('Error setting up blocking:', error);
  }
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
  } catch (error) {
    console.error('Error removing blocking rules:', error);
  }
}

// --- MUSIC SYNC ---
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
