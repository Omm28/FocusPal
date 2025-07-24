document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('addSiteInput');
  const addBtn = document.getElementById('addSiteBtn');
  const listElem = document.getElementById('blockList');

  function siteRoot(domain) {
    return domain.replace('*://*.', '').replace('*://', '').replace('/*', '');
  }

  function patternFor(domain) {
    return [`*://${domain}/*`, `*://*.${domain}/*`];
  }

  function loadBlockList() {
    chrome.storage.local.get('blockedSites', (result) => {
      const patterns = result.blockedSites || [];
      // Extract base domains (only show one per pair)
      const uniqueRoots = [];
      patterns.forEach(pattern => {
        const rootPattern = pattern.replace('*://*.', '*://'); // Normalize wildcard to root
        if (patterns.includes(rootPattern) && !uniqueRoots.includes(rootPattern)) {
          uniqueRoots.push(rootPattern);
        }
      });
      renderList(uniqueRoots.length ? uniqueRoots : patterns); // fallback for legacy entries
    });
  }

  function renderList(basePatterns) {
    listElem.innerHTML = '';
    basePatterns.forEach((pattern, idx) => {
      const siteClean = pattern.replace('*://', '').replace('/*', '');
      const row = document.createElement('div');
      row.className = 'site-row';
      row.innerHTML = `
        <span>${siteClean}</span>
        <button data-idx="${idx}" title="Remove">&times;</button>`;
      row.querySelector('button').onclick = () => removeSite(siteClean);
      listElem.appendChild(row);
    });
  }

  function addSite() {
    const raw = input.value.trim()
      .replace(/^(https?:\/\/)?(www\.)?/, '')
      .replace(/\/.*/, '');
    if (!raw) return;
    chrome.storage.local.get('blockedSites', (result) => {
      let sites = result.blockedSites || [];
      const [base, wildcard] = patternFor(raw);
      // Only add if base not already in
      if (!sites.includes(base)) {
        sites.push(base, wildcard);
        chrome.storage.local.set({ blockedSites: sites }, loadBlockList);
        input.value = '';
      }
    });
  }

  function removeSite(domain) {
    chrome.storage.local.get('blockedSites', (result) => {
      let sites = result.blockedSites || [];
      const [base, wildcard] = patternFor(domain);
      sites = sites.filter(s => s !== base && s !== wildcard);
      chrome.storage.local.set({ blockedSites: sites }, loadBlockList);
    });
  }

  addBtn.onclick = addSite;
  input.addEventListener('keyup', e => { if (e.key === 'Enter') addSite(); });

  loadBlockList();
});
