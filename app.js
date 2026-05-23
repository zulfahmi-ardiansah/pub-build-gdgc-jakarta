/* ============================================================
   HAVEN — App Logic
   State management, habit CRUD, mood matrix, breathing guide,
   hydration tracker, garden growth, calendar, daily stats,
   weekly insights, tab navigation, and swipe detection.
   ============================================================ */

(() => {
  'use strict';

  // ===================== CONSTANTS =====================

  const STORAGE_KEY = 'haven_state';
  const TABS = ['habits', 'mood', 'breathe', 'insights'];
  const BREATHING_PHASE_DURATION = 4000; // 4 seconds per phase
  const BREATHING_TOTAL_DURATION = 60000; // 1 minute session
  const MAX_HYDRATION = 8;

  const MOOD_CONFIG = {
    radiant: {
      emoji: '☀️',
      label: 'Radiant',
      gradient: ['#1a1a0b', '#2e2406'],
      challenge: 'Share a genuine compliment with someone today.',
      color: 'hsl(45, 93%, 58%)',
    },
    focused: {
      emoji: '🎯',
      label: 'Focused',
      gradient: ['#0b151a', '#061e2e'],
      challenge: 'Set a 25-minute deep work timer — no distractions.',
      color: 'hsl(199, 89%, 48%)',
    },
    tired: {
      emoji: '🌙',
      label: 'Tired',
      gradient: ['#140b1a', '#1a062e'],
      challenge: 'Take a 10-minute power nap or rest your eyes.',
      color: 'hsl(270, 50%, 55%)',
    },
    anxious: {
      emoji: '🌊',
      label: 'Anxious',
      gradient: ['#1a0b0b', '#2e0606'],
      challenge: 'Try the breathing exercise — 1 minute of box breathing.',
      color: 'hsl(0, 72%, 58%)',
    },
    calm: {
      emoji: '🍃',
      label: 'Calm',
      gradient: ['#0b1a16', '#062e24'],
      challenge: 'Write down 3 things you\'re grateful for right now.',
      color: 'hsl(160, 60%, 45%)',
    },
  };

  const MOOD_KEYS = Object.keys(MOOD_CONFIG);

  const DEFAULT_HABITS = [
    { id: 1, name: 'Drink a glass of water', completed: false },
    { id: 2, name: '10 minutes of stretching', completed: false },
    { id: 3, name: 'Read for 15 minutes', completed: false },
    { id: 4, name: 'Take a short walk', completed: false },
    { id: 5, name: 'Practice gratitude', completed: false },
  ];



  // ===================== HELPERS =====================

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  // ===================== STATE =====================

  function getDefaultState() {
    const today = new Date().toDateString();
    return {
      mood: null,
      habits: DEFAULT_HABITS.map(h => ({ ...h })),
      hydration: 0,
      activeTab: 'habits',
      lastDate: today,
      streakDays: 0,
      dailyHistory: {},
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Reset habits if it's a new day
        const today = new Date().toDateString();
        if (parsed.lastDate !== today) {
          // Save yesterday's summary
          const yesterdayDate = new Date();
          yesterdayDate.setDate(yesterdayDate.getDate() - 1);
          const yKey = dateKey(yesterdayDate);

          if (!parsed.dailyHistory) parsed.dailyHistory = {};
          const total = parsed.habits ? parsed.habits.length : 0;
          const done = parsed.habits ? parsed.habits.filter(h => h.completed).length : 0;
          parsed.dailyHistory[yKey] = {
            mood: parsed.mood,
            habitsCompleted: done,
            habitsTotal: total,
            hydration: parsed.hydration || 0,
            completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
          };

          const allDone = total > 0 && done === total;
          const someDone = done > 0;
          // Update streak
          if (allDone) {
            parsed.streakDays = (parsed.streakDays || 0) + 1;
          } else if (!someDone && total > 0) {
            parsed.streakDays = 0;
          }

          // Reset daily
          parsed.habits.forEach(h => h.completed = false);
          parsed.hydration = 0;
          parsed.mood = null;
          parsed.lastDate = today;
        }

        // Ensure dailyHistory exists
        if (!parsed.dailyHistory) {
          parsed.dailyHistory = {};
        }

        return parsed;
      }
    } catch (e) {
      console.warn('Haven: Failed to load state', e);
    }
    return getDefaultState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Haven: Failed to save state', e);
    }
  }

  /** Snapshot current day into dailyHistory (called on every meaningful change) */
  function snapshotToday() {
    const key = todayKey();
    const total = state.habits.length;
    const done = state.habits.filter(h => h.completed).length;
    if (!state.dailyHistory) state.dailyHistory = {};
    state.dailyHistory[key] = {
      mood: state.mood,
      habitsCompleted: done,
      habitsTotal: total,
      hydration: state.hydration,
      completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
    };
  }

  let state = loadState();

  // ===================== DOM REFS =====================

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ===================== TAB NAVIGATION =====================

  function initTabs() {
    // Bottom tab bar
    $$('.tab-bar .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Desktop nav
    $$('.desktop-nav .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Set initial tab
    switchTab(state.activeTab || 'habits');
  }

  function switchTab(tabName) {
    if (!TABS.includes(tabName)) return;

    state.activeTab = tabName;
    saveState();

    // Update bottom tab bar
    $$('.tab-bar .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update desktop nav
    $$('.desktop-nav .tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Show/hide sections (only on mobile/tablet < 1024px)
    if (window.innerWidth < 1024) {
      TABS.forEach(tab => {
        const section = $(`#section-${tab}`);
        if (section) {
          section.classList.toggle('active', tab === tabName);
        }
      });
    }

    // Render insights on switch to that tab
    if (tabName === 'insights') {
      renderCalendar();
      renderWeeklyInsights();
    }
  }

  // Handle resize — show all sections on desktop
  function handleResize() {
    if (window.innerWidth >= 1024) {
      $$('.section-panel').forEach(s => s.classList.add('active'));
    } else {
      // Re-apply tab visibility
      TABS.forEach(tab => {
        const section = $(`#section-${tab}`);
        if (section) {
          section.classList.toggle('active', tab === state.activeTab);
        }
      });
    }
  }

  // ===================== SWIPE DETECTION =====================

  function initSwipe() {
    let startX = 0;
    let startY = 0;
    const main = $('#app-main');

    main.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    main.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const diffX = endX - startX;
      const diffY = endY - startY;

      // Must be primarily horizontal swipe
      if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
        const currentIndex = TABS.indexOf(state.activeTab);
        if (diffX < 0 && currentIndex < TABS.length - 1) {
          // Swipe left → next tab
          switchTab(TABS[currentIndex + 1]);
        } else if (diffX > 0 && currentIndex > 0) {
          // Swipe right → prev tab
          switchTab(TABS[currentIndex - 1]);
        }
      }
    }, { passive: true });
  }

  // ===================== MOOD MATRIX =====================

  function initMood() {
    $$('.mood-block').forEach(block => {
      block.addEventListener('click', () => {
        const mood = block.dataset.mood;
        state.mood = mood;
        snapshotToday();
        saveState();
        renderMood();
        renderDailyStats();
        applyMoodTheme(mood);
      });
    });
  }

  function renderMood() {
    $$('.mood-block').forEach(block => {
      block.classList.toggle('selected', block.dataset.mood === state.mood);
    });

    const container = $('#mood-challenge-container');
    if (state.mood && MOOD_CONFIG[state.mood]) {
      const config = MOOD_CONFIG[state.mood];
      container.innerHTML = `
        <div class="mood-challenge">
          <strong>✨ Today's Micro-Challenge</strong>
          ${config.challenge}
        </div>
      `;
    } else {
      container.innerHTML = '';
    }
  }

  function applyMoodTheme(mood) {
    const config = MOOD_CONFIG[mood];
    if (!config) return;

    document.documentElement.style.setProperty('--bg-from', config.gradient[0]);
    document.documentElement.style.setProperty('--bg-to', config.gradient[1]);
  }

  // ===================== HABIT ENGINE =====================

  let nextHabitId = 100;

  function initHabits() {
    // Calculate next ID
    if (state.habits.length > 0) {
      nextHabitId = Math.max(...state.habits.map(h => h.id)) + 1;
    }

    // Add habit
    $('#btn-add-habit').addEventListener('click', addHabit);
    $('#habit-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addHabit();
    });
  }

  function addHabit() {
    const input = $('#habit-input');
    const name = input.value.trim();
    if (!name) return;

    state.habits.push({ id: nextHabitId++, name, completed: false });
    input.value = '';
    snapshotToday();
    saveState();
    renderHabits();
    renderGarden();
    renderDailyStats();
  }

  function toggleHabit(id) {
    const habit = state.habits.find(h => h.id === id);
    if (!habit) return;

    habit.completed = !habit.completed;

    snapshotToday();
    saveState();
    renderHabits();
    renderGarden();
    renderDailyStats();

    // Particle pop on completion
    if (habit.completed) {
      const item = document.querySelector(`[data-habit-id="${id}"]`);
      if (item) {
        const rect = item.getBoundingClientRect();
        spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    }
  }

  function deleteHabit(id) {
    state.habits = state.habits.filter(h => h.id !== id);
    snapshotToday();
    saveState();
    renderHabits();
    renderGarden();
    renderDailyStats();
  }



  function renderHabits() {
    const list = $('#habit-list');
    const total = state.habits.length;
    const done = state.habits.filter(h => h.completed).length;

    if (total === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
          <p>Add your first habit to get started!</p>
        </div>
      `;
    } else {
      list.innerHTML = state.habits.map(habit => `
        <li class="habit-item ${habit.completed ? 'completed' : ''}" data-habit-id="${habit.id}">
          <div class="habit-checkbox" onclick="window.__haven.toggleHabit(${habit.id})">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <span class="habit-name">${escapeHtml(habit.name)}</span>
          <button class="habit-delete" onclick="window.__haven.deleteHabit(${habit.id})" aria-label="Delete habit">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </li>
      `).join('');
    }

    // Progress bar
    const pct = total > 0 ? (done / total) * 100 : 0;
    $('#habit-progress-fill').style.width = `${pct}%`;
    $('#habit-progress-text').textContent = `${done} / ${total} completed`;
  }

  // ===================== DAILY STATS =====================

  function renderDailyStats() {
    const container = $('#daily-stats');
    if (!container) return;

    const total = state.habits.length;
    const done = state.habits.filter(h => h.completed).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const moodData = state.mood ? MOOD_CONFIG[state.mood] : null;
    const hydrationPct = Math.round((state.hydration / MAX_HYDRATION) * 100);

    container.innerHTML = `
      <div class="daily-stats-grid">
        <div class="stat-item stat-item--habits">
          <div class="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <div class="stat-value">${done}<span class="stat-total">/${total}</span></div>
          <div class="stat-label">Habits</div>
          <div class="stat-mini-bar">
            <div class="stat-mini-bar-fill" style="width: ${pct}%"></div>
          </div>
        </div>

        <div class="stat-item stat-item--mood">
          <div class="stat-icon stat-emoji">${moodData ? moodData.emoji : '💤'}</div>
          <div class="stat-value">${moodData ? moodData.label : '—'}</div>
          <div class="stat-label">Mood</div>
          <div class="stat-mini-bar">
            <div class="stat-mini-bar-fill stat-mini-bar-fill--mood" style="width: ${moodData ? '100' : '0'}%"></div>
          </div>
        </div>

        <div class="stat-item stat-item--hydration">
          <div class="stat-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
          </div>
          <div class="stat-value">${state.hydration}<span class="stat-total">/${MAX_HYDRATION}</span></div>
          <div class="stat-label">Glasses</div>
          <div class="stat-mini-bar">
            <div class="stat-mini-bar-fill stat-mini-bar-fill--hydration" style="width: ${hydrationPct}%"></div>
          </div>
        </div>

        <div class="stat-item stat-item--completion">
          <div class="stat-ring">
            <svg viewBox="0 0 36 36">
              <path class="stat-ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
              <path class="stat-ring-fill" stroke-dasharray="${pct}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
            </svg>
            <span class="stat-ring-text">${pct}%</span>
          </div>
          <div class="stat-label">Overall</div>
        </div>
      </div>
    `;
  }

  // ===================== BREATHING GUIDE =====================

  let breathingInterval = null;
  let breathingTimeout = null;
  let breathingActive = false;
  let breathingElapsed = 0;
  let breathingPhaseTimer = null;

  const PHASES = ['Inhale', 'Hold', 'Exhale', 'Hold'];

  function initBreathing() {
    $('#btn-breathe').addEventListener('click', toggleBreathing);
  }

  function toggleBreathing() {
    if (breathingActive) {
      stopBreathing();
    } else {
      startBreathing();
    }
  }

  function startBreathing() {
    breathingActive = true;
    breathingElapsed = 0;

    const btn = $('#btn-breathe');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" width="18" height="18"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
      Pause
    `;

    runBreathingPhase(0);

    // Session timer
    breathingInterval = setInterval(() => {
      breathingElapsed += 1000;
      updateBreathingTimer();

      if (breathingElapsed >= BREATHING_TOTAL_DURATION) {
        stopBreathing();
      }
    }, 1000);
  }

  function runBreathingPhase(phaseIndex) {
    if (!breathingActive) return;

    const circle = $('#breathing-circle');
    const label = $('#breathing-label');
    const phase = PHASES[phaseIndex % PHASES.length];

    label.textContent = phase;

    // Remove all phase classes
    circle.classList.remove('inhale', 'exhale', 'hold');

    if (phase === 'Inhale') {
      circle.classList.add('inhale');
    } else if (phase === 'Exhale') {
      circle.classList.add('exhale');
    } else {
      circle.classList.add('hold');
    }

    // Update progress ring
    updateBreathingRing();

    breathingPhaseTimer = setTimeout(() => {
      runBreathingPhase(phaseIndex + 1);
    }, BREATHING_PHASE_DURATION);
  }

  function stopBreathing() {
    breathingActive = false;
    clearInterval(breathingInterval);
    clearTimeout(breathingPhaseTimer);
    breathingInterval = null;
    breathingPhaseTimer = null;

    const circle = $('#breathing-circle');
    circle.classList.remove('inhale', 'exhale', 'hold');

    const label = $('#breathing-label');
    label.textContent = 'Tap play to begin';

    const btn = $('#btn-breathe');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="none" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Start
    `;

    // Reset timer
    breathingElapsed = 0;
    updateBreathingTimer();

    // Reset ring
    const ring = $('#breathing-ring-progress');
    ring.style.strokeDashoffset = '590.62';
  }

  function updateBreathingTimer() {
    const remaining = Math.max(0, BREATHING_TOTAL_DURATION - breathingElapsed);
    const seconds = Math.ceil(remaining / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    $('#breathing-timer').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function updateBreathingRing() {
    const ring = $('#breathing-ring-progress');
    const circumference = 590.62;
    const progress = breathingElapsed / BREATHING_TOTAL_DURATION;
    const offset = circumference * (1 - progress);
    ring.style.strokeDashoffset = offset;
  }

  // ===================== HYDRATION TRACKER =====================

  function initHydration() {
    $('#btn-hydrate').addEventListener('click', addWater);
    $('#hydration-reset').addEventListener('click', resetHydration);
  }

  function addWater() {
    if (state.hydration >= MAX_HYDRATION) return;
    state.hydration++;
    snapshotToday();
    saveState();
    renderHydration();
    renderDailyStats();

    // Small particle effect
    const btn = $('#btn-hydrate');
    const rect = btn.getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top, 5, ['#34d399', '#a7f3d0', '#6ee7b7']);
  }

  function resetHydration() {
    state.hydration = 0;
    snapshotToday();
    saveState();
    renderHydration();
    renderDailyStats();
  }

  function renderHydration() {
    const count = state.hydration;
    const pct = count / MAX_HYDRATION;
    const maxHeight = 120;
    const fillHeight = pct * maxHeight;
    const yPos = 130 - fillHeight;

    const liquid = $('#hydration-liquid');
    liquid.setAttribute('y', yPos);
    liquid.setAttribute('height', fillHeight);

    const shine = $('#hydration-shine');
    shine.setAttribute('y', yPos);
    shine.setAttribute('height', fillHeight);

    $('#hydration-count').innerHTML = `${count} <span>/ ${MAX_HYDRATION} glasses</span>`;
  }

  // ===================== GARDEN =====================

  function renderGarden() {
    const total = state.habits.length;
    const done = state.habits.filter(h => h.completed).length;
    const pct = total > 0 ? done / total : 0;

    const leavesGroup = $('#garden-leaves');
    const flowersGroup = $('#garden-flowers');
    leavesGroup.innerHTML = '';
    flowersGroup.innerHTML = '';

    // Stem grows based on completion
    const stemHeight = 90 + pct * 50;
    const stem = $('#garden-stem');
    stem.setAttribute('d', `M150 210 Q150 ${210 - stemHeight * 0.6} 150 ${210 - stemHeight}`);

    // Leaf positions
    const leafPositions = [
      { x: 150, y: 180, angle: -30, side: 'left' },
      { x: 150, y: 165, angle: 30, side: 'right' },
      { x: 150, y: 150, angle: -25, side: 'left' },
      { x: 150, y: 135, angle: 25, side: 'right' },
      { x: 150, y: 122, angle: -20, side: 'left' },
    ];

    const leavesToShow = Math.floor(pct * leafPositions.length);

    leafPositions.forEach((pos, i) => {
      const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const dx = pos.side === 'left' ? -30 : 30;
      const dy = -15;
      const cx1 = pos.side === 'left' ? -15 : 15;

      leaf.setAttribute('d', `M${pos.x},${pos.y} Q${pos.x + cx1},${pos.y + dy - 5} ${pos.x + dx},${pos.y + dy}`);
      leaf.setAttribute('fill', 'none');
      leaf.setAttribute('stroke', i < leavesToShow ? 'var(--accent-emerald)' : 'rgba(16,185,129,0.15)');
      leaf.setAttribute('stroke-width', '3');
      leaf.setAttribute('stroke-linecap', 'round');

      if (i < leavesToShow) {
        // Fill leaf shape
        const filledLeaf = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        filledLeaf.setAttribute('cx', pos.x + dx * 0.6);
        filledLeaf.setAttribute('cy', pos.y + dy * 0.6);
        filledLeaf.setAttribute('rx', '12');
        filledLeaf.setAttribute('ry', '7');
        filledLeaf.setAttribute('transform', `rotate(${pos.angle}, ${pos.x + dx * 0.6}, ${pos.y + dy * 0.6})`);
        filledLeaf.setAttribute('fill', 'var(--accent-emerald)');
        filledLeaf.setAttribute('opacity', '0.6');
        filledLeaf.classList.add('garden-leaf', 'grown');
        leavesGroup.appendChild(filledLeaf);
      }

      leavesGroup.appendChild(leaf);
    });

    // Flower at top when >= 80% done
    if (pct >= 0.8) {
      const flower = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      flower.classList.add('garden-flower', 'bloomed');

      const stemTop = 210 - stemHeight;
      const petalColors = ['var(--accent-gold)', 'var(--accent-gold-light)', 'var(--accent-emerald-light)'];

      for (let i = 0; i < 6; i++) {
        const angle = i * 60;
        const petal = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        petal.setAttribute('cx', 150);
        petal.setAttribute('cy', stemTop - 12);
        petal.setAttribute('rx', '6');
        petal.setAttribute('ry', '12');
        petal.setAttribute('fill', petalColors[i % petalColors.length]);
        petal.setAttribute('opacity', '0.7');
        petal.setAttribute('transform', `rotate(${angle}, 150, ${stemTop})`);
        flower.appendChild(petal);
      }

      // Center
      const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      center.setAttribute('cx', 150);
      center.setAttribute('cy', stemTop);
      center.setAttribute('r', '6');
      center.setAttribute('fill', 'var(--accent-gold)');
      flower.appendChild(center);

      flowersGroup.appendChild(flower);
    }

    // Label
    const label = $('#garden-label');
    if (total === 0) {
      label.textContent = 'Add habits to start growing 🌱';
    } else if (pct === 0) {
      label.textContent = 'Complete habits to grow your garden 🌱';
    } else if (pct < 0.5) {
      label.textContent = 'Your garden is sprouting! 🌿';
    } else if (pct < 1) {
      label.textContent = 'Looking beautiful! Keep going 🌸';
    } else {
      label.textContent = 'Garden in full bloom! 🌺✨';
    }
  }

  // ===================== CALENDAR =====================

  let calendarMonth = new Date().getMonth();
  let calendarYear = new Date().getFullYear();

  function initCalendar() {
    const prevBtn = $('#cal-prev');
    const nextBtn = $('#cal-next');
    if (prevBtn) prevBtn.addEventListener('click', () => { changeMonth(-1); });
    if (nextBtn) nextBtn.addEventListener('click', () => { changeMonth(1); });
  }

  function changeMonth(delta) {
    calendarMonth += delta;
    if (calendarMonth < 0) {
      calendarMonth = 11;
      calendarYear--;
    } else if (calendarMonth > 11) {
      calendarMonth = 0;
      calendarYear++;
    }
    renderCalendar();
  }

  function renderCalendar() {
    const monthLabel = $('#calendar-month-label');
    const grid = $('#calendar-grid');
    const detailEl = $('#calendar-day-detail');
    if (!monthLabel || !grid) return;

    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    monthLabel.textContent = `${months[calendarMonth]} ${calendarYear}`;

    // First day of month
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Day of week for first day (0=Sun, adjust to Mon-start)
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1; // Mon=0 ... Sun=6

    const todayStr = todayKey();
    const history = state.dailyHistory || {};

    grid.innerHTML = '';
    if (detailEl) detailEl.innerHTML = '';
    if (detailEl) detailEl.classList.remove('visible');

    // Empty cells for offset
    for (let i = 0; i < startDow; i++) {
      const empty = document.createElement('div');
      empty.className = 'calendar-cell calendar-cell--empty';
      grid.appendChild(empty);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(calendarYear, calendarMonth, day);
      const key = dateKey(d);
      const isToday = key === todayStr;
      const data = history[key];

      const cell = document.createElement('button');
      cell.className = 'calendar-cell' + (isToday ? ' calendar-cell--today' : '') + (data ? ' calendar-cell--has-data' : '');
      cell.setAttribute('data-date', key);

      let dotsHtml = '';
      if (data) {
        const dots = [];
        if (data.habitsCompleted > 0) dots.push('<span class="cal-dot cal-dot--habit"></span>');
        if (data.mood) dots.push('<span class="cal-dot cal-dot--mood"></span>');
        if (data.hydration > 0) dots.push('<span class="cal-dot cal-dot--hydration"></span>');
        dotsHtml = dots.join('');
      }
      // Also show today's live data
      if (isToday) {
        const dots = [];
        const todayDone = state.habits.filter(h => h.completed).length;
        if (todayDone > 0) dots.push('<span class="cal-dot cal-dot--habit"></span>');
        if (state.mood) dots.push('<span class="cal-dot cal-dot--mood"></span>');
        if (state.hydration > 0) dots.push('<span class="cal-dot cal-dot--hydration"></span>');
        dotsHtml = dots.join('');
      }

      cell.innerHTML = `
        <span class="cal-day-num">${day}</span>
        <div class="cal-dots">${dotsHtml}</div>
      `;

      // Click to show detail
      cell.addEventListener('click', () => showDayDetail(key, isToday));

      grid.appendChild(cell);
    }
  }

  function showDayDetail(key, isToday) {
    const detailEl = $('#calendar-day-detail');
    if (!detailEl) return;

    let data;
    if (isToday) {
      const total = state.habits.length;
      const done = state.habits.filter(h => h.completed).length;
      data = {
        mood: state.mood,
        habitsCompleted: done,
        habitsTotal: total,
        hydration: state.hydration,
        completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    } else {
      data = (state.dailyHistory || {})[key];
    }

    // Format date
    const parts = key.split('-');
    const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    if (!data) {
      detailEl.innerHTML = `
        <div class="day-detail-header">
          <span class="day-detail-date">${dateStr}</span>
          <button class="day-detail-close" aria-label="Close">✕</button>
        </div>
        <p class="day-detail-empty">No data recorded for this day</p>
      `;
    } else {
      const moodConfig = data.mood ? MOOD_CONFIG[data.mood] : null;
      detailEl.innerHTML = `
        <div class="day-detail-header">
          <span class="day-detail-date">${dateStr}${isToday ? ' <span class="day-detail-badge">Today</span>' : ''}</span>
          <button class="day-detail-close" aria-label="Close">✕</button>
        </div>
        <div class="day-detail-grid">
          <div class="day-detail-item">
            <span class="day-detail-icon">${moodConfig ? moodConfig.emoji : '💤'}</span>
            <span class="day-detail-value">${moodConfig ? moodConfig.label : 'Not logged'}</span>
            <span class="day-detail-label">Mood</span>
          </div>
          <div class="day-detail-item">
            <span class="day-detail-icon">✅</span>
            <span class="day-detail-value">${data.habitsCompleted}/${data.habitsTotal}</span>
            <span class="day-detail-label">Habits</span>
          </div>
          <div class="day-detail-item">
            <span class="day-detail-icon">💧</span>
            <span class="day-detail-value">${data.hydration}/${MAX_HYDRATION}</span>
            <span class="day-detail-label">Water</span>
          </div>
          <div class="day-detail-item">
            <span class="day-detail-icon">📊</span>
            <span class="day-detail-value">${data.completionPct}%</span>
            <span class="day-detail-label">Done</span>
          </div>
        </div>
      `;
    }

    detailEl.classList.add('visible');

    // Close button
    const closeBtn = detailEl.querySelector('.day-detail-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        detailEl.classList.remove('visible');
      });
    }

    // Highlight selected cell
    $$('.calendar-cell').forEach(c => c.classList.remove('calendar-cell--selected'));
    const selectedCell = $(`.calendar-cell[data-date="${key}"]`);
    if (selectedCell) selectedCell.classList.add('calendar-cell--selected');
  }

  // ===================== WEEKLY INSIGHTS =====================

  function renderWeeklyInsights() {
    // Streak
    const streakContainer = $('#streak-container');
    const streak = state.streakDays || 0;
    if (streakContainer) {
      streakContainer.innerHTML = `
        <div class="streak-badge">
          <span class="streak-fire">🔥</span>
          <span class="streak-text">${streak} day${streak !== 1 ? 's' : ''} streak</span>
        </div>
      `;
    }

    // Weekly summary
    const summaryContainer = $('#weekly-summary');
    if (summaryContainer) {
      const weekData = getWeekData();
      summaryContainer.innerHTML = `
        <div class="weekly-summary-grid">
          <div class="weekly-stat">
            <div class="weekly-stat-value">${weekData.totalHabitsCompleted}</div>
            <div class="weekly-stat-label">Habits Done</div>
          </div>
          <div class="weekly-stat">
            <div class="weekly-stat-value">${weekData.topMoodEmoji}</div>
            <div class="weekly-stat-label">${weekData.topMoodLabel}</div>
          </div>
          <div class="weekly-stat">
            <div class="weekly-stat-value">${weekData.avgHydration}</div>
            <div class="weekly-stat-label">Avg. Glasses</div>
          </div>
          <div class="weekly-stat">
            <div class="weekly-stat-value">${weekData.bestDayLabel}</div>
            <div class="weekly-stat-label">Best Day</div>
          </div>
        </div>
      `;
    }

    // Weekly chart — compute from dailyHistory
    const svg = $('#chart-svg');
    if (!svg) return;
    svg.innerHTML = '';

    // Build 7-day data from dailyHistory (last 7 days including today)
    const chartData = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const label = dayNames[d.getDay()];
      const isToday = i === 0;

      let val = 0;
      if (isToday) {
        const total = state.habits.length;
        const done = state.habits.filter(h => h.completed).length;
        val = total > 0 ? Math.round((done / total) * 100) : 0;
      } else {
        const entry = (state.dailyHistory || {})[key];
        if (entry) {
          val = entry.completionPct || 0;
        }
      }
      chartData.push({ label, val, isToday });
    }

    const chartW = 350;
    const chartH = 160;
    const barW = 30;
    const gap = (chartW - barW * 7) / 8;
    const maxVal = 100;
    const chartTop = 15;
    const chartBottom = chartH - 25;
    const barMaxH = chartBottom - chartTop;

    chartData.forEach((item, i) => {
      const x = gap + i * (barW + gap);
      const barH = (item.val / maxVal) * barMaxH;
      const y = chartBottom - barH;

      // Determine bar color class
      let barClass = 'chart-bar';
      if (item.isToday) {
        barClass += ' today';
      } else if (item.val >= 70) {
        barClass += ' chart-bar--high';
      } else if (item.val >= 30) {
        barClass += ' chart-bar--medium';
      } else if (item.val > 0) {
        barClass += ' chart-bar--low';
      }

      // Bar
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('class', barClass);
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', barH);
      rect.setAttribute('rx', '4');
      rect.setAttribute('ry', '4');
      svg.appendChild(rect);

      // Value label
      if (item.val > 0) {
        const valText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        valText.setAttribute('class', 'chart-value');
        valText.setAttribute('x', x + barW / 2);
        valText.setAttribute('y', y - 4);
        valText.textContent = `${item.val}%`;
        svg.appendChild(valText);
      }

      // Day label
      const dayText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      dayText.setAttribute('class', 'chart-label');
      dayText.setAttribute('x', x + barW / 2);
      dayText.setAttribute('y', chartH - 5);
      dayText.textContent = item.label;
      svg.appendChild(dayText);
    });
  }

  /** Compute weekly stats from dailyHistory */
  function getWeekData() {
    const history = state.dailyHistory || {};
    const now = new Date();
    let totalHabitsCompleted = 0;
    const moodCounts = {};
    let totalHydration = 0;
    let daysWithData = 0;
    let bestDayPct = -1;
    let bestDayIndex = -1;

    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i)); // Mon..Sun if today is Sun
      const key = dateKey(d);

      let dayData;
      if (key === todayKey()) {
        // Live data for today
        const total = state.habits.length;
        const done = state.habits.filter(h => h.completed).length;
        dayData = {
          mood: state.mood,
          habitsCompleted: done,
          habitsTotal: total,
          hydration: state.hydration,
          completionPct: total > 0 ? Math.round((done / total) * 100) : 0,
        };
      } else {
        dayData = history[key];
      }

      if (dayData) {
        daysWithData++;
        totalHabitsCompleted += dayData.habitsCompleted || 0;
        totalHydration += dayData.hydration || 0;
        if (dayData.mood) {
          moodCounts[dayData.mood] = (moodCounts[dayData.mood] || 0) + 1;
        }
        if ((dayData.completionPct || 0) > bestDayPct) {
          bestDayPct = dayData.completionPct || 0;
          bestDayIndex = i;
        }
      }
    }

    // Top mood
    let topMood = null;
    let topMoodCount = 0;
    for (const [mood, count] of Object.entries(moodCounts)) {
      if (count > topMoodCount) {
        topMoodCount = count;
        topMood = mood;
      }
    }

    const topMoodConfig = topMood ? MOOD_CONFIG[topMood] : null;
    const avgHydration = daysWithData > 0 ? (totalHydration / daysWithData).toFixed(1) : '0';
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let bestDayLabel = '—';
    if (bestDayIndex >= 0) {
      const bestDate = new Date(now);
      bestDate.setDate(bestDate.getDate() - (6 - bestDayIndex));
      bestDayLabel = dayNames[bestDate.getDay()];
    }

    return {
      totalHabitsCompleted,
      topMoodEmoji: topMoodConfig ? topMoodConfig.emoji : '—',
      topMoodLabel: topMoodConfig ? `Top: ${topMoodConfig.label}` : 'No mood data',
      avgHydration,
      bestDayLabel,
    };
  }

  // ===================== PARTICLES =====================

  function spawnParticles(x, y, count = 12, colors = null) {
    const container = $('#particle-container');
    const particleColors = colors || [
      'var(--accent-emerald)',
      'var(--accent-emerald-light)',
      'var(--accent-gold)',
      'var(--accent-gold-light)',
      '#a7f3d0',
    ];

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const distance = 30 + Math.random() * 50;
      const px = Math.cos(angle) * distance;
      const py = Math.sin(angle) * distance - 20;

      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.setProperty('--px', `${px}px`);
      particle.style.setProperty('--py', `${py}px`);
      particle.style.backgroundColor = particleColors[i % particleColors.length];
      particle.style.width = `${4 + Math.random() * 5}px`;
      particle.style.height = particle.style.width;

      container.appendChild(particle);

      // Cleanup
      setTimeout(() => particle.remove(), 750);
    }
  }

  // ===================== UTILITIES =====================

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ===================== GLOBAL API (for inline handlers) =====================

  window.__haven = {
    toggleHabit,
    deleteHabit,
  };

  // ===================== INIT =====================

  function renderAll() {
    renderMood();
    if (state.mood) applyMoodTheme(state.mood);
    renderHabits();
    renderHydration();
    renderGarden();
    renderDailyStats();
    renderCalendar();
    renderWeeklyInsights();
  }

  function init() {
    initTabs();
    initSwipe();
    initMood();
    initHabits();
    initBreathing();
    initHydration();
    initCalendar();

    // Snapshot today on init
    snapshotToday();
    saveState();

    renderAll();

    // Resize handler
    window.addEventListener('resize', handleResize);
    handleResize();
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
