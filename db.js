// ============================================================
// db.js – Dexie.js IndexedDB Schema & All Database Operations
// ============================================================

// ── Firebase Initialization ───────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSy...", 
  authDomain: "todom-4e20d.firebaseapp.com",
  projectId: "todom-4e20d",
  storageBucket: "todom-4e20d.appspot.com",
  messagingSenderId: "966053138399",
  appId: "1:966053138399:web:99c9fb7d98b21066fe7e6a"
};

firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();

// Enable offline persistence
firestore.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    console.error("Firebase persistence failed:", err.code);
  });

// Tracking set to ignore self-triggered sync notifications
const localCreatedOrUpdatedTaskIds = new Set();

// Helper functions for Firestore syncing
function cleanData(data) {
  const cleaned = {};
  for (const key in data) {
    if (data[key] !== undefined) {
      cleaned[key] = data[key];
    }
  }
  return cleaned;
}

function areObjectsEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }
  const keysA = Object.keys(a).filter(k => a[k] !== undefined && a[k] !== null);
  const keysB = Object.keys(b).filter(k => b[k] !== undefined && b[k] !== null);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    const valA = a[key];
    const valB = b[key];
    if (Array.isArray(valA) && Array.isArray(valB)) {
      if (valA.length !== valB.length) return false;
      for (let i = 0; i < valA.length; i++) {
        if (typeof valA[i] === 'object' && valA[i] !== null) {
          if (!areObjectsEqual(valA[i], valB[i])) return false;
        } else if (valA[i] !== valB[i]) {
          return false;
        }
      }
    } else if (typeof valA === 'object' && valA !== null && typeof valB === 'object' && valB !== null) {
      if (!areObjectsEqual(valA, valB)) return false;
    } else if (valA !== valB) {
      return false;
    }
  }
  return true;
}

async function syncToFirestore(collection, id, data) {
  try {
    await firestore.collection(collection).doc(id.toString()).set(cleanData(data));
  } catch (e) {
    console.error(`Error syncing to Firestore (${collection}:${id}):`, e);
  }
}

async function deleteFromFirestore(collection, id) {
  try {
    await firestore.collection(collection).doc(id.toString()).delete();
  } catch (e) {
    console.error(`Error deleting from Firestore (${collection}:${id}):`, e);
  }
}

async function clearFirestoreCollections() {
  const collections = ['employees', 'tasks', 'notes', 'projects', 'teams', 'labels'];
  for (const col of collections) {
    try {
      const snap = await firestore.collection(col).get();
      const batch = firestore.batch();
      let count = 0;
      snap.forEach(doc => {
        batch.delete(doc.ref);
        count++;
      });
      if (count > 0) {
        await batch.commit();
      }
    } catch (e) {
      console.error(`Error clearing Firestore collection ${col}:`, e);
    }
  }
}

async function uploadAllToFirestore(payload) {
  const collections = ['employees', 'tasks', 'notes', 'projects', 'teams', 'labels'];
  for (const col of collections) {
    const list = payload[col] || [];
    for (const doc of list) {
      if (doc && doc.id) {
        await syncToFirestore(col, doc.id, doc);
      }
    }
  }
}

// ── Notification & Badging Helpers ────────────────────────
function showLocalNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        icon: "icon-192.png"
      });
    } catch (e) {
      // Fallback to service worker showNotification on mobile device contexts
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body: body,
          icon: "icon-192.png",
          badge: "icon-192.png"
        });
      }).catch(err => {
        console.error("Local notification display failed:", err);
      });
    }
  }
}

async function updateAppBadge() {
  if (navigator.setAppBadge) {
    try {
      const counts = await getSemaforCounts();
      const total = counts.urgent + counts.soon;
      if (total > 0) {
        await navigator.setAppBadge(total);
      } else {
        await navigator.clearAppBadge();
      }
    } catch (e) {
      console.error("Failed to update app badge:", e);
    }
  }
}

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
  const insertData = { ...data, isActive: true, createdAt: now, updatedAt: now };
  const id = await db.employees.add(insertData);
  await syncToFirestore('employees', id, { ...insertData, id });
  return id;
}

async function updateEmployee(id, data) {
  const now = new Date().toISOString();
  const updateData = { ...data, updatedAt: now };
  await db.employees.update(id, updateData);
  const fullRecord = await db.employees.get(id);
  await syncToFirestore('employees', id, fullRecord);
}

async function deleteEmployee(id) {
  const tasksToUpdate = [];
  await db.transaction('rw', db.employees, db.tasks, async () => {
    await db.employees.delete(id);
    const tasks = await db.tasks.where('employeeId').equals(id).toArray();
    for (const t of tasks) {
      await db.tasks.update(t.id, { employeeId: null, updatedAt: new Date().toISOString() });
      tasksToUpdate.push(t.id);
    }
  });

  await deleteFromFirestore('employees', id);
  for (const taskId of tasksToUpdate) {
    const fullTask = await db.tasks.get(taskId);
    if (fullTask) {
      await syncToFirestore('tasks', taskId, fullTask);
    }
  }
}

// ── Labels ────────────────────────────────────────────────
async function getAllLabels() { return db.labels.toArray(); }
async function getLabel(id) { return db.labels.get(id); }
async function addLabel(data) {
  const now = new Date().toISOString();
  const insertData = { ...data, createdAt: now, updatedAt: now };
  const id = await db.labels.add(insertData);
  await syncToFirestore('labels', id, { ...insertData, id });
  return id;
}
async function updateLabel(id, data) {
  const now = new Date().toISOString();
  const updateData = { ...data, updatedAt: now };
  await db.labels.update(id, updateData);
  const fullRecord = await db.labels.get(id);
  await syncToFirestore('labels', id, fullRecord);
}
async function deleteLabel(id) {
  await db.labels.delete(id);
  await deleteFromFirestore('labels', id);
}

// ── Teams ─────────────────────────────────────────────────
async function getAllTeams() { return await db.teams.orderBy('createdAt').reverse().toArray(); }
async function getTeam(id) { return await db.teams.get(parseInt(id)); }
async function saveTeam(t) {
  const now = new Date().toISOString();
  t.updatedAt = now;
  if (t.id) {
    await db.teams.put(t);
    await syncToFirestore('teams', t.id, t);
    return t.id;
  } else {
    t.createdAt = now;
    const id = await db.teams.add(t);
    t.id = id;
    await syncToFirestore('teams', id, t);
    return id;
  }
}
async function deleteTeam(id) {
  await db.teams.delete(parseInt(id));
  await deleteFromFirestore('teams', id);
}

// ── Projects ──────────────────────────────────────────────
async function getAllProjects() {
  return db.projects.toArray();
}
async function getProject(id) {
  return db.projects.get(id);
}
async function addProject(data) {
  const now = new Date().toISOString();
  const insertData = { ...data, createdAt: now, updatedAt: now };
  const id = await db.projects.add(insertData);
  await syncToFirestore('projects', id, { ...insertData, id });
  return id;
}
async function updateProject(id, data) {
  const now = new Date().toISOString();
  const updateData = { ...data, updatedAt: now };
  await db.projects.update(id, updateData);
  const fullRecord = await db.projects.get(id);
  await syncToFirestore('projects', id, fullRecord);
}
async function deleteProject(id) {
  const tasksToUpdate = [];
  await db.transaction('rw', db.projects, db.tasks, async () => {
    await db.projects.delete(id);
    const tasks = await db.tasks.filter(t => t.projectId === id).toArray();
    for (const t of tasks) {
      await db.tasks.update(t.id, { projectId: null, updatedAt: new Date().toISOString() });
      tasksToUpdate.push(t.id);
    }
  });

  await deleteFromFirestore('projects', id);
  for (const taskId of tasksToUpdate) {
    const fullTask = await db.tasks.get(taskId);
    if (fullTask) {
      await syncToFirestore('tasks', taskId, fullTask);
    }
  }
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
  const insertData = {
    ...data,
    status: data.status || 'active',
    priority: data.priority || 'medium',
    createdAt: now,
    updatedAt: now,
    completedAt: null
  };
  const id = await db.tasks.add(insertData);
  localCreatedOrUpdatedTaskIds.add(id);
  setTimeout(() => { localCreatedOrUpdatedTaskIds.delete(id); }, 10000);
  await syncToFirestore('tasks', id, { ...insertData, id });
  await updateAppBadge();
  return id;
}

async function updateTask(id, data) {
  const now = new Date().toISOString();
  const update = { ...data, updatedAt: now };
  if (data.status === 'done' && !data.completedAt) update.completedAt = now;
  if (data.status === 'active') update.completedAt = null;
  localCreatedOrUpdatedTaskIds.add(id);
  setTimeout(() => { localCreatedOrUpdatedTaskIds.delete(id); }, 10000);
  await db.tasks.update(id, update);
  const fullRecord = await db.tasks.get(id);
  await syncToFirestore('tasks', id, fullRecord);
  await updateAppBadge();
}

async function deleteTask(id) {
  await db.tasks.delete(id);
  await deleteFromFirestore('tasks', id);
  await updateAppBadge();
}

// ── Semafor calculation ────────────────────────────────────
async function getSemaforCounts(projectId = null, year = '', month = '') {
  const now = Date.now();
  const h48 = now + 48 * 60 * 60 * 1000;
  let active = await getActiveTasks();

  if (projectId) {
    active = active.filter(t => t.projectId === projectId);
  }
  if (year || month) {
    active = active.filter(t => {
      let dateToTest = null;
      if (t.deadline) {
        dateToTest = new Date(t.deadline);
      } else if (t.createdAt) {
        dateToTest = new Date(t.createdAt);
      } else if (t.updatedAt) {
        dateToTest = new Date(t.updatedAt);
      }
      if (!dateToTest || isNaN(dateToTest.getTime())) return false;
      if (year && dateToTest.getFullYear().toString() !== year) return false;
      if (month) {
        const mStr = (dateToTest.getMonth() + 1).toString().padStart(2, '0');
        if (mStr !== month) return false;
      }
      return true;
    });
  }

  let urgent = 0, soon = 0, normal = 0;
  for (const t of active) {
    if (t.priority === 'urgent') {
      urgent++;
    } else if (t.priority === 'medium' || (t.deadline && new Date(t.deadline).getTime() <= h48)) {
      soon++;
    } else {
      normal++;
    }
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
  const insertData = { ...data, createdAt: now, updatedAt: now };
  const id = await db.notes.add(insertData);
  await syncToFirestore('notes', id, { ...insertData, id });
  return id;
}

async function updateNote(id, data) {
  const now = new Date().toISOString();
  const updateData = { ...data, updatedAt: now };
  await db.notes.update(id, updateData);
  const fullRecord = await db.notes.get(id);
  await syncToFirestore('notes', id, fullRecord);
}

async function deleteNote(id) {
  await db.notes.delete(id);
  await deleteFromFirestore('notes', id);
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
  if (!Array.isArray(payload.notes))     throw new Error('"notes" must be an array.');
  return true;
}

async function importOverwrite(payload) {
  // Clear Firestore first
  await clearFirestoreCollections();

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

  // Upload to Firestore after local transaction completes
  await uploadAllToFirestore(payload);
  await updateAppBadge();
}

async function importMerge(payload) {
  const updatedRecords = {};
  
  await db.transaction('rw', db.employees, db.tasks, db.notes, db.settings, db.projects, db.labels, db.teams, async () => {
    for (const table of ['employees', 'tasks', 'notes', 'projects', 'labels', 'teams']) {
      const incoming = payload[table] || [];
      updatedRecords[table] = [];
      for (const record of incoming) {
        const existing = await db[table].get(record.id);
        if (!existing) {
          await db[table].add(record);
          updatedRecords[table].push(record);
        } else {
          const existTs = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          const incTs   = new Date(record.updatedAt   || record.createdAt   || 0).getTime();
          if (incTs > existTs) {
            await db[table].put(record);
            updatedRecords[table].push(record);
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

  // Sync to Firestore after transaction completes
  for (const table of ['employees', 'tasks', 'notes', 'projects', 'labels', 'teams']) {
    for (const record of updatedRecords[table]) {
      await syncToFirestore(table, record.id, record);
    }
  }
  await updateAppBadge();
}

// ── Setup Firestore real-time listeners ───────────────────
function setupFirestoreListeners() {
  const collections = ['employees', 'tasks', 'notes', 'projects', 'teams', 'labels'];
  
  collections.forEach(col => {
    firestore.collection(col).onSnapshot(async (snapshot) => {
      let hasChanges = false;
      
      for (const change of snapshot.docChanges()) {
        // Ignore changes that were made locally
        if (change.doc.metadata.hasPendingWrites) continue;
        
        const docId = parseInt(change.doc.id);
        if (isNaN(docId)) continue;
        
        if (change.type === 'removed') {
          const local = await db[col].get(docId);
          if (local) {
            await db[col].delete(docId);
            hasChanges = true;
          }
        } else {
          const docData = change.doc.data();
          docData.id = docId;
          
          if (col === 'tasks' && (change.type === 'added' || change.type === 'modified')) {
            const isUrgent = docData.priority === 'urgent';
            const isSoon = docData.priority === 'medium' || (docData.deadline && new Date(docData.deadline).getTime() <= Date.now() + 48*3600*1000);
            if (docData.status !== 'done' && (isUrgent || isSoon)) {
              if (!localCreatedOrUpdatedTaskIds.has(docId)) {
                const localTask = await db.tasks.get(docId);
                // Trigger notification only if new or key fields changed compared to local Dexie
                if (!localTask || localTask.priority !== docData.priority || localTask.status !== docData.status || localTask.deadline !== docData.deadline) {
                  if ('Notification' in window && Notification.permission === 'granted') {
                    try {
                      new Notification("⚠️ Urgentní úkol v ToDoM", { body: docData.title, icon: "icon-192.png" });
                    } catch (e) {
                      if ('serviceWorker' in navigator) {
                        navigator.serviceWorker.ready.then(reg => {
                          reg.showNotification("⚠️ Urgentní úkol v ToDoM", { body: docData.title, icon: "icon-192.png" });
                        }).catch(()=>{});
                      }
                    }
                  }
                }
              }
            }
          }
          
          const local = await db[col].get(docId);
          if (local) {
            const localTs = new Date(local.updatedAt || local.createdAt || 0).getTime();
            const docTs = new Date(docData.updatedAt || docData.createdAt || 0).getTime();
            if (docTs < localTs) {
              continue;
            }
          }
          
          if (!local || !areObjectsEqual(local, docData)) {
            await db[col].put(docData);
            hasChanges = true;
          }
        }
      }
      
      if (hasChanges) {
        await updateAppBadge();
        if (typeof window.renderCurrentView === 'function') {
          window.renderCurrentView();
        }
      }
    }, (error) => {
      console.error(`Firestore snapshot error for ${col}:`, error);
    });
  });
}

setupFirestoreListeners();
