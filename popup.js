document.addEventListener('DOMContentLoaded', function() {
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');
    const timerDisplay = document.getElementById('timerDisplay');
    const sessionInfo = document.getElementById('sessionInfo');
    const completedSessions = document.getElementById('completedSessions');
    const musicToggle = document.getElementById('musicToggle');
    
    let musicPlaying = false;
    
    // Load initial state
    chrome.runtime.sendMessage({ action: 'getState' }, (response) => {
        updateUI(response);
    });
    
    // Load completed sessions
    chrome.storage.local.get(['completedSessions'], (result) => {
        completedSessions.textContent = `Sessions Today: ${result.completedSessions || 0}`;
    });
    
    // Event listeners
    startBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'startTimer' });
    });
    
    pauseBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'pauseTimer' });
    });
    
    resetBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'resetTimer' });
    });
    
    musicToggle.addEventListener('click', toggleMusic);
    
    // Listen for background script messages
    chrome.runtime.onMessage.addListener((request) => {
        switch (request.action) {
            case 'timerStarted':
            case 'timerPaused':
            case 'timerReset':
            case 'sessionComplete':
                chrome.runtime.sendMessage({ action: 'getState' }, updateUI);
                break;
            case 'timerUpdate':
                updateTimerDisplay(request.timeLeft);
                break;
        }
    });
    
    function updateUI(state) {
        if (!state) return;
        
        updateTimerDisplay(state.timeLeft);
        
        if (state.isRunning) {
            startBtn.disabled = true;
            pauseBtn.disabled = false;
            sessionInfo.textContent = state.currentSession === 'focus' ? 'Focus time! 🎯' : 'Break time! ☕';
        } else {
            startBtn.disabled = false;
            pauseBtn.disabled = true;
            sessionInfo.textContent = state.currentSession === 'focus' ? 'Ready to focus' : 'Ready for break';
        }
        
        completedSessions.textContent = `Sessions Today: ${state.completedSessions}`;
    }
    
    function updateTimerDisplay(timeLeft) {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    function toggleMusic() {
        musicPlaying = !musicPlaying;
        musicToggle.textContent = musicPlaying ? '🎵 Music On' : '🎵 Music Off';
        // TODO: Implement actual music playback
    }
});
