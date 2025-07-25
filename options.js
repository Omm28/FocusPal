document.addEventListener('DOMContentLoaded', function () {
  // --- DOM elements ---
  const input = document.getElementById('addSiteInput');
  const addBtn = document.getElementById('addSiteBtn');
  const listElem = document.getElementById('blockList');
  const focusTimeInput = document.getElementById('focusTime');
  const breakTimeInput = document.getElementById('breakTime');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const sessionsTodayElem = document.getElementById('sessionsToday');
  const streakElem = document.getElementById('streakElem');

  // Defensive: Only run if options page (protect against script being run elsewhere)
  if (!input || !addBtn || !listElem || !focusTimeInput || !breakTimeInput || !saveBtn || !resetBtn) return;

  // --- Utility: Calculate block patterns & display ---
  function sitePatterns(domain) {
    return [`*://${domain}/*`, `*://*.${domain}/*`];
  }
  function extractRootDomains(patterns) {
    const rootSet = new Set();
    patterns.forEach(pattern => {
      const match = pattern.match(/^\*\:\/\/(?:\*\.)?([^\/]+)\/*/);
      if (match) rootSet.add(match[1]);
    });
    return Array.from(rootSet);
  }

  // --- Load all settings/stats ---
  function loadSettings() {
    chrome.storage.local.get([
      'blockedSites', 'focusTime', 'breakTime', 'sessionsToday', 'streak'
    ], result => {
      // Blocked sites display
      let patterns = result.blockedSites || [];
      let displayDomains = extractRootDomains(patterns);
      renderBlockList(displayDomains);

      // Timer defaults
      focusTimeInput.value = result.focusTime || 25;
      breakTimeInput.value = result.breakTime || 5;

      // Stats
      if (sessionsTodayElem) sessionsTodayElem.textContent = result.sessionsToday || 0;
      if (streakElem) streakElem.textContent = result.streak || 0;
    });
  }

  function renderBlockList(domainList) {
    listElem.innerHTML = '';
    domainList.forEach(domain => {
      const row = document.createElement('div');
      row.className = 'site-row';
      row.innerHTML = `<span>${domain}</span>
        <button title="Remove">&times;</button>`;
      row.querySelector('button').onclick = () => removeSite(domain);
      listElem.appendChild(row);
    });
  }

  function addSite() {
    const raw = input.value.trim()
      .replace(/^(https?:\/\/)?(www\.)?/i, '')
      .replace(/\/.*/, '');
    if (!raw) return;
    chrome.storage.local.get('blockedSites', (result) => {
      let sites = result.blockedSites || [];
      const [base, wildcard] = sitePatterns(raw);
      if (!sites.includes(base) && !sites.includes(wildcard)) {
        sites.push(base, wildcard);
        chrome.storage.local.set({ blockedSites: sites }, loadSettings);
        input.value = '';
      }
    });
  }

  function removeSite(domain) {
    chrome.storage.local.get('blockedSites', (result) => {
      let sites = result.blockedSites || [];
      const [base, wildcard] = sitePatterns(domain);
      sites = sites.filter(s => s !== base && s !== wildcard);
      chrome.storage.local.set({ blockedSites: sites }, loadSettings);
    });
  }

  // ---- SAVE button: Update timer prefs and notify background/popup if idle
  saveBtn.onclick = () => {
    const focusTime = parseInt(focusTimeInput.value) || 25;
    const breakTime = parseInt(breakTimeInput.value) || 5;
    chrome.storage.local.set({ focusTime, breakTime }, () => {
      saveBtn.textContent = "Saved!";
      saveBtn.disabled = true;
      setTimeout(() => {
        saveBtn.textContent = "Save";
        saveBtn.disabled = false;
      }, 1100);
      // Notify background to update timer if idle, and popup to refresh display
      chrome.runtime.sendMessage({ action: 'timerSettingsChanged' });
      chrome.runtime.sendMessage({ action: 'optionsChanged' });
    });
  };

  // ---- RESET: Defaults for everything ----
  resetBtn.onclick = () => {
    if (!confirm('Reset all FocusPal settings, blocklist, and streak?')) return;
    chrome.storage.local.set({
      blockedSites: [],
      focusTime: 25,
      breakTime: 5,
      sessionsToday: 0,
      streak: 0,
      lastSessionDate: null
    }, loadSettings);
    // Notify background/popup for instant feedback
    chrome.runtime.sendMessage({ action: 'timerSettingsChanged' });
    chrome.runtime.sendMessage({ action: 'optionsChanged' });
  };

  // --- Add site handlers
  addBtn.onclick = addSite;
  input.addEventListener('keyup', e => { if (e.key === 'Enter') addSite(); });

  loadSettings();
});
