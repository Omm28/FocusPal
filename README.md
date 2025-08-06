# FocusPal

**FocusPal** is a productivity Chrome/Brave extension that helps you stay focused and overcome distractions using the Pomodoro technique. It features automated session cycling, built-in site blocking, motivational notifications, and live stats for streaks and productivity — all in a privacy-friendly, user-driven package.

---

## Features

### Pomodoro Timer  
Start, pause, skip, or reset focus and break periods. Fully configurable session lengths.

### Auto-Session Cycling  
Never manually start the next session — FocusPal cycles smoothly between focus and break for you.

### Distraction Blocking  
Automatically blocks distracting sites during focus sessions with near-instant activation and deactivation.

### Session Notifications  
Clean browser notifications pop up at the end of every session, even if the popup is closed.

### Daily Streaks & Stats  
Visualize your progress — track your streak of focused days and today’s completed sessions.

### Music Integration *(Coming Soon)*  
Focus-boosting music, with easy mute/unmute controls.

### User-Customizable  
One-click options page for editing timers, sites, and stats resets.

---

## How It Works

1. **Go to the Options Page**  
   Set your preferred focus/break durations and add distracting sites to the blocklist.

2. **Start Your Session**  
   Launch the timer from the popup. Distractions are blocked, and your streaks and stats begin tracking live.

3. **Automatic Switching**  
   When time is up, you’ll receive a motivational notification, and the extension will automatically switch to the next session (focus ↔ break).

4. **Track Progress**  
   FocusPal keeps count of your completed sessions and daily streaks to help build consistent habits.

---

## Technology

- Manifest V3 Chrome Extension (service worker-based)
- Pure JavaScript background and popup logic
- Declarative Net Request API for fast site blocking
- Chrome Storage API (local) for preferences and stats
- Chrome Notifications API for persistent alerts

---

## Getting Started

1. Clone or download this repository.
2. In Chrome/Brave, go to `chrome://extensions` (or `brave://extensions`) and enable **Developer mode**.
3. Click **"Load Unpacked"** and select the **FocusPal** folder.
4. Set your preferences, start the timer, and get productive!

---

## Motivation

FocusPal aims to provide a no-fuss, effective Pomodoro workflow: instant feedback, seamless session cycling, and a focus on real progress — not gimmicks.

---

## Project Status

- **Stable**: Timer, site blocking, ~~notifications~~, stats tracking
- **Coming Soon**: Music integration, advanced analytics
