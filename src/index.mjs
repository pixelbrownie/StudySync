// ═══════════════════════════════════════
//   STUDYSYNC — index.mjs
// ═══════════════════════════════════════

// ── STATE ──
const state = {
  page: 'home',
  assignments: [],
  mood: [],
  gpa: { courses: [] },
  attendance: { total: '', attended: '', subjects: [] },
  pomo: {
    mode: 'focus',
    durations: { focus: 25*60, short: 5*60, long: 15*60 },
    remaining: 25*60,
    running: false,
    sessions: 0,
    interval: null,
  },
  game: {
    difficulty: 'easy',
    cards: [],
    flipped: [],
    matched: [],
    moves: 0,
    timer: 0,
    timerInterval: null,
    locked: false,
  },
  spotify: '',
};

function save() {
  const toSave = {
    assignments: state.assignments,
    mood: state.mood,
    gpa: state.gpa,
    attendance: state.attendance,
    spotify: state.spotify,
    pomo: { sessions: state.pomo.sessions },
  };
  localStorage.setItem('studysync', JSON.stringify(toSave));
}

function load() {
  try {
    const raw = localStorage.getItem('studysync');
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.assignments) state.assignments = d.assignments;
    if (d.mood)        state.mood        = d.mood;
    if (d.gpa)         state.gpa         = d.gpa;
    if (d.attendance)  state.attendance  = d.attendance;
    if (d.spotify)     state.spotify     = d.spotify;
    if (d.pomo)        state.pomo.sessions = d.pomo.sessions || 0;
  } catch(e) {}
}

// ── NAV ──
function navigateTo(pageId) {
  state.page = pageId;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tabs button').forEach(b => b.classList.remove('active'));

  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');

  const btn = document.querySelector(`[data-page="${pageId}"]`);
  if (btn) btn.classList.add('active');

  // refresh views on navigate
  if (pageId === 'assignments') renderAssignments();
  if (pageId === 'gpa') renderGPACourses();
  if (pageId === 'gpa') renderAttendanceSubjects();
  if (pageId === 'game') initGame();
  if (pageId === 'home') renderMoodLog();
}

// ═══════════════════════════════════════
//   MOOD TRACKER
// ═══════════════════════════════════════
const MOODS = [
  { emoji: '😊', label: 'Great' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😐', label: 'Meh' },
  { emoji: '😔', label: 'Low' },
  { emoji: '😤', label: 'Stressed' },
  { emoji: '🤯', label: 'Overwhelmed' },
];

let selectedMood = null;

function renderMoodBtns() {
  const wrap = document.getElementById('mood-emojis');
  wrap.innerHTML = MOODS.map((m, i) => `
    <button class="mood-btn${selectedMood === i ? ' selected' : ''}" data-idx="${i}">
      <span class="emoji">${m.emoji}</span>
      <span class="label">${m.label}</span>
    </button>
  `).join('');
  wrap.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedMood = parseInt(btn.dataset.idx);
      renderMoodBtns();
    });
  });
}

function saveMood() {
  if (selectedMood === null) return;
  const note = document.getElementById('mood-note').value.trim();
  const entry = {
    id: Date.now(),
    mood: selectedMood,
    emoji: MOODS[selectedMood].emoji,
    label: MOODS[selectedMood].label,
    note,
    time: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
  };
  state.mood.unshift(entry);
  if (state.mood.length > 20) state.mood.pop();
  save();
  selectedMood = null;
  document.getElementById('mood-note').value = '';
  renderMoodBtns();
  renderMoodLog();
}

function renderMoodLog() {
  const log = document.getElementById('mood-log');
  if (!state.mood.length) {
    log.innerHTML = `<div class="empty-state"><div class="es-icon">💭</div><p>No mood entries yet.<br>How are you feeling today?</p></div>`;
    return;
  }
  log.innerHTML = state.mood.slice(0, 7).map(e => `
    <div class="mood-entry">
      <span class="me-emoji">${e.emoji}</span>
      <div>
        <div class="me-meta">${e.label} · ${e.time}</div>
        ${e.note ? `<div class="me-note">${e.note}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════
//   ASSIGNMENTS
// ═══════════════════════════════════════
function addAssignment() {
  const title    = document.getElementById('a-title').value.trim();
  const subject  = document.getElementById('a-subject').value.trim();
  const due      = document.getElementById('a-due').value;
  const priority = document.getElementById('a-priority').value;
  if (!title) return;
  state.assignments.push({
    id: Date.now(), title, subject, due, priority, done: false,
  });
  document.getElementById('a-title').value = '';
  document.getElementById('a-subject').value = '';
  document.getElementById('a-due').value = '';
  save();
  renderAssignments();
}

function toggleAssignment(id) {
  const a = state.assignments.find(x => x.id === id);
  if (a) { a.done = !a.done; save(); renderAssignments(); }
}

function deleteAssignment(id) {
  state.assignments = state.assignments.filter(x => x.id !== id);
  save(); renderAssignments();
}

function getDueBadge(due) {
  if (!due) return '';
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(due + 'T00:00:00');
  const diff = Math.round((d - now) / 86400000);
  if (diff < 0)  return `<span class="ui-badge badge-overdue">Overdue</span>`;
  if (diff === 0) return `<span class="ui-badge badge-today">Today</span>`;
  if (diff <= 3)  return `<span class="ui-badge badge-soon">In ${diff}d</span>`;
  return `<span class="ui-badge badge-later">In ${diff}d</span>`;
}

function renderAssignments() {
  const list = document.getElementById('assign-list');
  const active = state.assignments.filter(a => !a.done);
  const done   = state.assignments.filter(a => a.done);
  const sorted = [...active, ...done];

  if (!sorted.length) {
    list.innerHTML = `<div class="empty-state"><div class="es-icon">📚</div><p>No assignments yet.<br>Add one above!</p></div>`;
  } else {
    list.innerHTML = sorted.map(a => `
      <div class="assign-item priority-${a.priority}${a.done ? ' done' : ''}">
        <input type="checkbox" ${a.done ? 'checked' : ''} data-id="${a.id}">
        <div class="ai-info">
          <div class="ai-title">${a.title}</div>
          <div class="ai-meta">${a.subject || 'No subject'} · ${a.due ? new Date(a.due + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'No due date'}</div>
        </div>
        <button class="ai-del" data-del="${a.id}">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => toggleAssignment(parseInt(cb.dataset.id)));
    });
    list.querySelectorAll('.ai-del').forEach(btn => {
      btn.addEventListener('click', () => deleteAssignment(parseInt(btn.dataset.del)));
    });
  }

  // stats
  const total   = state.assignments.length;
  const pending = state.assignments.filter(a => !a.done).length;
  const overdue = state.assignments.filter(a => {
    if (a.done || !a.due) return false;
    const now = new Date(); now.setHours(0,0,0,0);
    return new Date(a.due + 'T00:00:00') < now;
  }).length;
  document.getElementById('stat-total').textContent   = total;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-overdue').textContent = overdue;

  // upcoming
  const upcomingList = document.getElementById('upcoming-list');
  const upcoming = state.assignments
    .filter(a => !a.done && a.due)
    .sort((x,y) => new Date(x.due) - new Date(y.due))
    .slice(0, 5);
  if (!upcoming.length) {
    upcomingList.innerHTML = `<div class="empty-state"><div class="es-icon">🎉</div><p>All clear! No upcoming deadlines.</p></div>`;
  } else {
    upcomingList.innerHTML = upcoming.map(a => `
      <div class="upcoming-item">
        <div class="ui-left">
          <div class="ui-name">${a.title}</div>
          <div class="ui-sub">${a.subject || 'No subject'}</div>
        </div>
        ${getDueBadge(a.due)}
      </div>
    `).join('');
  }
}

// ═══════════════════════════════════════
//   POMODORO
// ═══════════════════════════════════════
function setPomoMode(mode) {
  if (state.pomo.running) stopPomo();
  state.pomo.mode = mode;
  state.pomo.remaining = state.pomo.durations[mode];
  document.querySelectorAll('.pomo-mode-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  const colors = { focus: '#F2619C', short: '#93ABD9', long: '#EDE986' };
  document.querySelector('.pomo-ring-fill').style.stroke = colors[mode];
  updatePomoDisplay();
}

function updatePomoDisplay() {
  const total = state.pomo.durations[state.pomo.mode];
  const remaining = state.pomo.remaining;
  const m = Math.floor(remaining / 60).toString().padStart(2,'0');
  const s = (remaining % 60).toString().padStart(2,'0');
  document.getElementById('pomo-digits').textContent = `${m}:${s}`;
  const circ = 628;
  const offset = circ * (1 - remaining / total);
  document.querySelector('.pomo-ring-fill').style.strokeDashoffset = offset;

  // label
  const labels = { focus: 'Focus', short: 'Short Break', long: 'Long Break' };
  document.getElementById('pomo-label').textContent = labels[state.pomo.mode];
}

function startPomo() {
  if (state.pomo.running) return;
  state.pomo.running = true;
  document.getElementById('pomo-start').textContent = 'Pause';
  state.pomo.interval = setInterval(() => {
    state.pomo.remaining--;
    updatePomoDisplay();
    if (state.pomo.remaining <= 0) {
      clearInterval(state.pomo.interval);
      state.pomo.running = false;
      document.getElementById('pomo-start').textContent = 'Start';
      if (state.pomo.mode === 'focus') {
        state.pomo.sessions++;
        save();
        renderSessionDots();
        // auto switch to short break
        setPomoMode(state.pomo.sessions % 4 === 0 ? 'long' : 'short');
      } else {
        setPomoMode('focus');
      }
    }
  }, 1000);
}

function pausePomo() {
  clearInterval(state.pomo.interval);
  state.pomo.running = false;
  document.getElementById('pomo-start').textContent = 'Start';
}

function stopPomo() {
  clearInterval(state.pomo.interval);
  state.pomo.running = false;
  document.getElementById('pomo-start').textContent = 'Start';
  state.pomo.remaining = state.pomo.durations[state.pomo.mode];
  updatePomoDisplay();
}

function renderSessionDots() {
  const wrap = document.getElementById('session-dots');
  const count = state.pomo.sessions % 4 || (state.pomo.sessions > 0 && state.pomo.sessions % 4 === 0 ? 4 : 0);
  wrap.innerHTML = [0,1,2,3].map(i => `<div class="session-dot${i < count ? ' done' : ''}"></div>`).join('');
}

function loadSpotify() {
  const url = document.getElementById('spotify-url').value.trim();
  if (!url) return;
  state.spotify = url;
  save();
  embedSpotify(url);
}

function embedSpotify(url) {
  const wrap = document.getElementById('spotify-embed');
  // Convert spotify share URL to embed URL
  let embedUrl = url;
  if (url.includes('spotify.com') && !url.includes('embed')) {
    embedUrl = url.replace('open.spotify.com/', 'open.spotify.com/embed/');
  }
  wrap.innerHTML = `<iframe src="${embedUrl}" width="100%" height="380" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
}

// ═══════════════════════════════════════
//   GPA CALCULATOR
// ═══════════════════════════════════════
const GRADE_POINTS = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'F': 0.0,
};
const GRADE_OPTS = Object.keys(GRADE_POINTS).map(g => `<option value="${g}">${g}</option>`).join('');

function addGPACourse() {
  state.gpa.courses.push({ id: Date.now(), name: '', credits: '', grade: 'A' });
  save(); renderGPACourses();
}
function deleteGPACourse(id) {
  state.gpa.courses = state.gpa.courses.filter(c => c.id !== id);
  save(); renderGPACourses();
}

function renderGPACourses() {
  const wrap = document.getElementById('gpa-courses');
  if (!state.gpa.courses.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding:1rem"><p>No courses yet. Add one!</p></div>`;
    return;
  }
  wrap.innerHTML = state.gpa.courses.map(c => `
    <div class="gpa-course-row" data-id="${c.id}">
      <input type="text" placeholder="Course name" value="${c.name}" data-field="name">
      <input type="number" placeholder="Credits" min="1" max="6" value="${c.credits}" data-field="credits">
      <select data-field="grade">${GRADE_OPTS.replace(`value="${c.grade}"`, `value="${c.grade}" selected`)}</select>
      <button class="del-row-btn" data-del="${c.id}">✕</button>
    </div>
  `).join('');

  wrap.querySelectorAll('.gpa-course-row').forEach(row => {
    const id = parseInt(row.dataset.id);
    row.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('input', () => {
        const c = state.gpa.courses.find(x => x.id === id);
        if (c) { c[el.dataset.field] = el.value; save(); }
      });
    });
    row.querySelector('[data-del]').addEventListener('click', () => deleteGPACourse(id));
  });
}

function calcGPA() {
  let totalPoints = 0, totalCredits = 0;
  state.gpa.courses.forEach(c => {
    const cr = parseFloat(c.credits);
    const gp = GRADE_POINTS[c.grade];
    if (!isNaN(cr) && gp !== undefined) {
      totalPoints += gp * cr;
      totalCredits += cr;
    }
  });
  const gpa = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '—';
  const grade = totalCredits > 0 ? getLetterGrade(parseFloat(gpa)) : '';
  document.getElementById('gpa-value').textContent = gpa;
  document.getElementById('gpa-grade').textContent = grade;
}

function getLetterGrade(gpa) {
  if (gpa >= 3.7) return '🌟 Excellent';
  if (gpa >= 3.3) return '⭐ Great';
  if (gpa >= 3.0) return '✅ Good';
  if (gpa >= 2.7) return '📘 Above Average';
  if (gpa >= 2.0) return '📗 Satisfactory';
  return '⚠️ Needs Improvement';
}

// ═══════════════════════════════════════
//   ATTENDANCE
// ═══════════════════════════════════════
function calcAttendance() {
  const total    = parseInt(document.getElementById('att-total').value);
  const attended = parseInt(document.getElementById('att-attended').value);
  if (isNaN(total) || isNaN(attended) || total <= 0) return;
  const pct = Math.min(100, Math.round((attended / total) * 100));
  document.getElementById('att-pct').textContent = pct + '%';
  document.querySelector('.att-gauge-fill').style.width = pct + '%';
  const statusEl = document.getElementById('att-status');
  if (pct >= 75) {
    statusEl.textContent = '✅ Good standing — keep it up!';
    statusEl.className = 'att-status ok';
    document.querySelector('.att-gauge-fill').style.background = '#6ED9A0';
  } else if (pct >= 60) {
    statusEl.textContent = '⚠️ Below recommended threshold.';
    statusEl.className = 'att-status warn';
    document.querySelector('.att-gauge-fill').style.background = '#EDE986';
  } else {
    statusEl.textContent = '🚨 Critical — contact your advisor!';
    statusEl.className = 'att-status bad';
    document.querySelector('.att-gauge-fill').style.background = '#F2619C';
  }
  state.attendance.total = total;
  state.attendance.attended = attended;
  save();
}

function addAttSubject() {
  const name = document.getElementById('att-sub-name').value.trim();
  const pres = parseInt(document.getElementById('att-sub-pres').value);
  const tot  = parseInt(document.getElementById('att-sub-tot').value);
  if (!name || isNaN(pres) || isNaN(tot) || tot <= 0) return;
  state.attendance.subjects.push({
    id: Date.now(), name,
    present: pres, total: tot,
    pct: Math.round((pres/tot)*100),
  });
  document.getElementById('att-sub-name').value = '';
  document.getElementById('att-sub-pres').value = '';
  document.getElementById('att-sub-tot').value  = '';
  save(); renderAttendanceSubjects();
}

function renderAttendanceSubjects() {
  const wrap = document.getElementById('att-subject-list');
  if (!state.attendance.subjects.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding:1rem"><p>Add subjects to track individually.</p></div>`;
    return;
  }
  wrap.innerHTML = state.attendance.subjects.map(s => `
    <div class="att-subject-item">
      <span class="asi-name">${s.name}</span>
      <div class="asi-bar-wrap">
        <div class="asi-bar-fill" style="width:${s.pct}%;background:${s.pct>=75?'#6ED9A0':s.pct>=60?'#EDE986':'#F2619C'}"></div>
      </div>
      <span class="asi-pct">${s.pct}%</span>
      <button class="ai-del" data-del="${s.id}">✕</button>
    </div>
  `).join('');
  wrap.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.attendance.subjects = state.attendance.subjects.filter(x => x.id !== parseInt(btn.dataset.del));
      save(); renderAttendanceSubjects();
    });
  });
}

// ═══════════════════════════════════════
//   MEMORY GAME
// ═══════════════════════════════════════
const EMOJIS = ['🍕','🎮','🌈','🦋','🎸','🍦','🚀','🌺','🦊','🎯','🍄','🎪','🦄','🌙','⚡','🎨','🍭','🔮'];

const DIFF_CONFIG = { easy: 8, medium: 10, hard: 12 };

function initGame() {
  const count = DIFF_CONFIG[state.game.difficulty];
  const emojis = EMOJIS.slice(0, count);
  const pairs = [...emojis, ...emojis];
  // shuffle
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  if (state.game.timerInterval) clearInterval(state.game.timerInterval);
  state.game.cards   = pairs.map((e, i) => ({ id: i, emoji: e, flipped: false, matched: false }));
  state.game.flipped = [];
  state.game.matched = [];
  state.game.moves   = 0;
  state.game.timer   = 0;
  state.game.locked  = false;
  state.game.timerInterval = setInterval(() => {
    state.game.timer++;
    document.getElementById('game-timer').textContent = formatTime(state.game.timer);
  }, 1000);
  renderGame();
}

function formatTime(s) {
  const m = Math.floor(s/60).toString().padStart(2,'0');
  return `${m}:${(s%60).toString().padStart(2,'0')}`;
}

function renderGame() {
  const grid = document.getElementById('card-grid');
  grid.className = `card-grid ${state.game.difficulty}`;
  grid.innerHTML = state.game.cards.map(c => `
    <div class="mem-card${c.flipped ? ' flipped' : ''}${c.matched ? ' matched' : ''}" data-id="${c.id}">
      <div class="mem-card-inner">
        <div class="mem-back">❓</div>
        <div class="mem-front">${c.emoji}</div>
      </div>
    </div>
  `).join('');
  grid.querySelectorAll('.mem-card').forEach(el => {
    el.addEventListener('click', () => flipCard(parseInt(el.dataset.id)));
  });
  document.getElementById('game-moves').textContent = state.game.moves;
}

function flipCard(id) {
  if (state.game.locked) return;
  const card = state.game.cards[id];
  if (card.flipped || card.matched) return;
  card.flipped = true;
  state.game.flipped.push(id);
  renderGame();

  if (state.game.flipped.length === 2) {
    state.game.moves++;
    state.game.locked = true;
    const [a, b] = state.game.flipped;
    if (state.game.cards[a].emoji === state.game.cards[b].emoji) {
      state.game.cards[a].matched = true;
      state.game.cards[b].matched = true;
      state.game.matched.push(a, b);
      state.game.flipped = [];
      state.game.locked = false;
      renderGame();
      if (state.game.matched.length === state.game.cards.length) {
        clearInterval(state.game.timerInterval);
        setTimeout(() => {
          alert(`🎉 You won!\n${state.game.moves} moves · ${formatTime(state.game.timer)}`);
        }, 300);
      }
    } else {
      setTimeout(() => {
        state.game.cards[a].flipped = false;
        state.game.cards[b].flipped = false;
        state.game.flipped = [];
        state.game.locked = false;
        renderGame();
      }, 900);
    }
  }
}

// ═══════════════════════════════════════
//   BREAK POPUP
// ═══════════════════════════════════════
function showBreakPopup() {
  document.getElementById('break-popup').classList.add('show');
}
function hideBreakPopup() {
  document.getElementById('break-popup').classList.remove('show');
}

// Schedule popup every 15 minutes
setInterval(showBreakPopup, 15 * 60 * 1000);

// ═══════════════════════════════════════
//   INIT
// ═══════════════════════════════════════
function init() {
  load();

  // Nav buttons
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });

  // Home
  renderMoodBtns();
  renderMoodLog();
  document.getElementById('mood-save').addEventListener('click', saveMood);
  document.getElementById('hero-start').addEventListener('click', () => navigateTo('assignments'));

  // Assignments
  document.getElementById('add-assign').addEventListener('click', addAssignment);
  document.getElementById('a-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') addAssignment();
  });

  // Pomodoro
  updatePomoDisplay();
  renderSessionDots();
  document.querySelectorAll('.pomo-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setPomoMode(btn.dataset.mode));
  });
  document.getElementById('pomo-start').addEventListener('click', () => {
    state.pomo.running ? pausePomo() : startPomo();
  });
  document.getElementById('pomo-reset').addEventListener('click', stopPomo);
  document.getElementById('spotify-load').addEventListener('click', loadSpotify);
  if (state.spotify) {
    document.getElementById('spotify-url').value = state.spotify;
    embedSpotify(state.spotify);
  }

  // GPA
  renderGPACourses();
  document.getElementById('gpa-add').addEventListener('click', addGPACourse);
  document.getElementById('gpa-calc').addEventListener('click', calcGPA);

  // Attendance
  document.getElementById('att-calc').addEventListener('click', calcAttendance);
  document.getElementById('att-add-sub').addEventListener('click', addAttSubject);
  renderAttendanceSubjects();
  if (state.attendance.total) {
    document.getElementById('att-total').value    = state.attendance.total;
    document.getElementById('att-attended').value = state.attendance.attended;
  }

  // Game
  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.game.difficulty = btn.dataset.diff;
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      initGame();
    });
  });
  document.getElementById('new-game').addEventListener('click', initGame);
  initGame();

  // Break popup
  document.getElementById('bp-game').addEventListener('click', () => {
    hideBreakPopup(); navigateTo('game');
  });
  document.getElementById('bp-dismiss').addEventListener('click', hideBreakPopup);

  // Start on home
  navigateTo('home');
}

document.addEventListener('DOMContentLoaded', init);
