// Router + view rendering. Every view fully re-renders #view from state on
// each change (simple, no diffing needed at this app's scale).

const viewEl = document.getElementById('view');
let restDuration = 90; // in-session rest timer preset, seconds

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function fmtDateTime(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function setActiveTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
}

// ---------- Router ----------
function router() {
  const hash = location.hash.replace(/^#\//, '') || 'today';
  const parts = hash.split('/');
  setActiveTab(parts[0]);

  if (parts[0] === 'today') return renderToday();
  if (parts[0] === 'session') return renderSession(parts[1] || null);
  if (parts[0] === 'routines') {
    if (parts[1] === 'new') return renderRoutineEditor(null);
    if (parts[1] && parts[2] === 'edit') return renderRoutineEditor(parts[1]);
    return renderRoutines();
  }
  if (parts[0] === 'exercises') return renderExercises();
  if (parts[0] === 'history') {
    if (parts[1]) return renderHistoryDetail(parts[1]);
    return renderHistory();
  }
  if (parts[0] === 'progress') {
    if (parts[1]) return renderProgressDetail(parts[1]);
    return renderProgressList();
  }
  return renderToday();
}

window.addEventListener('hashchange', router);
document.addEventListener('DOMContentLoaded', () => {
  if (!location.hash) {
    location.hash = '#/today';
  } else {
    router();
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}

// ---------- Today ----------
function renderToday() {
  const state = Store.getState();
  const draft = Store.getDraft();

  viewEl.innerHTML = `
    <h1>Today</h1>
    ${
      draft
        ? `<a href="#/session" class="card" style="border-color:var(--accent)">
      <strong>&#9654; Resume Workout</strong>
      <p style="margin:4px 0 0">You have a workout in progress.</p>
    </a>`
        : ''
    }
    <div class="card">
      <h2>Freestyle</h2>
      <p>Log an ad-hoc session, adding exercises as you go.</p>
      <button class="btn" data-action="start-freestyle">Start Workout</button>
    </div>
    <h2 class="section-gap">Routines</h2>
    ${
      state.routines.length === 0
        ? `<p class="empty-state">No routines yet. <a href="#/routines/new">Create one</a>.</p>`
        : state.routines
            .map(
              (r) => `
      <div class="card">
        <div class="row-between"><strong>${escapeHtml(r.name)}</strong><span class="badge">${r.exerciseIds.length} exercises</span></div>
        <button class="btn" style="margin-top:10px" data-action="start-routine" data-id="${r.id}">Start</button>
      </div>`
            )
            .join('')
    }
  `;

  const freestyleBtn = viewEl.querySelector('[data-action="start-freestyle"]');
  if (freestyleBtn) {
    freestyleBtn.addEventListener('click', () => {
      if (Store.getDraft() && !confirm('You have a workout in progress. Discard it and start a new freestyle session?')) return;
      Store.clearDraft();
      RestTimer.reset();
      location.hash = '#/session';
    });
  }
  viewEl.querySelectorAll('[data-action="start-routine"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (Store.getDraft() && !confirm('You have a workout in progress. Discard it and start this routine?')) return;
      Store.clearDraft();
      RestTimer.reset();
      location.hash = '#/session/' + btn.dataset.id;
    });
  });
}

// ---------- Active Session ----------
function renderSession(routineIdParam) {
  let draft = Store.getDraft();
  if (!draft) {
    const routine = routineIdParam ? Store.getRoutine(routineIdParam) : null;
    draft = {
      routineId: routine ? routine.id : null,
      routineName: routine ? routine.name : null,
      startedAt: Date.now(),
      entries: (routine ? routine.exerciseIds : []).map((id) => ({ exerciseId: id, sets: [] })),
    };
    Store.saveDraft(draft);
  }
  paintSession(draft);
}

function paintSession(draft) {
  const state = Store.getState();
  const exercisesById = Object.fromEntries(state.exercises.map((e) => [e.id, e]));
  const addedIds = draft.entries.map((e) => e.exerciseId);
  const available = state.exercises.filter((e) => !addedIds.includes(e.id));

  let html = `<div class="top-bar"><a href="#/today" class="back">&larr; Today</a></div>
    <h1>${draft.routineName ? escapeHtml(draft.routineName) : 'Freestyle Workout'}</h1>
    <div id="timer-widget"></div>`;

  draft.entries.forEach((entry, idx) => {
    const ex = exercisesById[entry.exerciseId];
    if (!ex) return;
    html += `<div class="card">
      <div class="row-between"><h2>${escapeHtml(ex.name)}</h2><button class="btn-icon btn-secondary" data-action="remove-exercise" data-idx="${idx}">&#10005;</button></div>`;
    entry.sets.forEach((set, sidx) => {
      html += `<div class="set-row">
        <div class="set-num">${sidx + 1}</div>
        <input type="number" inputmode="decimal" placeholder="Reps" value="${escapeHtml(set.reps)}" data-action="update-set" data-idx="${idx}" data-sidx="${sidx}" data-field="reps" />
        <input type="number" inputmode="decimal" placeholder="${ex.unit}" value="${escapeHtml(set.weight)}" data-action="update-set" data-idx="${idx}" data-sidx="${sidx}" data-field="weight" />
        <button class="btn-icon ${set.done ? 'btn' : 'btn-secondary'}" data-action="toggle-set" data-idx="${idx}" data-sidx="${sidx}">${set.done ? '&#10003;' : '&#9675;'}</button>
      </div>`;
    });
    html += `<button class="btn btn-secondary btn-sm" data-action="add-set" data-idx="${idx}">+ Add Set</button>
    </div>`;
  });

  html += `<div class="card">
    <h2>Add Exercise</h2>
    ${
      state.exercises.length === 0
        ? `<p>No exercises yet. <a href="#/exercises">Add some</a> first.</p>`
        : available.length === 0
          ? `<p class="text-dim">All your exercises are added.</p>`
          : `<div class="row">
        <select id="exercise-picker">${available.map((e) => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('')}</select>
        <button class="btn btn-sm" data-action="add-exercise">Add</button>
      </div>`
    }
  </div>
  <button class="btn section-gap" data-action="finish-session">Finish Workout</button>
  <button class="btn btn-secondary" style="margin-top:8px" data-action="discard-session">Discard</button>`;

  viewEl.innerHTML = html;
  renderTimerWidget();
  wireSessionEvents(draft);
}

function wireSessionEvents(draft) {
  viewEl.querySelectorAll('input[data-action="update-set"]').forEach((inp) => {
    inp.addEventListener('input', () => {
      const idx = +inp.dataset.idx;
      const sidx = +inp.dataset.sidx;
      const field = inp.dataset.field;
      draft.entries[idx].sets[sidx][field] = inp.value;
      Store.saveDraft(draft);
    });
  });

  const on = (selector, handler) => {
    viewEl.querySelectorAll(selector).forEach((elm) => elm.addEventListener('click', handler));
  };

  on('[data-action="remove-exercise"]', (e) => {
    const idx = +e.currentTarget.dataset.idx;
    draft.entries.splice(idx, 1);
    Store.saveDraft(draft);
    paintSession(draft);
  });

  on('[data-action="add-set"]', (e) => {
    const idx = +e.currentTarget.dataset.idx;
    draft.entries[idx].sets.push({ reps: '', weight: '', done: false });
    Store.saveDraft(draft);
    paintSession(draft);
  });

  on('[data-action="toggle-set"]', (e) => {
    const idx = +e.currentTarget.dataset.idx;
    const sidx = +e.currentTarget.dataset.sidx;
    const set = draft.entries[idx].sets[sidx];
    set.done = !set.done;
    Store.saveDraft(draft);
    if (set.done) startRestTimer();
    paintSession(draft);
  });

  const addExBtn = viewEl.querySelector('[data-action="add-exercise"]');
  if (addExBtn) {
    addExBtn.addEventListener('click', () => {
      const select = document.getElementById('exercise-picker');
      if (!select || !select.value) return;
      draft.entries.push({ exerciseId: select.value, sets: [] });
      Store.saveDraft(draft);
      paintSession(draft);
    });
  }

  on('[data-action="finish-session"]', () => finishSession(draft));

  on('[data-action="discard-session"]', () => {
    if (confirm('Discard this workout? This cannot be undone.')) {
      Store.clearDraft();
      RestTimer.reset();
      location.hash = '#/today';
    }
  });
}

function finishSession(draft) {
  const cleaned = draft.entries
    .map((e) => ({
      exerciseId: e.exerciseId,
      sets: e.sets
        .filter((s) => s.reps !== '' || s.weight !== '')
        .map((s) => ({ reps: Number(s.reps) || 0, weight: Number(s.weight) || 0 })),
    }))
    .filter((e) => e.sets.length > 0);

  if (cleaned.length === 0 && !confirm('No sets logged. Finish anyway?')) return;

  Store.addLog({ date: draft.startedAt, routineId: draft.routineId, entries: cleaned });
  Store.clearDraft();
  RestTimer.reset();
  location.hash = '#/history';
}

// ---------- Rest timer widget (lives inside the session view) ----------
function renderTimerWidget() {
  const widget = document.getElementById('timer-widget');
  if (!widget) return;
  const running = RestTimer.isRunning();
  const rawRemaining = RestTimer.getRemaining();
  const displaySeconds = rawRemaining > 0 ? rawRemaining : restDuration;
  const pct = rawRemaining > 0 ? Math.round((rawRemaining / restDuration) * 100) : 100;

  widget.innerHTML = `
    <div class="card">
      <div class="preset-row">
        <button class="btn-sm btn-secondary${restDuration === 60 ? ' active' : ''}" data-preset="60">60s</button>
        <button class="btn-sm btn-secondary${restDuration === 90 ? ' active' : ''}" data-preset="90">90s</button>
        <button class="btn-sm btn-secondary${restDuration === 120 ? ' active' : ''}" data-preset="120">120s</button>
      </div>
      <div class="timer-ring" id="timer-ring" style="--pct:${pct}">
        <div class="timer-display" id="timer-display">${formatTime(displaySeconds)}</div>
      </div>
      <div class="row">
        <button class="btn btn-secondary btn-sm" id="timer-toggle">${running ? 'Pause' : rawRemaining > 0 ? 'Resume' : 'Start Rest'}</button>
        <button class="btn btn-secondary btn-sm" id="timer-reset">Reset</button>
      </div>
    </div>`;

  widget.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      restDuration = +btn.dataset.preset;
      RestTimer.reset();
      renderTimerWidget();
    });
  });

  const toggleBtn = document.getElementById('timer-toggle');
  toggleBtn.addEventListener('click', () => {
    if (RestTimer.isRunning()) {
      RestTimer.pause();
      renderTimerWidget();
    } else if (RestTimer.getRemaining() > 0) {
      RestTimer.resume();
      renderTimerWidget();
    } else {
      startRestTimer();
    }
  });

  document.getElementById('timer-reset').addEventListener('click', () => {
    RestTimer.reset();
    renderTimerWidget();
  });
}

function startRestTimer() {
  const total = restDuration;
  RestTimer.start(total, {
    onTick: (remaining) => {
      const display = document.getElementById('timer-display');
      if (display) display.textContent = formatTime(remaining);
      const ring = document.getElementById('timer-ring');
      if (ring) ring.style.setProperty('--pct', Math.round((remaining / total) * 100));
    },
    onDone: () => {
      const display = document.getElementById('timer-display');
      if (display) display.classList.add('done');
      const ring = document.getElementById('timer-ring');
      if (ring) ring.style.setProperty('--pct', 0);
      const toggleBtn = document.getElementById('timer-toggle');
      if (toggleBtn) toggleBtn.textContent = 'Start Rest';
    },
  });
  renderTimerWidget();
}

// ---------- Routines ----------
function renderRoutines() {
  const state = Store.getState();
  viewEl.innerHTML = `
    <h1>Routines</h1>
    <button class="btn" data-action="new-routine">+ New Routine</button>
    <div class="section-gap">
      ${
        state.routines.length === 0
          ? '<p class="empty-state">No routines yet.</p>'
          : state.routines
              .map(
                (r) => `
        <div class="card">
          <div class="row-between"><strong>${escapeHtml(r.name)}</strong><span class="badge">${r.exerciseIds.length} exercises</span></div>
          <div class="row" style="margin-top:10px">
            <button class="btn btn-sm" data-action="start-routine" data-id="${r.id}">Start</button>
            <button class="btn btn-sm btn-secondary" data-action="edit-routine" data-id="${r.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-action="delete-routine" data-id="${r.id}">Delete</button>
          </div>
        </div>`
              )
              .join('')
      }
    </div>
  `;

  viewEl.querySelector('[data-action="new-routine"]').addEventListener('click', () => {
    location.hash = '#/routines/new';
  });
  viewEl.querySelectorAll('[data-action="start-routine"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (Store.getDraft() && !confirm('You have a workout in progress. Discard it and start this routine?')) return;
      Store.clearDraft();
      RestTimer.reset();
      location.hash = '#/session/' + btn.dataset.id;
    });
  });
  viewEl.querySelectorAll('[data-action="edit-routine"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      location.hash = '#/routines/' + btn.dataset.id + '/edit';
    });
  });
  viewEl.querySelectorAll('[data-action="delete-routine"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this routine?')) {
        Store.deleteRoutine(btn.dataset.id);
        renderRoutines();
      }
    });
  });
}

function renderRoutineEditor(routineId) {
  const routine = routineId ? Store.getRoutine(routineId) : null;
  if (routineId && !routine) {
    location.hash = '#/routines';
    return;
  }
  let selected = routine ? [...routine.exerciseIds] : [];
  let nameValue = routine ? routine.name : '';

  function paint() {
    const state = Store.getState();
    viewEl.innerHTML = `
      <div class="top-bar"><a href="#/routines" class="back">&larr; Routines</a></div>
      <h1>${routine ? 'Edit Routine' : 'New Routine'}</h1>
      <div class="card">
        <label class="text-dim">Name</label>
        <input id="routine-name" type="text" value="${escapeHtml(nameValue)}" placeholder="e.g. Push Day" />
      </div>
      <div class="card">
        <h2>Exercises</h2>
        ${
          state.exercises.length === 0
            ? '<p>No exercises yet. <a href="#/exercises">Add some</a> first.</p>'
            : `<div class="chip-list">${state.exercises
                .map(
                  (e) =>
                    `<button class="chip ${selected.includes(e.id) ? 'selected' : ''}" data-id="${e.id}" data-action="toggle-chip">${escapeHtml(e.name)}</button>`
                )
                .join('')}</div>`
        }
      </div>
      <button class="btn" data-action="save-routine">Save Routine</button>
      ${routine ? `<button class="btn btn-danger" style="margin-top:8px" data-action="delete-routine">Delete Routine</button>` : ''}
    `;
    wire();
  }

  function wire() {
    const nameInput = document.getElementById('routine-name');
    nameInput.addEventListener('input', () => {
      nameValue = nameInput.value;
    });

    viewEl.querySelectorAll('[data-action="toggle-chip"]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.id;
        selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
        paint();
      });
    });

    viewEl.querySelector('[data-action="save-routine"]').addEventListener('click', () => {
      const name = nameValue.trim();
      if (!name) {
        alert('Please enter a name.');
        return;
      }
      if (routine) {
        Store.updateRoutine(routine.id, { name, exerciseIds: selected });
      } else {
        Store.addRoutine(name, selected);
      }
      location.hash = '#/routines';
    });

    const delBtn = viewEl.querySelector('[data-action="delete-routine"]');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        if (confirm('Delete this routine?')) {
          Store.deleteRoutine(routine.id);
          location.hash = '#/routines';
        }
      });
    }
  }

  paint();
}

// ---------- Exercises ----------
function renderExercises() {
  function paint() {
    const state = Store.getState();
    viewEl.innerHTML = `
      <h1>Exercises</h1>
      <div class="card">
        <div class="row">
          <input id="ex-name" type="text" placeholder="Exercise name" />
          <select id="ex-unit"><option value="kg">kg</option><option value="lb">lb</option></select>
        </div>
        <button class="btn" style="margin-top:8px" data-action="add-exercise-form">Add Exercise</button>
      </div>
      <div class="section-gap">
        ${
          state.exercises.length === 0
            ? '<p class="empty-state">No exercises yet. Add your first one above.</p>'
            : state.exercises
                .map(
                  (ex) => `
          <div class="list-item">
            <div><strong>${escapeHtml(ex.name)}</strong> <span class="badge">${ex.unit}</span></div>
            <div class="row">
              <button class="btn-icon btn-secondary" data-action="edit-exercise" data-id="${ex.id}">&#9998;</button>
              <button class="btn-icon btn-secondary" data-action="delete-exercise" data-id="${ex.id}">&#128465;</button>
            </div>
          </div>`
                )
                .join('')
        }
      </div>
    `;
    wire();
  }

  function wire() {
    viewEl.querySelector('[data-action="add-exercise-form"]').addEventListener('click', () => {
      const nameInput = document.getElementById('ex-name');
      const unitSelect = document.getElementById('ex-unit');
      const name = nameInput.value.trim();
      if (!name) return;
      Store.addExercise(name, unitSelect.value);
      paint();
    });

    viewEl.querySelectorAll('[data-action="delete-exercise"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this exercise? It will be removed from any routines.')) {
          Store.deleteExercise(btn.dataset.id);
          paint();
        }
      });
    });

    viewEl.querySelectorAll('[data-action="edit-exercise"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const ex = Store.getExercise(btn.dataset.id);
        const newName = prompt('Rename exercise', ex.name);
        if (newName && newName.trim()) {
          Store.updateExercise(ex.id, { name: newName.trim() });
          paint();
        }
      });
    });
  }

  paint();
}

// ---------- History ----------
function renderHistory() {
  const state = Store.getState();
  const logs = [...state.logs].sort((a, b) => b.date - a.date);

  viewEl.innerHTML = `
    <h1>History</h1>
    ${
      logs.length === 0
        ? '<p class="empty-state">No workouts logged yet.</p>'
        : logs
            .map((log) => {
              const routine = log.routineId ? Store.getRoutine(log.routineId) : null;
              const totalSets = log.entries.reduce((sum, e) => sum + e.sets.length, 0);
              return `<a href="#/history/${log.id}" class="card">
          <div class="row-between">
            <strong>${routine ? escapeHtml(routine.name) : 'Freestyle Workout'}</strong>
            <span class="text-dim">${fmtDate(log.date)}</span>
          </div>
          <p style="margin:4px 0 0">${log.entries.length} exercises &middot; ${totalSets} sets</p>
        </a>`;
            })
            .join('')
    }
  `;
}

function renderHistoryDetail(id) {
  const state = Store.getState();
  const log = state.logs.find((l) => l.id === id);
  if (!log) {
    location.hash = '#/history';
    return;
  }
  const routine = log.routineId ? Store.getRoutine(log.routineId) : null;

  viewEl.innerHTML = `
    <div class="top-bar"><a href="#/history" class="back">&larr; History</a></div>
    <h1>${routine ? escapeHtml(routine.name) : 'Freestyle Workout'}</h1>
    <p class="text-dim">${fmtDateTime(log.date)}</p>
    ${log.entries
      .map((entry) => {
        const ex = Store.getExercise(entry.exerciseId);
        return `<div class="card">
        <h2>${ex ? escapeHtml(ex.name) : 'Deleted exercise'}</h2>
        ${entry.sets
          .map(
            (s, i) =>
              `<div class="row-between"><span class="text-dim">Set ${i + 1}</span><span>${s.reps} reps &times; ${s.weight}${ex ? ex.unit : ''}</span></div>`
          )
          .join('')}
      </div>`;
      })
      .join('')}
    <button class="btn btn-danger section-gap" data-action="delete-log">Delete Workout</button>
  `;

  viewEl.querySelector('[data-action="delete-log"]').addEventListener('click', () => {
    if (confirm('Delete this workout from history?')) {
      Store.deleteLog(log.id);
      location.hash = '#/history';
    }
  });
}

// ---------- Progress ----------
function renderProgressList() {
  const state = Store.getState();
  viewEl.innerHTML = `
    <h1>Progress</h1>
    ${
      state.exercises.length === 0
        ? '<p class="empty-state">Add exercises and log workouts to see progress.</p>'
        : state.exercises
            .map(
              (ex) => `
      <a href="#/progress/${ex.id}" class="card">
        <div class="row-between"><strong>${escapeHtml(ex.name)}</strong><span class="text-dim">&rsaquo;</span></div>
      </a>`
            )
            .join('')
    }
  `;
}

function renderProgressDetail(id) {
  const ex = Store.getExercise(id);
  if (!ex) {
    location.hash = '#/progress';
    return;
  }
  const logs = Store.logsForExercise(id);
  const points = logs.map((log) => {
    const entry = log.entries.find((e) => e.exerciseId === id);
    const topSet = entry.sets.reduce((max, s) => (s.weight > max ? s.weight : max), 0);
    return { x: fmtDate(log.date), y: topSet };
  });
  const best = points.reduce((max, p) => (p.y > max ? p.y : max), 0);

  viewEl.innerHTML = `
    <div class="top-bar"><a href="#/progress" class="back">&larr; Progress</a></div>
    <h1>${escapeHtml(ex.name)}</h1>
    <div class="card">
      <h2>Top set weight (${ex.unit})</h2>
      ${Charts.lineChart(points)}
    </div>
    <div class="card">
      <div class="row-between"><span class="text-dim">Personal best</span><strong>${best} ${ex.unit}</strong></div>
      <div class="row-between"><span class="text-dim">Sessions logged</span><strong>${logs.length}</strong></div>
    </div>
  `;
}
