const lofiAudio = document.getElementById('lofiAudio');

// Respond to background messages to play or pause
chrome.runtime.onMessage.addListener((msg) => {
  if (!lofiAudio) return;
  if (msg && msg.music === 'play') {
    lofiAudio.play().catch(() => {}); // Chrome may require user gesture on first load
  } else if (msg && msg.music === 'pause') {
    lofiAudio.pause();
  }
});
