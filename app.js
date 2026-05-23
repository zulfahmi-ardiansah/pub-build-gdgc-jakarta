/* ============================================================
   HAVEN — App Logic
   State management, habit CRUD, mood matrix, breathing guide,
   hydration tracker, garden growth, analytics, tab navigation,
   and swipe detection.
   ============================================================ */

(() => {
  'use strict';

  // ===================== CONSTANTS =====================

  const STORAGE_KEY = 'haven_state';
  const TABS = ['mood', 'habits', 'breathe', 'insights'];
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

  const DEFAULT_HABITS = [
    { id: 1, name: 'Drink a glass of water', completed: false },
    { id: 2, name: '10 minutes of stretching', completed: false },
    { id: 3, name: 'Read for 15 minutes', completed: false },
    { id: 4, name: 'Take a short walk', completed: false },
    { id: 5, name: 'Practice gratitude', completed: false },
  ];

  // Mock weekly data for analytics
  const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // ===================== STATE =====================

  function getDefaultState() {
    const today = new Date().toDateString();
    return {
      mood: null,
      habits: DEFAULT_HABITS.map(h => ({ ...h })),
      hydration: 0,
      activeTab: 'mood',
      lastDate: today,
      streakDays: 0,
      weeklyData: [65, 80, 45, 90, 70, 55, 0], // mock + today
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
          const allDone = parsed.habits.length > 0 && parsed.habits.every(h => h.completed);
          const someDone = parsed.habits.some(h => h.completed);
          // Update streak
          if (allDone) {
            parsed.streakDays = (parsed.streakDays || 0) + 1;
          } else if (!someDone) {
            parsed.streakDays = 0;
          }
          // Shift weekly data
          parsed.weeklyData = [...parsed.weeklyData.slice(1), 0];
          // Reset daily
          parsed.habits.forEach(h => h.completed = false);
          parsed.hydration = 0;
          parsed.mood = null;
          parsed.lastDate = today;
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
    switchTab(state.activeTab || 'mood');
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
        saveState();
        renderMood();
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
    saveState();
    renderHabits();
    renderGarden();
  }

  function toggleHabit(id) {
    const habit = state.habits.find(h => h.id === id);
    if (!habit) return;

    habit.completed = !habit.completed;

    // Update today's weekly data
    updateTodayScore();
    saveState();
    renderHabits();
    renderGarden();

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
    updateTodayScore();
    saveState();
    renderHabits();
    renderGarden();
  }

  function updateTodayScore() {
    const total = state.habits.length;
    const done = state.habits.filter(h => h.completed).length;
    const score = total > 0 ? Math.round((done / total) * 100) : 0;
    state.weeklyData[state.weeklyData.length - 1] = score;
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
    saveState();
    renderHydration();

    // Small particle effect
    const btn = $('#btn-hydrate');
    const rect = btn.getBoundingClientRect();
    spawnParticles(rect.left + rect.width / 2, rect.top, 5, ['#34d399', '#a7f3d0', '#6ee7b7']);
  }

  function resetHydration() {
    state.hydration = 0;
    saveState();
    renderHydration();
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

  // ===================== ANALYTICS =====================

  function renderAnalytics() {
    // Streak
    const streakContainer = $('#streak-container');
    const streak = state.streakDays || 0;
    streakContainer.innerHTML = `
      <div class="streak-badge">
        <span class="streak-fire">🔥</span>
        <span class="streak-text">${streak} day${streak !== 1 ? 's' : ''} streak</span>
      </div>
    `;

    // Weekly chart
    const svg = $('#chart-svg');
    svg.innerHTML = '';

    const data = state.weeklyData || [0, 0, 0, 0, 0, 0, 0];
    const chartW = 350;
    const chartH = 160;
    const barW = 30;
    const gap = (chartW - barW * 7) / 8;
    const maxVal = 100;
    const chartTop = 15;
    const chartBottom = chartH - 25;
    const barMaxH = chartBottom - chartTop;

    data.forEach((val, i) => {
      const x = gap + i * (barW + gap);
      const barH = (val / maxVal) * barMaxH;
      const y = chartBottom - barH;

      // Bar
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('class', `chart-bar${i === 6 ? ' today' : ''}`);
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', barW);
      rect.setAttribute('height', barH);
      rect.setAttribute('rx', '4');
      rect.setAttribute('ry', '4');
      svg.appendChild(rect);

      // Value label
      if (val > 0) {
        const valText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        valText.setAttribute('class', 'chart-value');
        valText.setAttribute('x', x + barW / 2);
        valText.setAttribute('y', y - 4);
        valText.textContent = `${val}%`;
        svg.appendChild(valText);
      }

      // Day label
      const dayText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      dayText.setAttribute('class', 'chart-label');
      dayText.setAttribute('x', x + barW / 2);
      dayText.setAttribute('y', chartH - 5);
      dayText.textContent = WEEK_LABELS[i];
      svg.appendChild(dayText);
    });
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
    renderAnalytics();
  }

  function init() {
    initTabs();
    initSwipe();
    initMood();
    initHabits();
    initBreathing();
    initHydration();
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
