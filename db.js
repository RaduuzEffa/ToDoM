// ============================================================
// db.js – Dexie.js IndexedDB Schema & All Database Operations
// ============================================================

const APP_VERSION = '1.0.0';

const db = new Dexie('ToDoM');

db.version(1).stores({
  employees: '++id, name, position, department, isActive, createdAt',
  tasks:     '++id, employeeId, title, priority, status, deadline, createdAt',
  notes:     '++id, title, createdAt, updatedAt',
  settings:  'key'
});

db.version(2).stores({
  tasks: '++id, employeeId, projectId, title, priority, status, deadline, createdAt',
  projects: '++id, name, status, createdAt'
});

db.version(3).stores({
  labels: '++id, name, color, createdAt'
});

db.version(4).stores({
  notes: '++id, projectId, title, createdAt, updatedAt'
});

db.version(5).stores({
  teams: '++id, name, createdAt'
});

// ── Default settings ──────────────────────────────────────
async function initSettings() {
  const existing = await db.settings.get('appName');
  if (!existing) {
    await db.settings.bulkPut([
      { key: 'appName',    value: 'ToDoM' },
      { key: 'ownerName',  value: 'CEO' },
      { key: 'theme',      value: 'dark' },
      { key: 'lastExport', value: null },
      { key: 'lastImport', value: null }
    ]);
  }
}

// ── Settings helpers ──────────────────────────────────────
async function getSetting(key) {
  const row = await db.settings.get(key);
  return row ? row.value : null;
}

async function setSetting(key, value) {
  await db.settings.put({ key, value });
}

// ── Employees ─────────────────────────────────────────────
async function getAllEmployees() {
  return db.employees.toArray();
}
async function getActiveEmployees() {
  return db.employees.filter(e => e.isActive !== false).toArray();
}

async function getEmployee(id) {
  return db.employees.get(id);
}

async function addEmployee(data) {
  const now = new Date().toISOString();
  return db.employees.add({ ...data, isActive: true, createdAt: now, updatedAt: now });
}

async function updateEmployee(id, data) {
  const now = new Date().toISOString();
  return db.employees.update(id, { ...data, updatedAt: now });
}

async function deleteEmployee(id) {
  await db.transaction('rw', db.employees, db.tasks, async () => {
    await db.employees.delete(id);
    // Unassign tasks from deleted employee
    const tasks = await db.tasks.where('employeeId').equals(id).toArray();
    for (const t of tasks) {
      await db.tasks.update(t.id, { employeeId: null, updatedAt: new Date().toISOString() });
    }
  });
}

// ── Labels ────────────────────────────────────────────────
async function getAllLabels() { return db.labels.toArray(); }
async function getLabel(id) { return db.labels.get(id); }
async function addLabel(data) { return db.labels.add({ ...data, createdAt: new Date().toISOString() }); }
async function updateLabel(id, data) { return db.labels.update(id, data); }
async function deleteLabel(id) {
  return db.labels.delete(id);
}

// ── Teams ─────────────────────────────────────────────────
async function getAllTeams() { return await db.teams.orderBy('createdAt').reverse().toArray(); }
async function getTeam(id) { return await db.teams.get(parseInt(id)); }
async function saveTeam(t) {
  if (t.id) { await db.teams.put(t); return t.id; }
  else { t.createdAt = new Date().toISOString(); return await db.teams.add(t); }
}
async function deleteTeam(id) { await db.teams.delete(parseInt(id)); }

// ── Projects ──────────────────────────────────────────────
async function getAllProjects() {
  return db.projects.toArray();
}
async function getProject(id) {
  return db.projects.get(id);
}
async function addProject(data) {
  const now = new Date().toISOString();
  return db.projects.add({ ...data, createdAt: now, updatedAt: now });
}
async function updateProject(id, data) {
  const now = new Date().toISOString();
  return db.projects.update(id, { ...data, updatedAt: now });
}
async function deleteProject(id) {
  await db.transaction('rw', db.projects, db.tasks, async () => {
    await db.projects.delete(id);
    const tasks = await db.tasks.filter(t => t.projectId === id).toArray();
    for (const t of tasks) {
      await db.tasks.update(t.id, { projectId: null, updatedAt: new Date().toISOString() });
    }
  });
}

// ── Tasks ─────────────────────────────────────────────────
async function getAllTasks() {
  return db.tasks.toArray();
}
async function getActiveTasks() {
  return db.tasks.filter(t => t.status !== 'done').toArray();
}

async function getTasksByEmployee(employeeId) {
  return db.tasks.where('employeeId').equals(employeeId).toArray();
}

async function getTask(id) {
  return db.tasks.get(id);
}

async function addTask(data) {
  const now = new Date().toISOString();
  return db.tasks.add({
    ...data,
    status: data.status || 'active',
    priority: data.priority || 'medium',
    createdAt: now,
    updatedAt: now,
    completedAt: null
  });
}

async function updateTask(id, data) {
  const now = new Date().toISOString();
  const update = { ...data, updatedAt: now };
  if (data.status === 'done' && !data.completedAt) update.completedAt = now;
  if (data.status === 'active') update.completedAt = null;
  return db.tasks.update(id, update);
}

async function deleteTask(id) {
  return db.tasks.delete(id);
}

// ── Semafor calculation ────────────────────────────────────
async function getSemaforCounts() {
  const now = Date.now();
  const h48 = now + 48 * 60 * 60 * 1000;
  const active = await getActiveTasks();

  let urgent = 0, soon = 0, normal = 0;
  for (const t of active) {
    if (t.priority === 'urgent') { urgent++; continue; }
    const dl = t.deadline ? new Date(t.deadline).getTime() : null;
    if (dl && dl <= h48) { soon++; }
    else { normal++; }
  }
  return { urgent, soon, normal, total: active.length };
}

// ── Notes ─────────────────────────────────────────────────
async function getAllNotes() {
  const notes = await db.notes.toArray();
  return notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function getNote(id) {
  return db.notes.get(id);
}

async function addNote(data) {
  const now = new Date().toISOString();
  return db.notes.add({ ...data, createdAt: now, updatedAt: now });
}

async function updateNote(id, data) {
  const now = new Date().toISOString();
  return db.notes.update(id, { ...data, updatedAt: now });
}

async function deleteNote(id) {
  return db.notes.delete(id);
}

// ── Export / Import ───────────────────────────────────────
async function exportAllData() {
  const [employees, tasks, notes, settings, projects, labels, teams] = await Promise.all([
    db.employees.toArray(),
    db.tasks.toArray(),
    db.notes.toArray(),
    db.settings.toArray(),
    db.projects.toArray(),
    db.labels.toArray(),
    db.teams.toArray()
  ]);

  const payload = {
    _meta: {
      appVersion: APP_VERSION,
      exportDate: new Date().toISOString(),
      recordCounts: {
        employees: employees.length,
        tasks: tasks.length,
        notes: notes.length,
        projects: projects.length,
        labels: labels.length,
        teams: teams.length
      }
    },
    employees,
    tasks,
    notes,
    settings,
    projects,
    labels,
    teams
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `todaom_zaloha_${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  await setSetting('lastExport', new Date().toISOString());
  return payload._meta;
}

function validateImportPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Soubor není validní JSON objekt.');
  const required = ['_meta', 'employees', 'tasks', 'notes'];
  for (const key of required) {
    if (!(key in payload)) throw new Error(`Chybí sekce: "${key}". Soubor je nekompatibilní.`);
  }
  if (!Array.isArray(payload.employees)) throw new Error('"employees" musí být pole.');
  if (!Array.isArray(payload.tasks))     throw new Error('"tasks" musí být pole.');
  if (!Array.isArray(payload.notes))     throw new Error('"notes" musí být pole.');
  return true;
}

async function importOverwrite(payload) {
  await db.transaction('rw', db.employees, db.tasks, db.notes, db.settings, db.projects, db.labels, db.teams, async () => {
    await Promise.all([
      db.employees.clear(),
      db.tasks.clear(),
      db.notes.clear(),
      db.settings.clear(),
      db.projects.clear(),
      db.labels.clear(),
      db.teams.clear()
    ]);
    const now = new Date().toISOString();
    await db.employees.bulkAdd(payload.employees || []);
    await db.tasks.bulkAdd(payload.tasks || []);
    await db.notes.bulkAdd(payload.notes || []);
    await db.settings.bulkAdd(payload.settings || []);
    if (payload.projects) await db.projects.bulkAdd(payload.projects);
    if (payload.labels) await db.labels.bulkAdd(payload.labels);
    if (payload.teams) await db.teams.bulkAdd(payload.teams);
    await db.settings.put({ key: 'lastImport', value: now });
  });
}

async function importMerge(payload) {
  await db.transaction('rw', db.employees, db.tasks, db.notes, db.settings, db.projects, db.labels, db.teams, async () => {
    for (const table of ['employees', 'tasks', 'notes', 'projects', 'labels', 'teams']) {
      const incoming = payload[table] || [];
      for (const record of incoming) {
        const existing = await db[table].get(record.id);
        if (!existing) {
          await db[table].add(record);
        } else {
          const existTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          const incTs   = new Date(record.updatedAt   || record.createdAt   || 0).getTime();
          if (incTs > existTs) {
            await db[table].put(record);
          }
        }
      }
    }
    // Settings – always overwrite
    for (const s of (payload.settings || [])) {
      if (s.key !== 'lastImport') await db.settings.put(s);
    }
    await db.settings.put({ key: 'lastImport', value: new Date().toISOString() });
  });
}
