// Data layer: everything lives in one localStorage key, versioned for future migrations.
const STORAGE_KEY = 'workout-app-data';
const SCHEMA_VERSION = 1;

function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    exercises: [],
    routines: [],
    logs: [],
    draft: null,
  };
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyState();
  try {
    const data = JSON.parse(raw);
    if (!data.schemaVersion) return emptyState();
    if (data.draft === undefined) data.draft = null;
    return data;
  } catch {
    return emptyState();
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const Store = {
  getState() {
    return load();
  },

  // Exercises
  addExercise(name, unit) {
    const state = load();
    const exercise = { id: uid(), name: name.trim(), unit: unit || 'kg', createdAt: Date.now() };
    state.exercises.push(exercise);
    save(state);
    return exercise;
  },
  updateExercise(id, updates) {
    const state = load();
    const ex = state.exercises.find((e) => e.id === id);
    if (ex) Object.assign(ex, updates);
    save(state);
    return ex;
  },
  deleteExercise(id) {
    const state = load();
    state.exercises = state.exercises.filter((e) => e.id !== id);
    state.routines.forEach((r) => {
      r.exerciseIds = r.exerciseIds.filter((eid) => eid !== id);
    });
    save(state);
  },

  // Routines
  addRoutine(name, exerciseIds) {
    const state = load();
    const routine = { id: uid(), name: name.trim(), exerciseIds: exerciseIds || [], createdAt: Date.now() };
    state.routines.push(routine);
    save(state);
    return routine;
  },
  updateRoutine(id, updates) {
    const state = load();
    const r = state.routines.find((r) => r.id === id);
    if (r) Object.assign(r, updates);
    save(state);
    return r;
  },
  deleteRoutine(id) {
    const state = load();
    state.routines = state.routines.filter((r) => r.id !== id);
    save(state);
  },

  // Logs (completed sessions)
  addLog(log) {
    const state = load();
    const entry = { id: uid(), date: Date.now(), routineId: null, entries: [], ...log };
    state.logs.push(entry);
    save(state);
    return entry;
  },
  deleteLog(id) {
    const state = load();
    state.logs = state.logs.filter((l) => l.id !== id);
    save(state);
  },

  // In-progress session draft (survives reload if the phone locks mid-workout)
  getDraft() {
    return load().draft;
  },
  saveDraft(draft) {
    const state = load();
    state.draft = draft;
    save(state);
  },
  clearDraft() {
    const state = load();
    state.draft = null;
    save(state);
  },

  // Derived helpers
  getExercise(id) {
    return load().exercises.find((e) => e.id === id);
  },
  getRoutine(id) {
    return load().routines.find((r) => r.id === id);
  },
  logsForExercise(exerciseId) {
    return load()
      .logs.filter((l) => l.entries.some((e) => e.exerciseId === exerciseId))
      .sort((a, b) => a.date - b.date);
  },
};

window.Store = Store;
