document.addEventListener('DOMContentLoaded', function() {
    const startBtn = document.getElementById('startBtn');
    const skipBtn = document.getElementById('skipBtn');
    const resetBtn = document.getElementById('resetBtn');
    const timerDisplay = document.getElementById('timerDisplay');
    const sessionType = document.getElementById('sessionType');
    const streakCount = document.getElementById('streakCount');
    const settingsBtn = document.getElementById('settingsBtn');
    const openMusicBtn = document.getElementById('openMusicBtn');
    const musicToggle = document.getElementById('musicToggle');
    const musicStatus = document.getElementById('musicStatus');

    let appState = null;
    let musicManuallyPaused = false;

    // Pomodoro controls
    startBtn.addEventListener('click', () => {
        if (appState && appState.isRunning) {
            chrome.runtime.sendMessage({ action: 'pauseTimer' }, refreshState);
        } else {
            chrome.runtime.sendMessage({ action: 'startTimer' }, refreshState);
        }
    });
    skipBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'forceSessionEnd' }, refreshState);
    });
    resetBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'resetTimer' }, refreshState);
    });
    settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
    if (openMusicBtn) {
        openMusicBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('music.html') });
        });
    }

    // Music control from popup (pause/unpause)
    if (musicToggle && musicStatus) {
        musicToggle.addEventListener('click', () => {
            musicManuallyPaused = !musicManuallyPaused;
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    if (tab.url && tab.url.includes('music.html')) {
                        chrome.tabs.sendMessage(tab.id, { music: musicManuallyPaused ? 'pause' : 'play' });
                    }
                });
            });
            musicStatus.textContent = musicManuallyPaused ? 'Play' : 'Pause';
        });
    }

    // --- Listen for background/app state and option changes ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (
            request.action === 'optionsChanged' ||
            ['timerStarted', 'timerPaused', 'timerReset', 'sessionComplete', 'timerUpdate'].includes(request.action)
        ) {
            refreshState();
        }
    });

    

    // --- Main: load the timer state or correct defaults every time popup opens ---
    function refreshState() {
        chrome.runtime.sendMessage({ action: 'getState' }, function(state) {
            // If state is fake/blank/0, recover from saved settings
            if (!state || typeof state.timeLeft !== "number" || state.timeLeft < 1) {
                chrome.storage.local.get(['focusTime', 'breakTime'], (result) => {
                    const isFocus = !state || !state.currentSession || state.currentSession === "focus";
                    const mins = isFocus
                        ? (parseInt(result.focusTime) || 25)
                        : (parseInt(result.breakTime) || 5);
                    updateTimerDisplay(mins * 60);
                    // Set UI to idle state if desired
                    sessionType.textContent = isFocus ? 'Focus Session' : 'Break Time';
                    startBtn.innerHTML = '<span class="btn-icon">▶</span>';
                    startBtn.title = "Start";
                    // Update streak count from storage
                    chrome.storage.local.get(['streak'], (res) => {
                        if (streakCount) streakCount.textContent = res.streak || 0;
                    });
                });
            } else {
                updateUI(state);
            }
        });
    }

    function updateUI(state) {
        if (!state) return;
        appState = state;
        updateTimerDisplay(state.timeLeft);
        sessionType.textContent = state.currentSession === 'focus' ? 'Focus Session' : 'Break Time';
        // Toggle Start/Pause button icon and tooltip
        if (state.isRunning) {
            startBtn.innerHTML = '<span class="btn-icon">⏸</span>';
            startBtn.title = "Pause";
        } else {
            startBtn.innerHTML = '<span class="btn-icon">▶</span>';
            startBtn.title = "Start";
        }
        // Fetch streak from storage on update
        chrome.storage.local.get(['streak'], (result) => {
            if (streakCount) streakCount.textContent = result.streak || 0;
        });
    }

    function updateTimerDisplay(timeLeft) {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // ---- Initial load ----
    refreshState();
});
