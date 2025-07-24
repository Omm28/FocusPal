document.addEventListener('DOMContentLoaded', function() {
    const startBtn = document.getElementById('startBtn');
    const skipBtn = document.getElementById('skipBtn');
    const resetBtn = document.getElementById('resetBtn');
    const timerDisplay = document.getElementById('timerDisplay');
    const sessionType = document.getElementById('sessionType');
    const streakCount = document.getElementById('streakCount');
    const settingsBtn = document.getElementById('settingsBtn');
    const musicToggle = document.getElementById('musicToggle');
    const musicStatus = document.getElementById('musicStatus');
    let appState = null;

    // --- Main Button Logic ---
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

    musicToggle.addEventListener('click', () => {
        if (musicStatus.textContent === 'Off') {
            musicStatus.textContent = 'On';
            musicToggle.classList.add('active');
        } else {
            musicStatus.textContent = 'Off';
            musicToggle.classList.remove('active');
        }
    });

    // --- Sync UI with background state ---
    function refreshState() {
        chrome.runtime.sendMessage({ action: 'getState' }, updateUI);
    }

    chrome.runtime.onMessage.addListener((request) => {
        if (
            ['timerStarted', 'timerPaused', 'timerReset', 'sessionComplete', 'timerUpdate']
            .includes(request.action)
        ) {
            refreshState();
        }
    });

    function updateUI(state) {
        if (!state) return;
        appState = state;

        updateTimerDisplay(state.timeLeft);
        sessionType.textContent = state.currentSession === 'focus' ? 'Focus Session' : 'Break Time';

        // Toggle Start/Pause button icon and tooltip based on status
        if (state.isRunning) {
            startBtn.innerHTML = '<span class="btn-icon">⏸</span>';
            startBtn.title = "Pause";
        } else {
            startBtn.innerHTML = '<span class="btn-icon">▶</span>';
            startBtn.title = "Start";
        }

        streakCount.textContent = state.completedSessions || 0;
    }

    function updateTimerDisplay(timeLeft) {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    refreshState();
});
