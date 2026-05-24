/* ============================================================
   ToDoM – Main Application Logic
   ============================================================ */

const DOM = {
  views: document.querySelectorAll('.view'),
  navItems: document.querySelectorAll('.nav-item'),
  headerTitle: document.getElementById('header-title'),
  headerSub: document.getElementById('header-sub'),
  fab: document.getElementById('fab'),
  toastContainer: document.getElementById('toast-container'),
  
  // Dashboard
  semaforGrid: document.getElementById('semafor-grid'),
  countUrgent: document.getElementById('count-urgent'),
  countSoon: document.getElementById('count-soon'),
  countNormal: document.getElementById('count-normal'),
  dashboardTasks: document.getElementById('dashboard-tasks'),
  dashboardNotes: document.getElementById('dashboard-notes'),
  urgentDot: document.getElementById('urgent-dot'),
  dashPrev: document.getElementById('dash-prev'),
  dashNext: document.getElementById('dash-next'),
  dashPageInfo: document.getElementById('dash-page-info'),
  
  // Tasks
  kanbanActive: document.getElementById('kanban-active'),
  kanbanInProgress: document.getElementById('kanban-in-progress'),
  kanbanDone: document.getElementById('kanban-done'),
  countActive: document.getElementById('count-col-active'),
  countInProgress: document.getElementById('count-col-in-progress'),
  countDone: document.getElementById('count-col-done'),
  taskSearch: document.getElementById('task-search'),
  taskFilters: document.querySelectorAll('#task-filters .filter-chip'),
  taskFilterEmp: document.getElementById('task-filter-emp'),
  
  // Employees
  empList: document.getElementById('employees-list'),
  empSearch: document.getElementById('emp-search'),
  empFilters: document.querySelectorAll('#view-employees .filter-chip'),
  
  // Projects
  projList: document.getElementById('projects-list'),
  projSearch: document.getElementById('proj-search'),

  // Notes
  notesList: document.getElementById('notes-list'),
  noteSearch: document.getElementById('note-search'),
  
  // Sync
  btnExport: document.getElementById('btn-export'),
  btnImportTrigger: document.getElementById('btn-import-trigger'),
  importFileInput: document.getElementById('import-file-input'),
  importFileInfo: document.getElementById('import-file-info'),
  btnImportConfirm: document.getElementById('btn-import-confirm'),
  lastExportInfo: document.getElementById('last-export-info'),
  lastImportInfo: document.getElementById('last-import-info'),
  syncStats: document.getElementById('sync-stats'),
  importOptions: document.querySelectorAll('.import-option')
};

let currentState = {
  view: 'dashboard',
  taskFilter: 'all',
  empFilter: 'all',
  taskFilterEmpId: '',
  searchTask: '',
  searchEmp: '',
  searchNote: '',
  currentTaskForm: {
    employeeIds: [],
    labelIds: [],
    checklist: [],
    notes: []
  },
  searchProj: '',
  importPayload: null,
  importMode: 'merge',
  employeesMap: {},
  projectsMap: {},
  labelsMap: {},
  dashboardTaskPage: 1,
  empPage: 1,
  activeProjectId: null,
  activeTeamId: null,
  empFilterTeamIds: [],
  projFilterTeamIds: [],
  taskFilterTeamIds: [],
  globalFilterYear: '',
  globalFilterMonth: ''
};

window.setProjectContext = function(id) {
  currentState.activeProjectId = currentState.activeProjectId === id ? null : id;
  if(currentState.activeProjectId) currentState.activeTeamId = null;
  currentState.empPage = 1;
  updateHeaderContext();
  renderCurrentView();
};

window.setTeamContext = function(id) {
  currentState.activeTeamId = currentState.activeTeamId === id ? null : id;
  if(currentState.activeTeamId) currentState.activeProjectId = null;
  currentState.empPage = 1;
  updateHeaderContext();
  renderCurrentView();
};

function updateHeaderContext() {
  const pContext = document.getElementById('header-project-context');
  if (currentState.activeProjectId && currentState.projectsMap[currentState.activeProjectId]) {
    pContext.style.display = 'flex';
    document.getElementById('header-project-name').textContent = `📂 ${currentState.projectsMap[currentState.activeProjectId].name}`;
  } else if (currentState.activeTeamId && currentState.teamsMap[currentState.activeTeamId]) {
    pContext.style.display = 'flex';
    document.getElementById('header-project-name').textContent = `👥 ${currentState.teamsMap[currentState.activeTeamId].name}`;
  } else {
    pContext.style.display = 'none';
  }
}

document.getElementById('btn-clear-project-context').addEventListener('click', () => {
  currentState.activeProjectId = null;
  currentState.activeTeamId = null;
  updateHeaderContext();
  renderCurrentView();
});

let mdeEditor = null;

// ==========================================
// 2. Initialization
// ==========================================
async function initApp() {
  try {
    await initSettings();
    const appName = await getSetting('appName') || 'ToDoM';
    DOM.headerTitle.textContent = appName;
    document.title = appName;
    
    setupEventListeners();
    await updateGlobalState();
    
    await populateGlobalEmployeeFilter();
    await populateGlobalTeamFilter();
    await populateGlobalLabelFilter();
    switchView('dashboard');
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
      
      navigator.serviceWorker.ready.then(registration => {
        if (registration.pushManager) {
          console.log('Push Manager je připraven pro iOS');
        }
      });
    }
  } catch (err) {
    console.error('Init Error:', err);
    showToast('Chyba při inicializaci', 'error');
  }
}

function switchView(viewId) {
  currentState.view = viewId;
  if (['dashboard', 'tasks'].includes(viewId)) {
    if (navigator.clearAppBadge) navigator.clearAppBadge().catch(()=>{});
  }
  DOM.navItems.forEach(nav => nav.classList.toggle('active', nav.dataset.view === viewId));
  DOM.views.forEach(v => {
    v.classList.remove('active');
    if (v.id === `view-${viewId}`) { void v.offsetWidth; v.classList.add('active'); }
  });

  DOM.fab.style.display = ['tasks', 'employees', 'notes', 'projects'].includes(viewId) ? 'flex' : 'none';
  if (viewId === 'tasks') DOM.fab.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>';
  else if (viewId === 'employees') DOM.fab.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>';
  else if (viewId === 'notes') DOM.fab.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>';
  else if (viewId === 'projects') DOM.fab.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>';

  const titles = { dashboard: 'DASHBOARD', tasks: 'ÚKOLY', projects: 'PROJEKTY', employees: 'LIDÉ', notes: 'ZÁPISY' };
  DOM.headerSub.textContent = titles[viewId] || 'TODOM';
  renderCurrentView();
}

async function renderCurrentView() {
  await updateCache();
  switch (currentState.view) {
    case 'dashboard': await renderDashboard(); break;
    case 'tasks': await renderTasks(); break;
    case 'projects': await renderProjects(); break;
    case 'employees': await renderEmployees(); break;
    case 'notes': await renderNotes(); break;
  }
}

async function updateCache() {
  const [emps, projs, lbls, teams] = await Promise.all([getAllEmployees(), getAllProjects(), getAllLabels(), getAllTeams()]);
  currentState.employeesMap = {}; emps.forEach(e => currentState.employeesMap[e.id] = e);
  currentState.projectsMap = {}; projs.forEach(p => currentState.projectsMap[p.id] = p);
  currentState.labelsMap = {}; lbls.forEach(l => currentState.labelsMap[l.id] = l);
  currentState.teamsMap = {}; (teams || []).forEach(t => currentState.teamsMap[t.id] = t);
}

function showToast(msg, type = 'info') {
  const t = document.createElement('div'); t.className = `toast ${type}`;
  let icon = type === 'success' ? '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' :
             type === 'error' ? '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>' :
             '<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  t.innerHTML = `${icon} <span>${msg}</span>`;
  DOM.toastContainer.appendChild(t);
  setTimeout(() => { t.style.animation = 'toastIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) reverse forwards'; setTimeout(() => t.remove(), 300); }, 3000);
}

function openModal(id) { const m = document.getElementById(id); if (m) m.classList.add('open'); }
function closeModal(id) { const m = document.getElementById(id); if (m) { m.classList.remove('open'); const f = m.querySelector('form'); if(f) f.reset(); } }
function formatDate(isoStr) { return isoStr ? new Date(isoStr).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }

function itemMatchesGlobalDateFilter(item) {
  const year = currentState.globalFilterYear;
  const month = currentState.globalFilterMonth;
  if (!year && !month) return true;

  let dateToTest = null;
  if (item.deadline) {
    dateToTest = new Date(item.deadline);
  } else if (item.createdAt) {
    dateToTest = new Date(item.createdAt);
  } else if (item.updatedAt) {
    dateToTest = new Date(item.updatedAt);
  }

  if (!dateToTest || isNaN(dateToTest.getTime())) return false;

  if (year && dateToTest.getFullYear().toString() !== year) return false;
  if (month) {
    const mStr = (dateToTest.getMonth() + 1).toString().padStart(2, '0');
    if (mStr !== month) return false;
  }
  return true;
}

window.applyGlobalDateFilter = function() {
  currentState.globalFilterYear = document.getElementById('global-filter-year').value;
  currentState.globalFilterMonth = document.getElementById('global-filter-month').value;
  
  const hasFilter = currentState.globalFilterYear || currentState.globalFilterMonth;
  const badge = document.getElementById('global-date-badge');
  if (badge) badge.style.display = hasFilter ? 'block' : 'none';
  
  renderCurrentView();
};

currentState.sortOrder = 'desc';
window.toggleSortOrder = function() {
  currentState.sortOrder = currentState.sortOrder === 'desc' ? 'asc' : 'desc';
  const btns = document.querySelectorAll('.btn-sort-toggle');
  btns.forEach(btn => {
    btn.innerHTML = currentState.sortOrder === 'desc' ? '⬇ Nejnovější' : '⬆ Nejstarší';
  });
  renderCurrentView();
};
function getInitials(name) { return name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?'; }
function getLabelsHtml(labelIds) {
  if (!labelIds || !labelIds.length) return '';
  return labelIds.map(id => {
    const l = currentState.labelsMap[id];
    if (!l) return '';
    return `<span class="badge" style="background:${l.color}20; color:${l.color}; border: 1px solid ${l.color}40">${l.name}</span>`;
  }).join(' ');
}

// ==========================================
// 5. Render: Dashboard
// ==========================================
async function updateGlobalState() {
  const counts = await getSemaforCounts(
    currentState.activeProjectId,
    currentState.globalFilterYear,
    currentState.globalFilterMonth
  );
  DOM.countUrgent.textContent = counts.urgent;
  DOM.countSoon.textContent = counts.soon;
  DOM.countNormal.textContent = counts.normal;
  DOM.urgentDot.style.display = counts.urgent > 0 ? 'block' : 'none';
}

async function renderDashboard() {
  await updateGlobalState();
  if (navigator.clearAppBadge) {
    navigator.clearAppBadge().catch(()=>{});
  }
  let tasks = await getActiveTasks();
  if (currentState.activeProjectId) tasks = tasks.filter(t => t.projectId === currentState.activeProjectId);
  if (currentState.globalFilterYear || currentState.globalFilterMonth) {
    tasks = tasks.filter(itemMatchesGlobalDateFilter);
  }
  const now = Date.now();
  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + ((7 - endOfWeek.getDay()) % 7 || 7));
  endOfWeek.setHours(23, 59, 59, 999);
  const eowTime = endOfWeek.getTime();

  tasks.sort((a, b) => {
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
    const tA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const tB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    const aThisWeek = tA <= eowTime;
    const bThisWeek = tB <= eowTime;
    if (aThisWeek && !bThisWeek) return -1;
    if (!aThisWeek && bThisWeek) return 1;
    return tA - tB;
  });

  const PAGE_SIZE = 5;
  const maxPage = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  if (currentState.dashboardTaskPage > maxPage) currentState.dashboardTaskPage = maxPage;
  if (currentState.dashboardTaskPage < 1) currentState.dashboardTaskPage = 1;
  DOM.dashPageInfo.textContent = `${currentState.dashboardTaskPage}/${maxPage}`;
  const start = (currentState.dashboardTaskPage - 1) * PAGE_SIZE;
  const paginatedTasks = tasks.slice(start, start + PAGE_SIZE);

  if (paginatedTasks.length === 0) DOM.dashboardTasks.innerHTML = '<div class="empty-state"><p>Všechny úkoly jsou hotové!</p></div>';
  else DOM.dashboardTasks.innerHTML = paginatedTasks.map(t => createTaskCard(t)).join('');

  let notes = await getAllNotes();
  if (currentState.activeProjectId) notes = notes.filter(n => n.projectId === currentState.activeProjectId);
  if (currentState.globalFilterYear || currentState.globalFilterMonth) {
    notes = notes.filter(itemMatchesGlobalDateFilter);
  }
  const recentNotes = notes.slice(0, 1);
  if (recentNotes.length === 0) DOM.dashboardNotes.innerHTML = '<div class="empty-state"><p>Žádné zápisy z porad.</p></div>';
  else DOM.dashboardNotes.innerHTML = recentNotes.map(n => createNoteCard(n)).join('');

  await renderDashboardProjectSummary(await getAllTasks());
}

async function renderDashboardProjectSummary(allTasks) {
  const cDash = document.getElementById('dashboard-projects-summary');
  const cTask = document.getElementById('tasks-projects-summary');
  if (!cDash && !cTask) return;
  
  const projs = await getAllProjects();
  const activeProjs = projs.filter(p => p.status !== 'done');
  
  let html = '';
  if (activeProjs.length === 0) {
    html = '<div class="empty-state" style="padding:20px 0"><p>Žádné aktivní projekty.</p></div>';
  } else {
    const h48 = Date.now() + 48*60*60*1000;
    const allEmps = await getAllEmployees();
    const allTeams = await getAllTeams();
    const allNotes = await getAllNotes();
    html = activeProjs.map(p => {
      const pTasks = allTasks.filter(t => t.projectId === p.id);
      const total = pTasks.length;
      const done = pTasks.filter(t => t.status === 'done').length;
      const active = pTasks.filter(t => t.status !== 'done');
      const urgent = active.filter(t => t.priority === 'urgent').length;
      const soon = active.filter(t => t.priority !== 'urgent' && (t.priority === 'medium' || (t.deadline && new Date(t.deadline).getTime() <= h48))).length;
      
      return `
        <div class="card" style="padding:16px; margin-bottom:14px; cursor:pointer; background: #ffffff; border:none; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: all 0.2s ease; ${currentState.activeProjectId === p.id ? 'box-shadow: 0 0 0 2px var(--accent);' : ''}" onclick="setProjectContext(${p.id})" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.08)'" onmouseout="this.style.transform='none'; this.style.boxShadow='${currentState.activeProjectId === p.id ? '0 0 0 2px var(--accent)' : '0 4px 12px rgba(0,0,0,0.03)'}'">
          <div class="card-title" style="font-size:1.05rem; margin-bottom:12px; border-bottom:1px solid var(--border-subtle); padding-bottom:8px">${p.name}</div>
          <div style="display:flex; justify-content:flex-start; gap:24px; align-items:center; margin-bottom:6px">
            <div style="font-size:0.85rem; color:var(--text-secondary)">Členů: <strong style="color:var(--text-primary)">${allEmps ? allEmps.filter(e => (e.projectIds && e.projectIds.includes(p.id)) || (e.teamIds && e.teamIds.some(tid => { const team = allTeams ? allTeams.find(x => x.id === tid) : null; return team && team.projectIds && team.projectIds.includes(p.id); }))).length : 0}</strong></div>
            <div style="font-size:0.85rem; color:var(--text-secondary)">Týmů: <strong style="color:var(--text-primary)">${allTeams ? allTeams.filter(team => team.projectIds && team.projectIds.includes(p.id)).length : 0}</strong></div>
            <div style="font-size:0.85rem; color:var(--text-secondary)">Zápisů: <strong style="color:var(--text-primary)">${allNotes ? allNotes.filter(note => note.projectId === p.id).length : 0}</strong></div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:0.8rem; color:var(--text-secondary)">Úkolů: <strong style="color:var(--text-primary)">${total}</strong></div>
            <div style="font-size:0.8rem; color:var(--text-secondary)">Hotovo: <strong style="color:var(--green)">${done}</strong></div>
            <div style="font-size:0.8rem; color:var(--text-secondary)">Urg.: <strong style="color:var(--red)">${urgent}</strong></div>
            <div style="font-size:0.8rem; color:var(--text-secondary)">48h: <strong style="color:var(--orange)">${soon}</strong></div>
          </div>
        </div>
      `;
    }).join('');
  }
  
  if (cDash) cDash.innerHTML = html;
  if (cTask) cTask.innerHTML = html;
}

// ==========================================
// 6. Render: Tasks (Kanban)
// ==========================================
async function renderTasks() {
  let tasks = await getAllTasks();
  if (currentState.globalFilterYear || currentState.globalFilterMonth) {
    tasks = tasks.filter(itemMatchesGlobalDateFilter);
  }
  if (currentState.searchTask) {
    const q = currentState.searchTask.toLowerCase();
    tasks = tasks.filter(t => {
      const empIds = t.employeeIds || (t.employeeId ? [t.employeeId] : []);
      const empNames = empIds.map(id => currentState.employeesMap[id]?.name || '').join(' ');
      return t.title.toLowerCase().includes(q) || 
             (t.description || '').toLowerCase().includes(q) ||
             empNames.toLowerCase().includes(q);
    });
  }
  if (currentState.activeProjectId) tasks = tasks.filter(t => t.projectId === currentState.activeProjectId);
  
  if (currentState.taskFilterTeamIds && currentState.taskFilterTeamIds.length > 0) {
    const emps = await getAllEmployees();
    const teamEmpIds = emps.filter(e => e.teamIds && e.teamIds.some(tId => currentState.taskFilterTeamIds.includes(tId))).map(e => e.id);
    tasks = tasks.filter(t => {
      const empIds = t.employeeIds || (t.employeeId ? [t.employeeId] : []);
      return empIds.some(id => teamEmpIds.includes(id));
    });
  }

  if (currentState.taskFilterEmpId) {
    const filterId = parseInt(currentState.taskFilterEmpId);
    tasks = tasks.filter(t => {
      const empIds = t.employeeIds || (t.employeeId ? [t.employeeId] : []);
      return empIds.includes(filterId);
    });
  }
  
  const h48 = Date.now() + 48*60*60*1000;
  if (currentState.taskFilter === 'urgent') tasks = tasks.filter(t => t.priority === 'urgent');
  if (currentState.taskFilter === 'soon') tasks = tasks.filter(t => t.priority !== 'urgent' && (t.priority === 'medium' || (t.deadline && new Date(t.deadline).getTime() <= h48)));
  if (currentState.taskFilter === 'low') tasks = tasks.filter(t => t.priority === 'low' && (!t.deadline || new Date(t.deadline).getTime() > h48));
  
  if (currentState.taskFilterLabelId) {
    const lblId = parseInt(currentState.taskFilterLabelId);
    tasks = tasks.filter(t => t.labelIds && t.labelIds.includes(lblId));
  }
  if (currentState.taskFilter === 'my') {
    const myEmpIdStr = await getSetting('myEmployeeId');
    if (myEmpIdStr) {
      const myEmpId = parseInt(myEmpIdStr);
      tasks = tasks.filter(t => {
        const empIds = t.employeeIds || (t.employeeId ? [t.employeeId] : []);
        return empIds.includes(myEmpId);
      });
    }
  }

  document.querySelectorAll('#task-filters .filter-chip').forEach(f => f.classList.toggle('active', f.dataset.f === currentState.taskFilter));

  tasks.sort((a, b) => {
    if (a.orderIndex !== undefined && b.orderIndex !== undefined) return a.orderIndex - b.orderIndex;
    if (a.priority === 'urgent' && b.priority !== 'urgent') return -1;
    if (b.priority === 'urgent' && a.priority !== 'urgent') return 1;
    const tA = new Date(a.createdAt || 0).getTime();
    const tB = new Date(b.createdAt || 0).getTime();
    return currentState.sortOrder === 'asc' ? tA - tB : tB - tA;
  });

  const activeTasks = tasks.filter(t => t.status === 'active');
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress');
  const doneTasks = tasks.filter(t => t.status === 'done');
  DOM.countActive.textContent = activeTasks.length;
  DOM.countInProgress.textContent = inProgressTasks.length;
  DOM.countDone.textContent = doneTasks.length;

  DOM.kanbanActive.innerHTML = activeTasks.length ? activeTasks.map(t => createTaskCard(t)).join('') : '<div class="empty-state" style="padding:20px"><p>Žádné úkoly k vyřízení</p></div>';
  DOM.kanbanInProgress.innerHTML = inProgressTasks.length ? inProgressTasks.map(t => createTaskCard(t)).join('') : '<div class="empty-state" style="padding:20px"><p>Nic se neřeší</p></div>';
  DOM.kanbanDone.innerHTML = doneTasks.length ? doneTasks.map(t => createTaskCard(t)).join('') : '<div class="empty-state" style="padding:20px"><p>Zatím nic hotového</p></div>';
}

function getPriorityBadge(t) {
  let html = '';
  if (t.status === 'done') return '<span class="badge badge-done">✓ Hotovo</span>';
  if (t.status === 'in-progress') html += '<span class="badge" style="background:var(--orange-dim);color:var(--orange)">⏳ Probíhá</span> ';
  
  if (t.priority === 'urgent') html += '<span class="badge badge-urgent">🔴 Urgentní</span>';
  else if (t.deadline) {
    const dl = new Date(t.deadline).getTime();
    if (dl < Date.now()) html += '<span class="badge badge-overdue">⚠️ Zpoždění</span>';
    else if (dl < Date.now() + 48*3600*1000) html += '<span class="badge badge-soon">🟠 Do 48h</span>';
    else if (t.priority === 'medium') html += '<span class="badge badge-medium">🟠 Do 48 hodin</span>';
    else html += '<span class="badge badge-low">🟢 Běžná</span>';
  } else {
    if (t.priority === 'medium') html += '<span class="badge badge-medium">🟠 Do 48 hodin</span>';
    else html += '<span class="badge badge-low">🟢 Běžná</span>';
  }
  return html;
}

function createTaskCard(t) {
  const empIds = t.employeeIds || (t.employeeId ? [t.employeeId] : []);
  const emps = empIds.map(id => currentState.employeesMap[id]).filter(Boolean);
  
  const empNamesHtml = emps.length > 0 
    ? emps.map(emp => `<span style="display:flex;align-items:center;gap:4px">
        ${emp.photo ? `<img src="${emp.photo}" style="width:16px;height:16px;border-radius:50%;object-fit:cover">` : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"></circle><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path></svg>'}
        ${emp.name}
      </span>`).join('')
    : '<span style="display:flex;align-items:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"></circle><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path></svg>Nepřiřazeno</span>';

  const proj = currentState.projectsMap[t.projectId];
  const projHtml = proj ? `<span style="font-size:0.75rem; color:var(--text-muted); font-weight:600">📁 ${proj.name}</span>` : '';
  const desc = t.description ? `<div class="card-subtitle" style="margin-top:6px">${t.description}</div>` : '';
  const dateStr = t.deadline ? `🗓 ${formatDate(t.deadline)}` : 'Bez termínu';
  const labelsHtml = getLabelsHtml(t.labelIds);
  
  let empTeamsHtml = '';
  const allTeamIds = new Set();
  emps.forEach(emp => {
    if (emp.teamIds) emp.teamIds.forEach(tid => allTeamIds.add(tid));
  });
  if (allTeamIds.size > 0) {
    const empTeams = Array.from(allTeamIds).map(tid => {
      const team = currentState.teamsMap ? currentState.teamsMap[tid] : null;
      return team ? team.name : '';
    }).filter(n => n);
    if (empTeams.length > 0) {
      empTeamsHtml = `<span style="font-size:0.75rem; color:var(--text-secondary); font-weight:500">👥 ${empTeams.join(', ')}</span>`;
    }
  }

  // Checklist and Notes indicators
  let extrasHtml = '';
  if (t.checklist && t.checklist.length > 0) {
    const done = t.checklist.filter(c => c.done).length;
    extrasHtml += `<span style="margin-right:8px;" title="Checklist"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:2px"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>${done}/${t.checklist.length}</span>`;
  }
  if (t.taskNotes && t.taskNotes.length > 0) {
    extrasHtml += `<span title="Poznámky"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:2px"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>${t.taskNotes.length}</span>`;
  }
  if (extrasHtml) extrasHtml = `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">${extrasHtml}</div>`;
  
  return `
    <div class="card" onclick="editTask(${t.id})" style="cursor:pointer">
      <div style="display:flex; justify-content:space-between; align-items:flex-start">
        <div>
          <div class="card-title" style="${t.status === 'done' ? 'text-decoration:line-through; color:var(--text-muted)' : ''}">${t.title}</div>
          <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:4px">
            ${projHtml}
            ${empTeamsHtml}
            ${getPriorityBadge(t)}
          </div>
        </div>
      </div>
      ${desc}
      ${labelsHtml ? `<div style="margin-top:8px">${labelsHtml}</div>` : ''}
      ${extrasHtml}
      <div class="card-meta" style="flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between;">
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
          ${empNamesHtml}
        </div>
        <span>${dateStr}</span>
      </div>
    </div>
  `;
}

window.handleTaskTeamCheckboxChange = (cb) => {
  const id = parseInt(cb.value);
  if (cb.checked) {
    if (!currentState.taskFilterTeamIds.includes(id)) currentState.taskFilterTeamIds.push(id);
  } else {
    currentState.taskFilterTeamIds = currentState.taskFilterTeamIds.filter(x => x !== id);
  }
  if (currentState.taskFilterTeamIds.length > 0) {
    currentState.taskFilterEmpId = "";
    if (document.getElementById('task-filter-emp')) document.getElementById('task-filter-emp').value = "";
  }
  renderTasks();
};

window.taskToggleAllTeams = async (cb) => {
  if (cb.checked) {
    const allTeams = await getAllTeams();
    currentState.taskFilterTeamIds = allTeams.map(t => t.id);
  } else {
    currentState.taskFilterTeamIds = [];
  }
  if (currentState.taskFilterTeamIds.length > 0) {
    currentState.taskFilterEmpId = "";
    if (document.getElementById('task-filter-emp')) document.getElementById('task-filter-emp').value = "";
  }
  renderTasks();
  populateGlobalTeamFilter();
};

window.handleEmpTeamCheckboxChange = (cb) => {
  const id = parseInt(cb.value);
  if (cb.checked) {
    if (!currentState.empFilterTeamIds.includes(id)) currentState.empFilterTeamIds.push(id);
  } else {
    currentState.empFilterTeamIds = currentState.empFilterTeamIds.filter(x => x !== id);
  }
  currentState.empPage = 1;
  renderEmpTopTeamChips();
  renderEmployees();
};

window.empToggleAllTeams = async (cb) => {
  if (cb.checked) {
    const allTeams = await getAllTeams();
    currentState.empFilterTeamIds = allTeams.map(t => t.id);
  } else {
    currentState.empFilterTeamIds = [];
  }
  currentState.empPage = 1;
  renderEmpTopTeamChips();
  renderEmployees();
  populateGlobalTeamFilter();
};

async function renderEmpTopTeamChips() {
  const container = document.getElementById('emp-top-team-filter-chips');
  if (!container) return;
  const allTeams = await getAllTeams();
  container.innerHTML = currentState.empFilterTeamIds.map(id => {
    const t = allTeams.find(x => x.id === id);
    if (!t) return '';
    return `<div class="badge" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent);display:flex;align-items:center;gap:4px;">
      ${t.name}
    </div>`;
  }).join('');
}

window.handleProjTeamCheckboxChange = (cb) => {
  const id = parseInt(cb.value);
  if (cb.checked) {
    if (!currentState.projFilterTeamIds.includes(id)) currentState.projFilterTeamIds.push(id);
  } else {
    currentState.projFilterTeamIds = currentState.projFilterTeamIds.filter(x => x !== id);
  }
  renderProjTopTeamChips();
  renderProjects();
};

window.projToggleAllTeams = async (cb) => {
  if (cb.checked) {
    const allTeams = await getAllTeams();
    currentState.projFilterTeamIds = allTeams.map(t => t.id);
  } else {
    currentState.projFilterTeamIds = [];
  }
  renderProjTopTeamChips();
  renderProjects();
  populateGlobalTeamFilter();
};

async function renderProjTopTeamChips() {
  const container = document.getElementById('proj-top-team-filter-chips');
  if (!container) return;
  const allTeams = await getAllTeams();
  container.innerHTML = currentState.projFilterTeamIds.map(id => {
    const t = allTeams.find(x => x.id === id);
    if (!t) return '';
    return `<div class="badge" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent);display:flex;align-items:center;gap:4px;">
      ${t.name}
    </div>`;
  }).join('');
}

// ==========================================
// 7. Render: Employees
// ==========================================
async function renderEmployees() {
  const btnEmp = document.getElementById('btn-bulk-delete-employee');
  if (btnEmp) btnEmp.style.display = 'none';
  const btnTeam = document.getElementById('btn-bulk-delete-team');
  if (btnTeam) btnTeam.style.display = 'none';

  await renderEmployeesSidebar();
  let emps = await getAllEmployees();
  if (currentState.searchEmp) {
    const q = currentState.searchEmp.toLowerCase();
    emps = emps.filter(e => e.name.toLowerCase().includes(q) || (e.position||'').toLowerCase().includes(q));
  }
  const allTeamsLocal = await getAllTeams();
  if (currentState.activeProjectId) {
    const pId = currentState.activeProjectId;
    emps = emps.filter(e => {
      if (e.projectIds && e.projectIds.includes(pId)) return true;
      if (e.teamIds && e.teamIds.some(tId => {
        const team = allTeamsLocal.find(x => x.id === tId);
        return team && team.projectIds && team.projectIds.includes(pId);
      })) return true;
      return false;
    });
  }
  if (currentState.activeTeamId) emps = emps.filter(e => e.teamIds && e.teamIds.includes(currentState.activeTeamId));
  if (currentState.empFilterTeamIds && currentState.empFilterTeamIds.length > 0) {
    emps = emps.filter(e => e.teamIds && e.teamIds.some(tid => currentState.empFilterTeamIds.includes(tid)));
  }
  if (currentState.empFilter === 'active') emps = emps.filter(e => e.isActive !== false);
  if (currentState.empFilter === 'inactive') emps = emps.filter(e => e.isActive === false);
  emps.sort((a,b) => (a.orderIndex !== undefined && b.orderIndex !== undefined) ? a.orderIndex - b.orderIndex : a.name.localeCompare(b.name));

  const PAGE_SIZE = 5;
  const totalPages = Math.ceil(emps.length / PAGE_SIZE) || 1;
  if (!currentState.empPage) currentState.empPage = 1;
  if (currentState.empPage > totalPages) currentState.empPage = totalPages;
  
  const paginatedEmps = emps.slice((currentState.empPage - 1) * PAGE_SIZE, currentState.empPage * PAGE_SIZE);

  if (emps.length === 0) {
    DOM.empList.innerHTML = `<div class="empty-state"><p>Nenalezeny záznamy.</p></div>`;
  } else {
    let html = `<div style="margin-bottom:12px; display:flex; align-items:center; padding: 0 16px;">
        <input type="checkbox" id="bulk-select-all-employee" style="width:18px; height:18px; margin-right:12px; cursor:pointer;" onclick="toggleBulkSelectAll('employee', this.checked)">
        <label for="bulk-select-all-employee" style="font-size:0.9rem; font-weight:600; cursor:pointer;">Vybrat vše na stránce</label>
      </div>` + paginatedEmps.map(e => `
      <div class="card employee-row" onclick="showEmployeeDetail(${e.id})" style="cursor:pointer; opacity: ${e.isActive===false?0.6:1}; padding: 16px; margin-bottom:12px; display:flex; align-items:center;">
        <input type="checkbox" class="bulk-select-checkbox" data-id="${e.id}" data-type="employee" onclick="event.stopPropagation(); onBulkSelectChange('employee');" style="width:18px; height:18px; margin-right:12px; cursor:pointer;" />
        <div class="employee-avatar">${e.photo ? `<img src="${e.photo}">` : getInitials(e.name)}</div>
        <div class="employee-info">
          <div class="employee-name">${e.name} ${e.isActive===false?'(Archív)':''}</div>
          <div class="employee-pos">${e.position || 'Bez pozice'} • ${e.department || 'Bez oddělení'}</div>
          ${e.labelIds ? `<div style="margin-top:4px">${getLabelsHtml(e.labelIds)}</div>` : ''}
        </div>
      </div>
    `).join('');
    
    if (totalPages > 1) {
      html += `
        <div style="display:flex; justify-content:center; align-items:center; gap:16px; margin-top:16px;">
          <button class="btn btn-secondary btn-sm" onclick="currentState.empPage--; renderEmployees()" ${currentState.empPage === 1 ? 'disabled' : ''}>⬅️ Předchozí</button>
          <span style="font-size:0.9rem; font-weight:600;">Strana ${currentState.empPage} z ${totalPages}</span>
          <button class="btn btn-secondary btn-sm" onclick="currentState.empPage++; renderEmployees()" ${currentState.empPage === totalPages ? 'disabled' : ''}>Další ➡️</button>
        </div>
      `;
    }
    DOM.empList.innerHTML = html;
  }

  const teamsContainer = document.getElementById('employees-teams-list');
  if (teamsContainer) {
    let teams = await getAllTeams();
    if (currentState.activeProjectId) {
      teams = teams.filter(t => t.projectIds && t.projectIds.includes(currentState.activeProjectId));
    }
    if (currentState.empFilterTeamIds && currentState.empFilterTeamIds.length > 0) {
      teams = teams.filter(t => currentState.empFilterTeamIds.includes(t.id));
    }
    if (teams.length === 0) {
      teamsContainer.innerHTML = '<div class="empty-state"><p>Žádné týmy.</p></div>';
    } else {
      const allEmpsForCount = await getAllEmployees();
      teamsContainer.innerHTML = teams.map(t => {
        const active = currentState.activeTeamId === t.id;
        const count = allEmpsForCount.filter(e => e.teamIds && e.teamIds.includes(t.id)).length;
        return `
          <div class="card" style="padding:10px 16px; margin-bottom:12px; cursor:pointer; background:#fff; border:none; box-shadow:0 2px 6px rgba(0,0,0,0.03); transition:all 0.2s ease; ${active ? 'box-shadow: 0 0 0 2px var(--accent);' : ''}; display:flex; align-items:center;" onclick="setTeamContext(${t.id}); renderCurrentView();" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
            <input type="checkbox" class="bulk-select-checkbox" data-id="${t.id}" data-type="team" onclick="event.stopPropagation(); onBulkSelectChange('team');" style="width:16px; height:16px; margin-right:10px; cursor:pointer;" />
            <div style="flex:1">
              <div style="font-size:0.95rem; font-weight:600; margin-bottom:4px; display:flex; justify-content:space-between">
                ${t.name}
                <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); editTeam(${t.id})" style="padding:0; min-height:0; height:auto; color:var(--text-muted)" title="Upravit tým">✏️</button>
              </div>
              <div style="font-size:0.8rem; color:var(--text-secondary)">Zobrazených členů: ${count}</div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

async function renderEmployeesSidebar() {
  const projs = await getAllProjects();
  const activeProjs = projs.filter(p => p.status !== 'done');
  
  const sidebarContainer = document.getElementById('employees-sidebar-list');
  if (sidebarContainer) {
    if (activeProjs.length === 0) {
      sidebarContainer.innerHTML = '<div class="empty-state" style="padding:10px 0"><p>Žádné aktivní projekty.</p></div>';
    } else {
      const allTasks = await getAllTasks();
      const allEmps = await getAllEmployees();
      const allTeams = await getAllTeams();
      const allNotes = await getAllNotes();
      const h48 = Date.now() + 48*60*60*1000;

      sidebarContainer.innerHTML = activeProjs.map(p => {
        const pTasks = allTasks.filter(t => t.projectId === p.id);
        const total = pTasks.length;
        const done = pTasks.filter(t => t.status === 'done').length;
        const active = pTasks.filter(t => t.status !== 'done');
        const urgent = active.filter(t => t.priority === 'urgent').length;
        const soon = active.filter(t => t.priority !== 'urgent' && (t.priority === 'medium' || (t.deadline && new Date(t.deadline).getTime() <= h48))).length;
        
        return `
          <div class="card" style="padding:16px; margin-bottom:14px; cursor:pointer; background: #ffffff; border:none; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: all 0.2s ease; ${currentState.activeProjectId === p.id ? 'box-shadow: 0 0 0 2px var(--accent);' : ''}" onclick="setProjectContext(${p.id}); renderCurrentView();" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.08)'" onmouseout="this.style.transform='none'; this.style.boxShadow='${currentState.activeProjectId === p.id ? '0 0 0 2px var(--accent)' : '0 4px 12px rgba(0,0,0,0.03)'}'">
            <div class="card-title" style="font-size:1.05rem; margin-bottom:12px; border-bottom:1px solid var(--border-subtle); padding-bottom:8px">${p.name}</div>
            <div style="display:flex; justify-content:flex-start; gap:24px; align-items:center; margin-bottom:6px">
              <div style="font-size:0.85rem; color:var(--text-secondary)">Členů: <strong style="color:var(--text-primary)">${allEmps ? allEmps.filter(e => (e.projectIds && e.projectIds.includes(p.id)) || (e.teamIds && e.teamIds.some(tid => { const team = allTeams ? allTeams.find(x => x.id === tid) : null; return team && team.projectIds && team.projectIds.includes(p.id); }))).length : 0}</strong></div>
              <div style="font-size:0.85rem; color:var(--text-secondary)">Týmů: <strong style="color:var(--text-primary)">${allTeams ? allTeams.filter(team => team.projectIds && team.projectIds.includes(p.id)).length : 0}</strong></div>
              <div style="font-size:0.85rem; color:var(--text-secondary)">Zápisů: <strong style="color:var(--text-primary)">${allNotes ? allNotes.filter(note => note.projectId === p.id).length : 0}</strong></div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="font-size:0.8rem; color:var(--text-secondary)">Úkolů: <strong style="color:var(--text-primary)">${total}</strong></div>
              <div style="font-size:0.8rem; color:var(--text-secondary)">Hotovo: <strong style="color:var(--green)">${done}</strong></div>
              <div style="font-size:0.8rem; color:var(--text-secondary)">Urg.: <strong style="color:var(--red)">${urgent}</strong></div>
              <div style="font-size:0.8rem; color:var(--text-secondary)">48h: <strong style="color:var(--orange)">${soon}</strong></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}


async function showEmployeeDetail(id) {
  const emp = await getEmployee(id);
  if(!emp) return;
  const tasks = await getTasksByEmployee(id);
  const active = tasks.filter(t => t.status !== 'done');
  const done = tasks.filter(t => t.status === 'done');
  
  const tasksHtml = active.length > 0 ? active.map(t => createTaskCard(t)).join('') : '<div class="empty-state" style="padding:20px"><p>Žádné aktivní úkoly.</p></div>';
  const projs = emp.projectIds ? emp.projectIds.map(pid => currentState.projectsMap[pid]?.name).filter(Boolean).join(', ') : '';
  const labelsHtml = getLabelsHtml(emp.labelIds);

  document.getElementById('emp-detail-content').innerHTML = `
    <div class="modal-header">
      <div class="modal-title">Profil zaměstnance</div>
      <button class="btn btn-ghost btn-icon modal-close" onclick="closeModal('modal-emp-detail')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="detail-header">
      <div class="detail-avatar">${emp.photo ? `<img src="${emp.photo}">` : getInitials(emp.name)}</div>
      <div>
        <div class="detail-title">${emp.name}</div>
        <div class="detail-sub">${emp.position || ''} ${emp.department ? '• '+emp.department : ''}</div>
        ${labelsHtml ? `<div class="detail-sub" style="margin-top:6px">${labelsHtml}</div>` : ''}
        ${projs ? `<div class="detail-sub" style="margin-top:6px">📁 Projekty: ${projs}</div>` : ''}
        <div style="margin-top:8px; display:flex; gap:8px;">
          <span class="badge badge-active">Aktivních úkolů: ${active.length}</span>
          <span class="badge badge-done">Hotových: ${done.length}</span>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:16px;margin-bottom:24px">
      ${emp.email ? `<a href="mailto:${emp.email}" class="btn btn-secondary btn-sm">✉️ Email</a>` : ''}
      ${emp.phone ? `<a href="tel:${emp.phone}" class="btn btn-secondary btn-sm">📞 Volat</a>` : ''}
      <button class="btn btn-secondary btn-sm" onclick="editEmployee(${emp.id})">✏️ Upravit</button>
    </div>
    ${emp.notes ? `<div class="card"><div class="card-title">Poznámky</div><div class="card-subtitle">${emp.notes}</div></div>` : ''}
    <div class="section-title">Aktivní úkoly (${active.length})</div>
    <div>${tasksHtml}</div>
    <div class="section-title">Dokončeno celkem: ${done.length}</div>
  `;
  openModal('modal-emp-detail');
}

// ==========================================
// 8. Render: Projects & Notes
// ==========================================
async function renderProjects() {
  const btnProj = document.getElementById('btn-bulk-delete-project');
  if (btnProj) btnProj.style.display = 'none';

  const projs = await getAllProjects();
  const activeProjs = projs.filter(p => p.status !== 'done');
  
  const sidebarContainer = document.getElementById('projects-sidebar-list');
  if (sidebarContainer) {
    if (activeProjs.length === 0) {
      sidebarContainer.innerHTML = '<div class="empty-state" style="padding:10px 0"><p>Žádné aktivní projekty.</p></div>';
    } else {
      const allTasks = await getAllTasks();
      const allEmps = await getAllEmployees();
      const allTeams = await getAllTeams();
      const allNotes = await getAllNotes();
      const h48 = Date.now() + 48*60*60*1000;

      sidebarContainer.innerHTML = activeProjs.map(p => {
        const pTasks = allTasks.filter(t => t.projectId === p.id);
        const total = pTasks.length;
        const done = pTasks.filter(t => t.status === 'done').length;
        const active = pTasks.filter(t => t.status !== 'done');
        const urgent = active.filter(t => t.priority === 'urgent').length;
        const soon = active.filter(t => t.deadline && new Date(t.deadline).getTime() <= h48 && t.priority !== 'urgent').length;
        
        return `
          <div class="card" style="padding:16px; margin-bottom:14px; cursor:pointer; background: #ffffff; border:none; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: all 0.2s ease; ${currentState.activeProjectId === p.id ? 'box-shadow: 0 0 0 2px var(--accent);' : ''}" onclick="setProjectContext(${p.id}); renderCurrentView();" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.08)'" onmouseout="this.style.transform='none'; this.style.boxShadow='${currentState.activeProjectId === p.id ? '0 0 0 2px var(--accent)' : '0 4px 12px rgba(0,0,0,0.03)'}'">
            <div class="card-title" style="font-size:1.05rem; margin-bottom:12px; border-bottom:1px solid var(--border-subtle); padding-bottom:8px">${p.name}</div>
            <div style="display:flex; justify-content:flex-start; gap:24px; align-items:center; margin-bottom:6px">
              <div style="font-size:0.85rem; color:var(--text-secondary)">Členů: <strong style="color:var(--text-primary)">${allEmps ? allEmps.filter(e => (e.projectIds && e.projectIds.includes(p.id)) || (e.teamIds && e.teamIds.some(tid => { const team = allTeams ? allTeams.find(x => x.id === tid) : null; return team && team.projectIds && team.projectIds.includes(p.id); }))).length : 0}</strong></div>
              <div style="font-size:0.85rem; color:var(--text-secondary)">Týmů: <strong style="color:var(--text-primary)">${allTeams ? allTeams.filter(team => team.projectIds && team.projectIds.includes(p.id)).length : 0}</strong></div>
              <div style="font-size:0.85rem; color:var(--text-secondary)">Zápisů: <strong style="color:var(--text-primary)">${allNotes ? allNotes.filter(note => note.projectId === p.id).length : 0}</strong></div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="font-size:0.8rem; color:var(--text-secondary)">Úkolů: <strong style="color:var(--text-primary)">${total}</strong></div>
              <div style="font-size:0.8rem; color:var(--text-secondary)">Hotovo: <strong style="color:var(--green)">${done}</strong></div>
              <div style="font-size:0.8rem; color:var(--text-secondary)">Urg.: <strong style="color:var(--red)">${urgent}</strong></div>
              <div style="font-size:0.8rem; color:var(--text-secondary)">48h: <strong style="color:var(--orange)">${soon}</strong></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  const listContainer = document.getElementById('projects-list');
  const detailContainer = document.getElementById('project-detail-view');
  const mainTitle = document.getElementById('projects-main-title');

  if (currentState.activeProjectId) {
    listContainer.style.display = 'none';
    detailContainer.style.display = 'block';
    const activeP = projs.find(p => p.id === currentState.activeProjectId);
    if(mainTitle) {
      mainTitle.innerHTML = activeP ? `${activeP.name} <button class="btn btn-ghost btn-sm" onclick="editProject(${activeP.id})" style="padding:4px; margin-left:8px;" title="Upravit projekt">✏️</button>` : 'Projekt';
    }
    
    const allTeams = await getAllTeams();
    const pTeams = allTeams.filter(t => t.projectIds && t.projectIds.includes(currentState.activeProjectId));
    const teamsList = document.getElementById('project-detail-teams');
    if (pTeams.length === 0) teamsList.innerHTML = '<div class="empty-state"><p>Žádné týmy v tomto projektu.</p></div>';
    else teamsList.innerHTML = pTeams.map(t => `
      <div class="card" style="cursor:pointer" onclick="editTeam(${t.id})">
        <div class="card-title">${t.name}</div>
        ${t.description ? `<div class="card-subtitle">${t.description}</div>` : ''}
      </div>
    `).join('');

    const allNotes = await getAllNotes();
    const pNotes = allNotes.filter(n => n.projectId === currentState.activeProjectId);
    const notesList = document.getElementById('project-detail-notes');
    if (pNotes.length === 0) notesList.innerHTML = '<div class="empty-state"><p>Žádné zápisy v tomto projektu.</p></div>';
    else notesList.innerHTML = pNotes.map(n => createNoteCard(n)).join('');
  } else {
    listContainer.style.display = 'block';
    detailContainer.style.display = 'none';
    if(mainTitle) mainTitle.textContent = 'Všechny projekty';

    let filteredProjs = projs;
    if (currentState.searchProj) {
      const q = currentState.searchProj.toLowerCase();
      filteredProjs = filteredProjs.filter(p => p.name.toLowerCase().includes(q));
    }
    if (currentState.projFilterTeamIds && currentState.projFilterTeamIds.length > 0) {
      const allTeams = await getAllTeams();
      const validProjectIds = new Set();
      allTeams.filter(t => currentState.projFilterTeamIds.includes(t.id)).forEach(t => {
        if (t.projectIds) t.projectIds.forEach(pid => validProjectIds.add(pid));
      });
      filteredProjs = filteredProjs.filter(p => validProjectIds.has(p.id));
    }
    if (currentState.globalFilterYear || currentState.globalFilterMonth) {
      filteredProjs = filteredProjs.filter(itemMatchesGlobalDateFilter);
    }
    
    filteredProjs.sort((a, b) => {
      const diff = b.createdAt - a.createdAt;
      return currentState.sortOrder === 'asc' ? -diff : diff;
    });

    if (filteredProjs.length === 0) listContainer.innerHTML = `<div class="empty-state"><p>Zatím žádné projekty.</p></div>`;
    else {
      const allTasks = await getAllTasks();
      const allEmps = await getAllEmployees();
      const h48 = Date.now() + 48*60*60*1000;
      
      let html = `<div style="margin-bottom:12px; display:flex; align-items:center;">
        <input type="checkbox" id="bulk-select-all-project" style="width:18px; height:18px; margin-right:12px; cursor:pointer;" onclick="toggleBulkSelectAll('project', this.checked)">
        <label for="bulk-select-all-project" style="font-size:0.9rem; font-weight:600; cursor:pointer;">Vybrat všechny zobrazené projekty</label>
      </div>`;
      listContainer.innerHTML = html + filteredProjs.map(p => {
        const pTasks = allTasks.filter(t => t.projectId === p.id);
        const total = pTasks.length;
        const done = pTasks.filter(t => t.status === 'done').length;
        const active = pTasks.filter(t => t.status !== 'done');
        const urgent = active.filter(t => t.priority === 'urgent').length;
        const soon = active.filter(t => t.deadline && new Date(t.deadline).getTime() <= h48 && t.priority !== 'urgent').length;
        const empCount = allEmps.filter(e => e.projectIds && e.projectIds.includes(p.id)).length;
        
        return `
          <div class="card" onclick="setProjectContext(${p.id}); renderCurrentView();" style="cursor:pointer; display:flex; flex-direction:row; gap:16px; align-items:center">
            <input type="checkbox" class="bulk-select-checkbox" data-id="${p.id}" data-type="project" onclick="event.stopPropagation(); onBulkSelectChange('project');" style="width:18px; height:18px; cursor:pointer;" />
            <div style="flex:1; display:flex; flex-direction:column; gap:12px">
              <div style="display:flex; justify-content:space-between; align-items:flex-start">
                <div>
                  <div class="card-title" style="display:flex; align-items:center; gap:8px">
                    ${p.name}
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); editProject(${p.id})" style="padding:4px; height:auto; min-height:0" title="Upravit projekt">✏️</button>
                  </div>
                  <div class="card-subtitle">Vytvořeno: ${formatDate(p.createdAt)}</div>
                  ${p.labelIds ? `<div style="margin-top:4px">${getLabelsHtml(p.labelIds)}</div>` : ''}
                </div>
                <span class="badge ${p.status === 'done' ? 'badge-done' : 'badge-active'}">${p.status === 'done' ? 'Dokončeno' : 'Aktivní'}</span>
              </div>
              <div style="display:flex; gap:16px; flex-wrap:wrap; background:var(--bg-elevated); padding:10px; border-radius:var(--radius-sm)">
                <div style="font-size:0.85rem; color:var(--text-secondary)">Lidí: <strong style="color:var(--text-primary)">${empCount}</strong></div>
                <div style="font-size:0.85rem; color:var(--text-secondary)">Úkolů: <strong style="color:var(--text-primary)">${total}</strong></div>
                <div style="font-size:0.85rem; color:var(--text-secondary)">Hotovo: <strong style="color:var(--green)">${done}</strong></div>
                <div style="font-size:0.85rem; color:var(--text-secondary)">Urgentní: <strong style="color:var(--red)">${urgent}</strong></div>
                <div style="font-size:0.85rem; color:var(--text-secondary)">Do 48h: <strong style="color:var(--orange)">${soon}</strong></div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

async function renderNotes() {
  const btnNote = document.getElementById('btn-bulk-delete-note');
  if (btnNote) btnNote.style.display = 'none';

  const projs = await getAllProjects();
  const activeProjs = projs.filter(p => p.status !== 'done');
  
  const sidebarContainer = document.getElementById('notes-projects-summary');
  if (sidebarContainer) {
    if (activeProjs.length === 0) {
      sidebarContainer.innerHTML = '<div class="empty-state" style="padding:10px 0"><p>Žádné aktivní projekty.</p></div>';
    } else {
      const allTasks = await getAllTasks();
      const allEmps = await getAllEmployees();
      const allTeams = await getAllTeams();
      const allNotes = await getAllNotes();
      const h48 = Date.now() + 48*60*60*1000;

      sidebarContainer.innerHTML = activeProjs.map(p => {
        const pTasks = allTasks.filter(t => t.projectId === p.id);
        const total = pTasks.length;
        const done = pTasks.filter(t => t.status === 'done').length;
        const active = pTasks.filter(t => t.status !== 'done');
        const urgent = active.filter(t => t.priority === 'urgent').length;
        const soon = active.filter(t => t.priority !== 'urgent' && (t.priority === 'medium' || (t.deadline && new Date(t.deadline).getTime() <= h48))).length;
        
        return `
          <div class="card" style="padding:16px; margin-bottom:14px; cursor:pointer; background: #ffffff; border:none; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: all 0.2s ease; ${currentState.activeProjectId === p.id ? 'box-shadow: 0 0 0 2px var(--accent);' : ''}" onclick="setProjectContext(${p.id}); renderCurrentView();" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.08)'" onmouseout="this.style.transform='none'; this.style.boxShadow='${currentState.activeProjectId === p.id ? '0 0 0 2px var(--accent)' : '0 4px 12px rgba(0,0,0,0.03)'}'">
            <div class="card-title" style="font-size:1.05rem; margin-bottom:12px; border-bottom:1px solid var(--border-subtle); padding-bottom:8px">${p.name}</div>
            <div style="display:flex; justify-content:flex-start; gap:24px; align-items:center; margin-bottom:6px">
              <div style="font-size:0.85rem; color:var(--text-secondary)">Členů: <strong style="color:var(--text-primary)">${allEmps ? allEmps.filter(e => (e.projectIds && e.projectIds.includes(p.id)) || (e.teamIds && e.teamIds.some(tid => { const team = allTeams ? allTeams.find(x => x.id === tid) : null; return team && team.projectIds && team.projectIds.includes(p.id); }))).length : 0}</strong></div>
              <div style="font-size:0.85rem; color:var(--text-secondary)">Týmů: <strong style="color:var(--text-primary)">${allTeams ? allTeams.filter(team => team.projectIds && team.projectIds.includes(p.id)).length : 0}</strong></div>
              <div style="font-size:0.85rem; color:var(--text-secondary)">Zápisů: <strong style="color:var(--text-primary)">${allNotes ? allNotes.filter(note => note.projectId === p.id).length : 0}</strong></div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="font-size:0.8rem; color:var(--text-secondary)">Úkolů: <strong style="color:var(--text-primary)">${total}</strong></div>
              <div style="font-size:0.8rem; color:var(--text-secondary)">Hotovo: <strong style="color:var(--green)">${done}</strong></div>
              <div style="font-size:0.8rem; color:var(--text-secondary)">Urg.: <strong style="color:var(--red)">${urgent}</strong></div>
              <div style="font-size:0.8rem; color:var(--text-secondary)">48h: <strong style="color:var(--orange)">${soon}</strong></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  let notes = await getAllNotes();
  if (currentState.searchNote) {
    const q = currentState.searchNote.toLowerCase();
    notes = notes.filter(n => n.title.toLowerCase().includes(q) || (n.content||'').toLowerCase().includes(q));
  }
  if (currentState.activeProjectId) notes = notes.filter(n => n.projectId === currentState.activeProjectId);
  if (currentState.globalFilterYear || currentState.globalFilterMonth) {
    notes = notes.filter(itemMatchesGlobalDateFilter);
  }
  
  const monthFilter = document.getElementById('note-filter-month');
  if (monthFilter) {
    const uniqueMonths = new Set();
    (await getAllNotes()).forEach(n => {
      const d = new Date(n.createdAt || n.updatedAt);
      uniqueMonths.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`);
    });
    const sortedMonths = Array.from(uniqueMonths).sort().reverse();
    const currentVal = monthFilter.value;
    
    monthFilter.innerHTML = '<option value="">Všechny měsíce</option>' + sortedMonths.map(m => {
       const [y, mo] = m.split('-');
       return `<option value="${m}">${mo}/${y}</option>`;
    }).join('');
    
    if (sortedMonths.includes(currentVal)) monthFilter.value = currentVal;
    else monthFilter.value = '';
    
    if (monthFilter.value) {
      notes = notes.filter(n => {
        const d = new Date(n.createdAt || n.updatedAt);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}` === monthFilter.value;
      });
    }
  }

  notes.sort((a,b) => {
    if (a.orderIndex !== undefined && b.orderIndex !== undefined) return a.orderIndex - b.orderIndex;
    const tA = new Date(a.createdAt || a.updatedAt).getTime();
    const tB = new Date(b.createdAt || b.updatedAt).getTime();
    return currentState.sortOrder === 'asc' ? tA - tB : tB - tA;
  });

  if (notes.length === 0) DOM.notesList.innerHTML = `<div class="empty-state"><p>Vytvořte první zápis z porady.</p></div>`;
  else {
    let html = `<div style="margin-bottom:12px; display:flex; align-items:center;">
      <input type="checkbox" id="bulk-select-all-note" style="width:18px; height:18px; margin-right:12px; cursor:pointer;" onclick="toggleBulkSelectAll('note', this.checked)">
      <label for="bulk-select-all-note" style="font-size:0.9rem; font-weight:600; cursor:pointer;">Vybrat všechny zobrazené zápisy</label>
    </div>`;
    DOM.notesList.innerHTML = html + notes.map(n => createNoteCard(n)).join('');
  }
}

function createNoteCard(n) {
  const snippet = n.content ? n.content.replace(/[#*`_-]/g, '').substring(0, 100) + '...' : 'Prázdný zápis';
  return `
    <div class="card" onclick="viewNote(${n.id})" style="cursor:pointer; display:flex; flex-direction:row; gap:16px; align-items:center">
      <input type="checkbox" class="bulk-select-checkbox" data-id="${n.id}" data-type="note" onclick="event.stopPropagation(); onBulkSelectChange('note');" style="width:18px; height:18px; cursor:pointer;" />
      <div style="flex:1">
        <div class="card-title">${n.title}</div>
        <div class="card-subtitle" style="margin-bottom:8px">${snippet}</div>
        <div class="card-meta"><span>⏱ ${formatDate(n.updatedAt)}</span></div>
      </div>
    </div>
  `;
}

// ==========================================
// 10. Forms & Actions
// ==========================================
async function populateGlobalEmployeeFilter() {
  const emps = await getActiveEmployees();
  DOM.taskFilterEmp.innerHTML = '<option value="">Všichni lidé</option>' + emps.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
}
async function populateGlobalTeamFilter() {
  const teams = await getAllTeams();
  teams.sort((a,b) => a.name.localeCompare(b.name));
  const options = '<option value="">Všechny týmy</option>' + teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  
  const renderCheckboxes = (teamIdsArray, onChangeName, toggleAllFn) => {
    const isAllSelected = teams.length > 0 && teamIdsArray.length === teams.length;
    let html = `
      <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border);">
        <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;font-weight:600;">
          <input type="checkbox" onchange="${toggleAllFn}(this)" ${isAllSelected ? 'checked' : ''}>
          Vybrat vše
        </label>
      </div>
    `;
    html += teams.map(t => {
      const checked = teamIdsArray.includes(t.id) ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;">
        <input type="checkbox" value="${t.id}" ${checked} onchange="${onChangeName}(this)">
        ${t.name}
      </label>`;
    }).join('');
    return html;
  };
  
  const chkEmp = document.getElementById('emp-team-checkboxes');
  if (chkEmp) chkEmp.innerHTML = renderCheckboxes(currentState.empFilterTeamIds, 'handleEmpTeamCheckboxChange', 'empToggleAllTeams');
  
  const chkProj = document.getElementById('proj-team-checkboxes');
  if (chkProj) chkProj.innerHTML = renderCheckboxes(currentState.projFilterTeamIds, 'handleProjTeamCheckboxChange', 'projToggleAllTeams');

  const chkTask = document.getElementById('task-team-checkboxes');
  if (chkTask) chkTask.innerHTML = renderCheckboxes(currentState.taskFilterTeamIds, 'handleTaskTeamCheckboxChange', 'taskToggleAllTeams');
}
async function populateGlobalLabelFilter() {
  const lbls = await getAllLabels();
  const select = document.getElementById('task-filter-label');
  if (select) {
    select.innerHTML = '<option value="" data-color="">Všechny štítky</option>' + lbls.map(l => `<option value="${l.id}" data-color="${l.color}">${l.name}</option>`).join('');
    updateLabelFilterColor();
  }
}
function updateLabelFilterColor() {
  const select = document.getElementById('task-filter-label');
  if (!select) return;
  const opt = select.options[select.selectedIndex];
  const color = opt ? opt.getAttribute('data-color') : '';
  if (color) {
    select.style.borderColor = color;
    select.style.color = color;
    select.style.backgroundColor = color + '20';
  } else {
    select.style.borderColor = 'var(--accent)';
    select.style.color = 'var(--accent)';
    select.style.backgroundColor = 'var(--accent-dim)';
  }
}
async function populateProjectSelect(selectId) {
  const sel = document.getElementById(selectId);
  const projs = await getAllProjects();
  sel.innerHTML = '<option value="">— Mimo projekt —</option>' + projs.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}
async function populateTeamSelect(selectId) {
  const sel = document.getElementById(selectId);
  const teams = await getAllTeams();
  sel.innerHTML = '<option value="">— Mimo tým —</option>' + teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
}
async function populateEmployeeSelect(selectId) {
  const sel = document.getElementById(selectId);
  const emps = await getActiveEmployees();
  sel.innerHTML = '<option value="">— Bez přiřazení —</option>' + emps.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
}
async function populateLabelCheckboxes(containerId, selectedIds = []) {
  const container = document.getElementById(containerId);
  const lbls = await getAllLabels();
  if(lbls.length === 0) {
    container.innerHTML = '<span style="font-size:0.8rem;color:var(--text-muted)">Žádné štítky neexistují. (Přidej je v Nastavení)</span>';
    return;
  }
  container.innerHTML = lbls.map(l => `
    <label style="display:flex;align-items:center;gap:4px;font-size:0.85rem">
      <input type="checkbox" class="lbl-cb" value="${l.id}" ${selectedIds.includes(l.id) ? 'checked' : ''}/>
      <span class="badge" style="background:${l.color}20; color:${l.color}; border: 1px solid ${l.color}40">${l.name}</span>
    </label>
  `).join('');
}
async function populateEmployeeCheckboxes(projectId) {
  const container = document.getElementById('proj-employees-container');
  const emps = await getActiveEmployees();
  if(emps.length === 0) {
    container.innerHTML = '<span style="font-size:0.8rem;color:var(--text-muted)">Žádní aktivní zaměstnanci.</span>';
    return;
  }
  const draw = () => {
    const q = (document.getElementById('proj-emp-search-input').value || '').toLowerCase();
    container.innerHTML = emps.filter(e => e.name.toLowerCase().includes(q)).map(e => {
      const isChecked = projectId && e.projectIds && e.projectIds.includes(projectId);
      return `
        <label style="display:flex;align-items:center;gap:4px;font-size:0.85rem">
          <input type="checkbox" class="proj-emp-cb" value="${e.id}" ${isChecked ? 'checked' : ''}/>
          ${e.name}
        </label>
      `;
    }).join('');
  };
  draw();
  document.getElementById('proj-emp-search-input').oninput = draw;
}
async function populateProjectCheckboxes(selectedIds = []) {
  const container = document.getElementById('emp-projects-container');
  const projs = await getAllProjects();
  if(projs.length === 0) {
    container.innerHTML = '<span style="font-size:0.8rem;color:var(--text-muted)">Žádné projekty neexistují.</span>';
    return;
  }
  container.innerHTML = projs.map(p => `
    <label style="display:flex;align-items:center;gap:4px;font-size:0.85rem">
      <input type="checkbox" class="emp-proj-cb" value="${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''}/>
      ${p.name}
    </label>
  `).join('');
}
async function populateTeamCheckboxes(selectedIds = []) {
  const container = document.getElementById('emp-teams-container');
  const teams = await getAllTeams();
  if(teams.length === 0) {
    container.innerHTML = '<span style="font-size:0.8rem;color:var(--text-muted)">Žádné týmy neexistují.</span>';
    return;
  }
  container.innerHTML = teams.map(t => `
    <label style="display:flex;align-items:center;gap:4px;font-size:0.85rem">
      <input type="checkbox" class="emp-team-cb" value="${t.id}" ${selectedIds.includes(t.id) ? 'checked' : ''}/>
      ${t.name}
    </label>
  `).join('');
}
async function populateTeamProjectCheckboxes(selectedIds = []) {
  const container = document.getElementById('team-projects-container');
  const projs = await getAllProjects();
  if(projs.length === 0) {
    container.innerHTML = '<span style="font-size:0.8rem;color:var(--text-muted)">Žádné projekty neexistují.</span>';
    return;
  }
  container.innerHTML = projs.map(p => `
    <label style="display:flex;align-items:center;gap:4px;font-size:0.85rem">
      <input type="checkbox" class="team-proj-cb" value="${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''}/>
      ${p.name}
    </label>
  `).join('');
}

// --- NEW TASK FORM LOGIC ---
let allActiveEmployeesCache = [];
let allLabelsCache = [];

async function renderTaskFormEmployeeChips() {
  const container = document.getElementById('task-employee-chips');
  container.innerHTML = currentState.currentTaskForm.employeeIds.map(id => {
    const emp = allActiveEmployeesCache.find(e => e.id === id);
    if(!emp) return '';
    return `<div class="badge" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent);display:flex;align-items:center;gap:4px;">
      ${emp.name} <span style="cursor:pointer;font-weight:bold" onclick="removeTaskFormEmployee(${id})">&times;</span>
    </div>`;
  }).join('');
}
window.removeTaskFormEmployee = (id) => {
  currentState.currentTaskForm.employeeIds = currentState.currentTaskForm.employeeIds.filter(x => x !== id);
  renderTaskFormEmployeeChips();
};

async function renderTaskFormLabelChips() {
  const container = document.getElementById('task-label-chips');
  container.innerHTML = currentState.currentTaskForm.labelIds.map(id => {
    const lbl = allLabelsCache.find(l => l.id === id);
    if(!lbl) return '';
    return `<div class="badge" style="background:${lbl.color}20;color:${lbl.color};border:1px solid ${lbl.color}40;display:flex;align-items:center;gap:4px;">
      ${lbl.name} <span style="cursor:pointer;font-weight:bold" onclick="removeTaskFormLabel(${id})">&times;</span>
    </div>`;
  }).join('');
}
window.removeTaskFormLabel = (id) => {
  currentState.currentTaskForm.labelIds = currentState.currentTaskForm.labelIds.filter(x => x !== id);
  renderTaskFormLabelChips();
};

function renderTaskFormChecklist() {
  const container = document.getElementById('task-checklist-container');
  container.innerHTML = currentState.currentTaskForm.checklist.map((item, idx) => `
    <div style="display:flex; align-items:center; gap:8px;">
      <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleTaskFormChecklist(${idx}, this.checked)"/>
      <span style="flex:1; ${item.done ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${item.text}</span>
      <button type="button" class="btn btn-ghost btn-icon" onclick="removeTaskFormChecklist(${idx})" style="padding:0;height:auto;color:var(--danger)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    </div>
  `).join('');
}
window.toggleTaskFormChecklist = (idx, done) => {
  currentState.currentTaskForm.checklist[idx].done = done;
  renderTaskFormChecklist();
};
window.removeTaskFormChecklist = (idx) => {
  currentState.currentTaskForm.checklist.splice(idx, 1);
  renderTaskFormChecklist();
};

function renderTaskFormNotes() {
  const container = document.getElementById('task-notes-container');
  container.innerHTML = currentState.currentTaskForm.notes.map((note, idx) => `
    <div style="background:var(--bg-card); padding:8px; border-radius:8px; border:1px solid var(--border); position:relative;">
      <div style="font-size:0.9rem;">${note.text.replace(/\n/g, '<br/>')}</div>
      <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">${new Date(note.createdAt).toLocaleString()}</div>
      <button type="button" class="btn btn-ghost btn-icon" onclick="removeTaskFormNote(${idx})" style="position:absolute; top:4px; right:4px; padding:0; height:auto; color:var(--danger)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    </div>
  `).join('');
}
window.removeTaskFormNote = (idx) => {
  currentState.currentTaskForm.notes.splice(idx, 1);
  renderTaskFormNotes();
};

// Edit actions
async function editTask(id) {
  const t = await getTask(id);
  if(!t) return;
  document.getElementById('modal-task-title').textContent = 'Upravit úkol';
  document.getElementById('task-id').value = t.id;
  document.getElementById('task-title').value = t.title;
  document.getElementById('task-desc').value = t.description || '';
  document.getElementById('task-priority').value = t.priority;
  document.getElementById('task-status').value = t.status;
  document.getElementById('task-deadline').value = t.deadline ? t.deadline.split('T')[0] : '';
  await populateProjectSelect('task-project');
  document.getElementById('task-project').value = t.projectId || '';
  
  // Set local state
  allActiveEmployeesCache = await getActiveEmployees();
  allLabelsCache = await getAllLabels();
  
  // Backwards compatibility: if it had employeeId, convert to array
  let empIds = t.employeeIds || [];
  if (t.employeeId && !empIds.includes(t.employeeId)) empIds.push(t.employeeId);
  
  currentState.currentTaskForm = {
    employeeIds: empIds,
    labelIds: t.labelIds || [],
    checklist: t.checklist || [],
    notes: t.taskNotes || []
  };
  
  // Populate dropdowns
  const selEmp = document.getElementById('task-employee-select');
  selEmp.innerHTML = '<option value="">— Vyberte osobu —</option>' + allActiveEmployeesCache.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
  const selLbl = document.getElementById('task-label-select');
  selLbl.innerHTML = '<option value="">— Přidat štítek —</option>' + allLabelsCache.map(l => `<option value="${l.id}">${l.name}</option>`).join('');

  renderTaskFormEmployeeChips();
  renderTaskFormLabelChips();
  renderTaskFormChecklist();
  renderTaskFormNotes();

  document.getElementById('btn-task-delete').style.display = 'block';
  openModal('modal-task');
}

document.getElementById('form-task').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const data = {
    title: document.getElementById('task-title').value,
    description: document.getElementById('task-desc').value,
    priority: document.getElementById('task-priority').value,
    status: document.getElementById('task-status').value,
    deadline: document.getElementById('task-deadline').value || null,
    projectId: document.getElementById('task-project').value ? parseInt(document.getElementById('task-project').value) : null,
    employeeIds: currentState.currentTaskForm.employeeIds,
    labelIds: currentState.currentTaskForm.labelIds,
    checklist: currentState.currentTaskForm.checklist,
    taskNotes: currentState.currentTaskForm.notes
  };
  // Maintain single employeeId for backwards compatibility if only 1 is selected
  data.employeeId = data.employeeIds.length > 0 ? data.employeeIds[0] : null;

  if (id) await updateTask(parseInt(id), data); else await addTask(data);
  closeModal('modal-task'); showToast('Úkol uložen', 'success'); renderCurrentView();
});

async function editEmployee(id) {
  closeModal('modal-emp-detail');
  const e = await getEmployee(id);
  if(!e) return;
  document.getElementById('modal-emp-title').textContent = 'Upravit záznam';
  document.getElementById('emp-id').value = e.id;
  document.getElementById('emp-name').value = e.name;
  document.getElementById('emp-position').value = e.position || '';
  document.getElementById('emp-department').value = e.department || '';
  document.getElementById('emp-email').value = e.email || '';
  document.getElementById('emp-phone').value = e.phone || '';
  document.getElementById('emp-notes').value = e.notes || '';
  document.getElementById('emp-active').value = e.isActive !== false ? "true" : "false";
  document.getElementById('emp-photo-base64').value = e.photo || '';
  document.getElementById('emp-photo-preview').innerHTML = e.photo ? `<img src="${e.photo}">` : `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
  await populateProjectCheckboxes(e.projectIds || []);
  await populateTeamCheckboxes(e.teamIds || []);
  await populateLabelCheckboxes('emp-labels-container', e.labelIds || []);
  document.getElementById('btn-emp-delete').style.display = 'block';
  openModal('modal-employee');
}

document.getElementById('form-employee').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('emp-id').value;
  const projectIds = Array.from(document.querySelectorAll('#emp-projects-container .emp-proj-cb:checked')).map(cb => parseInt(cb.value));
  const teamIds = Array.from(document.querySelectorAll('#emp-teams-container .emp-team-cb:checked')).map(cb => parseInt(cb.value));
  const labelIds = Array.from(document.getElementById('emp-labels-container').querySelectorAll('.lbl-cb:checked')).map(cb => parseInt(cb.value));
  const data = {
    name: document.getElementById('emp-name').value,
    position: document.getElementById('emp-position').value,
    department: document.getElementById('emp-department').value,
    email: document.getElementById('emp-email').value,
    phone: document.getElementById('emp-phone').value,
    notes: document.getElementById('emp-notes').value,
    isActive: document.getElementById('emp-active').value === "true",
    photo: document.getElementById('emp-photo-base64').value,
    projectIds,
    teamIds,
    labelIds
  };
  if (id) await updateEmployee(parseInt(id), data); else await addEmployee(data);
  closeModal('modal-employee'); await populateGlobalEmployeeFilter(); showToast('Zaměstnanec uložen', 'success'); renderCurrentView();
});

document.getElementById('form-team').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('team-id').value;
  const projectIds = Array.from(document.querySelectorAll('#team-projects-container .team-proj-cb:checked')).map(cb => parseInt(cb.value));
  const data = {
    name: document.getElementById('team-name').value,
    projectIds
  };
  if (id) await saveTeam({ id: parseInt(id), ...data }); else await saveTeam(data);
  closeModal('modal-team'); await populateGlobalTeamFilter(); showToast('Tým uložen', 'success'); renderCurrentView();
});

document.getElementById('btn-team-delete').addEventListener('click', async () => {
  if(!confirm('Opravdu smazat tento tým?')) return;
  const id = document.getElementById('team-id').value;
  if(id) { await deleteTeam(parseInt(id)); closeModal('modal-team'); await populateGlobalTeamFilter(); showToast('Tým smazán'); renderCurrentView(); }
});

async function editTeam(id) {
  const t = await getTeam(id);
  if(!t) return;
  document.getElementById('modal-team-title').textContent = 'Upravit tým';
  document.getElementById('team-id').value = t.id;
  document.getElementById('team-name').value = t.name;
  await populateTeamProjectCheckboxes(t.projectIds || []);
  document.getElementById('btn-team-delete').style.display = 'block';
  openModal('modal-team');
}

async function openNewTeamModal() {
  document.getElementById('modal-team-title').textContent = 'Nový tým';
  document.getElementById('form-team').reset();
  document.getElementById('team-id').value = '';
  document.getElementById('btn-team-delete').style.display = 'none';
  const initialProjects = currentState.activeProjectId ? [currentState.activeProjectId] : [];
  await populateTeamProjectCheckboxes(initialProjects);
  openModal('modal-team');
}

window.handleNoteTeamCheckboxChange = (cb) => {
  const id = parseInt(cb.value);
  if (!currentState.currentNoteForm) currentState.currentNoteForm = { teamIds: [] };
  if (!currentState.currentNoteForm.teamIds) currentState.currentNoteForm.teamIds = [];
  if (cb.checked) {
    if (!currentState.currentNoteForm.teamIds.includes(id)) currentState.currentNoteForm.teamIds.push(id);
  } else {
    currentState.currentNoteForm.teamIds = currentState.currentNoteForm.teamIds.filter(x => x !== id);
  }
  renderNoteTeamChips();
  renderNoteTeamCheckboxes();
};

window.noteToggleAllTeams = async (cb) => {
  if (!currentState.currentNoteForm) currentState.currentNoteForm = { teamIds: [] };
  if (cb.checked) {
    const allTeams = await getAllTeams();
    currentState.currentNoteForm.teamIds = allTeams.map(t => t.id);
  } else {
    currentState.currentNoteForm.teamIds = [];
  }
  renderNoteTeamChips();
  renderNoteTeamCheckboxes();
};

async function renderNoteTeamCheckboxes() {
  const container = document.getElementById('note-team-checkboxes');
  if (!container) return;
  const teams = await getAllTeams();
  teams.sort((a,b) => a.name.localeCompare(b.name));
  
  const teamIdsArray = currentState.currentNoteForm?.teamIds || [];
  const isAllSelected = teams.length > 0 && teamIdsArray.length === teams.length;
  
  let html = `
    <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border);">
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;font-weight:600;">
        <input type="checkbox" onchange="noteToggleAllTeams(this)" ${isAllSelected ? 'checked' : ''}>
        Vybrat vše
      </label>
    </div>
  `;
  html += teams.map(t => {
    const checked = teamIdsArray.includes(t.id) ? 'checked' : '';
    return `<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;cursor:pointer;">
      <input type="checkbox" value="${t.id}" ${checked} onchange="handleNoteTeamCheckboxChange(this)">
      ${t.name}
    </label>`;
  }).join('');
  
  container.innerHTML = html;
}

async function renderNoteTeamChips() {
  const container = document.getElementById('note-team-chips');
  if (!container) return;
  const allTeams = await getAllTeams();
  container.innerHTML = (currentState.currentNoteForm?.teamIds || []).map(id => {
    const t = allTeams.find(x => x.id === id);
    if (!t) return '';
    return `<div class="badge" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--accent);display:flex;align-items:center;gap:4px;">
      ${t.name}
    </div>`;
  }).join('');
}

async function openNewNoteModal() {
  document.getElementById('modal-note-title').textContent = 'Nový zápis';
  document.getElementById('form-note').reset();
  document.getElementById('note-id').value = '';
  document.getElementById('btn-note-delete').style.display = 'none';
  currentState.currentNoteForm = { teamIds: [] };
  await populateProjectSelect('note-project');
  renderNoteTeamCheckboxes();
  if (currentState.activeProjectId) document.getElementById('note-project').value = currentState.activeProjectId;
  if (currentState.activeTeamId) currentState.currentNoteForm.teamIds = [currentState.activeTeamId];
  renderNoteTeamChips();
  if (!mdeEditor) mdeEditor = new EasyMDE({ element: document.getElementById('note-content-editor'), spellChecker: false, status: false });
  mdeEditor.value('');
  openModal('modal-note');
  setTimeout(()=>mdeEditor.codemirror.refresh(), 100);
}

window.openNewEmployeeModal = async () => {
  document.getElementById('modal-emp-title').textContent = 'Nový zaměstnanec';
  document.getElementById('form-employee').reset();
  document.getElementById('emp-id').value = '';
  document.getElementById('emp-active').value = "true";
  document.getElementById('emp-photo-base64').value = '';
  document.getElementById('emp-photo-preview').innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
  document.getElementById('btn-emp-delete').style.display = 'none';
  const initialProjects = currentState.activeProjectId ? [currentState.activeProjectId] : [];
  await populateProjectCheckboxes(initialProjects);
  await populateTeamCheckboxes(currentState.activeTeamId ? [currentState.activeTeamId] : []);
  await populateLabelCheckboxes('emp-labels-container', []);
  openModal('modal-employee');
};

window.openNewProjectModal = async () => {
  document.getElementById('modal-proj-title').textContent = 'Nový projekt';
  document.getElementById('form-project').reset();
  document.getElementById('proj-id').value = '';
  document.getElementById('proj-emp-search-input').value = '';
  document.getElementById('btn-proj-delete').style.display = 'none';
  await populateEmployeeCheckboxes(null);
  await populateLabelCheckboxes('proj-labels-container', []);
  openModal('modal-project');
};

async function editProject(id) {
  const p = await getProject(id);
  if(!p) return;
  document.getElementById('modal-proj-title').textContent = 'Upravit projekt';
  document.getElementById('proj-id').value = p.id;
  document.getElementById('proj-name').value = p.name;
  document.getElementById('proj-status').value = p.status || 'active';
  document.getElementById('proj-emp-search-input').value = '';
  await populateEmployeeCheckboxes(p.id);
  await populateLabelCheckboxes('proj-labels-container', p.labelIds || []);
  document.getElementById('btn-proj-delete').style.display = 'block';
  openModal('modal-project');
}

document.getElementById('form-project').addEventListener('submit', async (e) => {
  e.preventDefault();
  const idStr = document.getElementById('proj-id').value;
  let projId = idStr ? parseInt(idStr) : null;
  const labelIds = Array.from(document.getElementById('proj-labels-container').querySelectorAll('.lbl-cb:checked')).map(cb => parseInt(cb.value));
  const data = { name: document.getElementById('proj-name').value, status: document.getElementById('proj-status').value, labelIds };
  
  if (projId) await updateProject(projId, data);
  else projId = await addProject(data);

  const selectedEmpIds = Array.from(document.querySelectorAll('.proj-emp-cb:checked')).map(cb => parseInt(cb.value));
  const allEmps = await getAllEmployees();
  
  for (const emp of allEmps) {
    let pIds = emp.projectIds || [];
    let changed = false;
    if (selectedEmpIds.includes(emp.id)) {
      if (!pIds.includes(projId)) { pIds.push(projId); changed = true; }
    } else {
      if (pIds.includes(projId)) { pIds = pIds.filter(id => id !== projId); changed = true; }
    }
    if (changed) await updateEmployee(emp.id, { projectIds: pIds });
  }

  closeModal('modal-project'); showToast('Projekt uložen', 'success'); renderCurrentView();
});

async function editNote(id) {
  const n = await getNote(id);
  if(!n) return;
  document.getElementById('modal-note-title').textContent = 'Upravit zápis';
  document.getElementById('note-id').value = n.id;
  document.getElementById('note-title').value = n.title;
  currentState.currentNoteForm = { teamIds: n.teamIds || [] };
  if (n.teamId && !currentState.currentNoteForm.teamIds.includes(n.teamId)) {
    currentState.currentNoteForm.teamIds.push(n.teamId);
  }
  await populateProjectSelect('note-project');
  renderNoteTeamCheckboxes();
  document.getElementById('note-project').value = n.projectId || '';
  renderNoteTeamChips();
  if (!mdeEditor) mdeEditor = new EasyMDE({ element: document.getElementById('note-content-editor'), spellChecker: false, status: false });
  mdeEditor.value(n.content || '');
  document.getElementById('btn-note-delete').style.display = 'block';
  openModal('modal-note');
  setTimeout(()=>mdeEditor.codemirror.refresh(), 100);
}

let currentViewingNote = null;
async function viewNote(id) {
  const n = await getNote(id);
  if(!n) return;
  currentViewingNote = n;
  document.getElementById('modal-view-note-title').textContent = n.title;
  document.getElementById('note-read-content').innerHTML = marked.parse(n.content || '*Prázdný zápis*');
  openModal('modal-view-note');
}

document.getElementById('btn-view-edit').addEventListener('click', () => {
  if(currentViewingNote) {
    closeModal('modal-view-note');
    editNote(currentViewingNote.id);
  }
});

document.getElementById('btn-view-delete').addEventListener('click', async () => {
  if (currentViewingNote) {
    if (confirm('Opravdu smazat tento zápis? Úkoly z něj vytvořené v sekci Úkoly ZŮSTANOU zachovány.')) {
      await deleteNote(currentViewingNote.id);
      closeModal('modal-view-note');
      showToast('Zápis smazán', 'success');
      renderCurrentView();
    }
  }
});

document.getElementById('btn-export-word').addEventListener('click', () => {
  if(!currentViewingNote) return;
  const htmlContent = document.getElementById('note-read-content').innerHTML;
  const title = currentViewingNote.title || 'Zápis';
  const preHtml = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>" + title + "</title></head><body><h1>" + title + "</h1>";
  const postHtml = "</body></html>";
  const html = preHtml + htmlContent + postHtml;
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = title + '.doc';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

document.getElementById('form-note').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('note-id').value;
  const data = { 
    title: document.getElementById('note-title').value, 
    content: mdeEditor ? mdeEditor.value() : '',
    projectId: document.getElementById('note-project').value ? parseInt(document.getElementById('note-project').value) : null,
    teamIds: currentState.currentNoteForm ? currentState.currentNoteForm.teamIds : []
  };
  let finalId = id ? parseInt(id) : null;
  if (finalId) await updateNote(finalId, data); else finalId = await addNote(data);
  
  await extractAndCreateTasksFromNote(finalId);
  
  closeModal('modal-note'); showToast('Zápis uložen', 'success'); renderCurrentView();
});

async function extractAndCreateTasksFromNote(noteId) {
  const note = await getNote(noteId);
  if (!note || !note.content) return;
  
  const lines = note.content.split('\n');
  let currentTask = null;
  const tasksToCreate = [];
  let isModified = false;
  
  const taskKeywords = ['úkol:', 'ukol:', 'task:'];
  const personKeywords = ['zodpovědná osoba:', 'zodpovedna osoba:', 'osoba:', 'kdo:', 'zodpovídá:'];
  const dateKeywords = ['termín splnění:', 'termin splneni:', 'termín:', 'termin:', 'do:', 'deadline:'];
  const labelKeywords = ['štítek:', 'štítky:', 'stitky:', 'stitek:', 'tag:'];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const lowerLine = line.toLowerCase();
    
    const strippedLower = lowerLine.replace(/^[-*]\s*/, '').replace(/^\[ \]\s*/, '');
    
    // Check if line is a task, but ignore if it already starts with ✓
    let isTaskLine = false;
    if (!strippedLower.startsWith('✓') && !strippedLower.startsWith('[x]')) {
       for (const kw of taskKeywords) {
         if (strippedLower.startsWith(kw)) {
           if (currentTask && currentTask.title) tasksToCreate.push(currentTask);
           
           const actualText = line.replace(/^[-*]\s*/, '').replace(/^\[ \]\s*/, '');
           const title = actualText.substring(kw.length).trim();
           
           currentTask = { title, personName: '', deadlineStr: '', projectId: note.projectId, lineIndex: i };
           isTaskLine = true;
           break;
         }
       }
    }
    if (isTaskLine) continue;
    
    // Check for person and deadline
    if (currentTask) {
      const strippedLower = lowerLine.replace(/^[-*]\s*/, '');
      const actualText = line.replace(/^[-*]\s*/, '');
      
      let matchedPerson = false;
      for (const kw of personKeywords) {
        if (strippedLower.startsWith(kw)) {
          currentTask.personName = actualText.substring(kw.length).trim();
          matchedPerson = true;
          break;
        }
      }
      if (matchedPerson) continue;
      
      for (const kw of dateKeywords) {
        if (strippedLower.startsWith(kw)) {
          currentTask.deadlineStr = actualText.substring(kw.length).trim();
          break;
        }
      }
      
      let matchedLabel = false;
      for (const kw of labelKeywords) {
        if (strippedLower.startsWith(kw)) {
          currentTask.labelsStr = actualText.substring(kw.length).trim();
          matchedLabel = true;
          break;
        }
      }
      if (matchedLabel) continue;
    }
  }
  
  if (currentTask && currentTask.title) tasksToCreate.push(currentTask);
  if (tasksToCreate.length === 0) return;
  
  const allEmployees = await getAllEmployees();
  
  for (const t of tasksToCreate) {
    let empId = null;
    if (t.personName) {
      const pNameLower = t.personName.toLowerCase();
      const emp = allEmployees.find(e => e.name.toLowerCase() === pNameLower || e.name.toLowerCase().includes(pNameLower) || pNameLower.includes(e.name.toLowerCase()));
      if (emp) empId = emp.id;
    }
    
    let parsedDate = null;
    if (t.deadlineStr) {
      const parts = t.deadlineStr.match(/(\d+)\.(\d+)\.(\d+)/);
      if (parts) {
        let y = parseInt(parts[3]);
        if (y < 100) y += 2000;
        parsedDate = `${y}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      } else {
        const d = new Date(t.deadlineStr);
        if (!isNaN(d.getTime())) parsedDate = d.toISOString().split('T')[0];
      }
    }
    
    let labelIds = [];
    if (t.labelsStr) {
      const allLabels = await getAllLabels();
      const tokens = t.labelsStr.split(/[,\s]+/).map(x => x.replace(/^#/, '').trim().toLowerCase()).filter(Boolean);
      tokens.forEach(tok => {
        const found = allLabels.find(l => l.name.toLowerCase() === tok || l.name.toLowerCase().includes(tok) || tok.includes(l.name.toLowerCase()));
        if (found && !labelIds.includes(found.id)) labelIds.push(found.id);
      });
    }

    await addTask({
      title: t.title,
      description: `Generováno ze zápisu: ${note.title}\nZodpovědná osoba: ${t.personName || 'Neurčeno'}\nTermín: ${t.deadlineStr || 'Neurčeno'}`,
      projectId: t.projectId,
      employeeId: empId,
      deadline: parsedDate,
      labelIds: labelIds,
      status: 'active',
      priority: 'medium'
    });
    
    // Mark as processed
    lines[t.lineIndex] = lines[t.lineIndex].replace(/(úkol:|ukol:|task:)/i, '✓ $1');
    isModified = true;
  }
  
  if (isModified) {
    await updateNote(note.id, { content: lines.join('\n') });
    showToast(`Vygenerováno ${tasksToCreate.length} úkolů!`, 'success');
  }
}

// Settings & Sync
document.getElementById('btn-settings').addEventListener('click', async () => {
  document.getElementById('set-app-name').value = await getSetting('appName') || 'ToDoM';
  const myEmpId = await getSetting('myEmployeeId');
  const allEmps = await getAllEmployees();
  const selectMyEmp = document.getElementById('set-my-employee');
  if (selectMyEmp) {
    selectMyEmp.innerHTML = '<option value="">— Nevybráno —</option>' + allEmps.sort((a,b) => a.name.localeCompare(b.name)).map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    if (myEmpId) selectMyEmp.value = myEmpId;
  }
  const lEx = await getSetting('lastExport');
  const lIm = await getSetting('lastImport');
  DOM.lastExportInfo.textContent = lEx ? `Export: ${new Date(lEx).toLocaleString('cs-CZ')}` : 'Nikdy neexportováno';
  DOM.lastImportInfo.textContent = lIm ? `Import: ${new Date(lIm).toLocaleString('cs-CZ')}` : 'Nikdy neimportováno';
  const [emps, tsks, nts, projs] = await Promise.all([db.employees.count(), db.tasks.count(), db.notes.count(), db.projects.count()]);
  DOM.syncStats.innerHTML = `
    <div style="display:flex; justify-content:space-around; text-align:center">
      <div><div style="font-size:1.5rem;font-weight:700">${tsks}</div><div style="font-size:0.75rem;color:var(--text-muted)">Úkolů</div></div>
      <div><div style="font-size:1.5rem;font-weight:700">${emps}</div><div style="font-size:0.75rem;color:var(--text-muted)">Lidí</div></div>
      <div><div style="font-size:1.5rem;font-weight:700">${nts}</div><div style="font-size:0.75rem;color:var(--text-muted)">Zápisů</div></div>
      <div><div style="font-size:1.5rem;font-weight:700">${projs}</div><div style="font-size:0.75rem;color:var(--text-muted)">Projektů</div></div>
    </div>
  `;
  openModal('modal-settings');
});

document.getElementById('btn-save-settings').addEventListener('click', async () => {
  const name = document.getElementById('set-app-name').value || 'ToDoM';
  await setSetting('appName', name);
  const selectMyEmp = document.getElementById('set-my-employee');
  if (selectMyEmp) await setSetting('myEmployeeId', selectMyEmp.value);
  DOM.headerTitle.textContent = name; document.title = name;
  closeModal('modal-settings'); showToast('Nastavení uloženo', 'success');
  renderCurrentView();
});

// Labels Management
document.getElementById('btn-manage-labels').addEventListener('click', () => {
  closeModal('modal-settings');
  renderLabelsList();
  openModal('modal-labels');
});
async function renderLabelsList() {
  const lbls = await getAllLabels();
  const list = document.getElementById('labels-list');
  if(lbls.length === 0) { list.innerHTML = '<span style="font-size:0.85rem;color:var(--text-muted)">Žádné štítky.</span>'; return; }
  list.innerHTML = lbls.map(l => `
    <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg-elevated);padding:8px 12px;border-radius:var(--radius-sm)">
      <span class="badge" style="background:${l.color}20; color:${l.color}; border: 1px solid ${l.color}40">${l.name}</span>
      <button class="btn btn-ghost btn-sm" onclick="deleteLabelAction(${l.id})">❌</button>
    </div>
  `).join('');
}
document.getElementById('form-label').addEventListener('submit', async (e) => {
  e.preventDefault();
  await addLabel({ name: document.getElementById('label-name').value, color: document.getElementById('label-color').value });
  document.getElementById('form-label').reset();
  await updateCache();
  await populateGlobalLabelFilter();
  renderLabelsList();
  renderCurrentView();
});
async function deleteLabelAction(id) {
  if(confirm('Opravdu smazat štítek?')) { 
    await deleteLabel(id); 
    await updateCache(); 
    await populateGlobalLabelFilter();
    renderLabelsList(); 
    renderCurrentView(); 
  }
}

// Global Search
document.getElementById('btn-global-search').addEventListener('click', () => {
  document.getElementById('global-search-input').value = '';
  document.getElementById('global-search-results').innerHTML = '';
  openModal('modal-global-search');
  setTimeout(()=>document.getElementById('global-search-input').focus(), 100);
});
document.getElementById('global-search-input').addEventListener('input', async (e) => {
  const q = e.target.value.toLowerCase();
  const res = document.getElementById('global-search-results');
  if (q.length < 2) { res.innerHTML = ''; return; }
  
  const [tasks, notes, emps, projs] = await Promise.all([getAllTasks(), getAllNotes(), getAllEmployees(), getAllProjects()]);
  
  const hitT = tasks.filter(t => t.title.toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q));
  const hitN = notes.filter(n => n.title.toLowerCase().includes(q) || (n.content||'').toLowerCase().includes(q));
  const hitE = emps.filter(x => x.name.toLowerCase().includes(q) || (x.notes||'').toLowerCase().includes(q));
  const hitP = projs.filter(p => p.name.toLowerCase().includes(q));
  
  let html = '';
  if(hitT.length) html += `<div class="section-title">Úkoly</div>` + hitT.map(t => `<div class="card" style="cursor:pointer;padding:8px 12px" onclick="closeModal('modal-global-search'); switchView('tasks'); editTask(${t.id})"><div>${t.title}</div><div style="font-size:0.75rem;color:var(--text-muted)">${t.status==='active'?'K vyřízení':'Hotovo'}</div></div>`).join('');
  if(hitN.length) html += `<div class="section-title">Zápisy</div>` + hitN.map(n => `<div class="card" style="cursor:pointer;padding:8px 12px" onclick="closeModal('modal-global-search'); switchView('notes'); editNote(${n.id})"><div>${n.title}</div></div>`).join('');
  if(hitE.length) html += `<div class="section-title">Lidé</div>` + hitE.map(x => `<div class="card" style="cursor:pointer;padding:8px 12px" onclick="closeModal('modal-global-search'); switchView('employees'); showEmployeeDetail(${x.id})"><div>${x.name}</div></div>`).join('');
  if(hitP.length) html += `<div class="section-title">Projekty</div>` + hitP.map(p => `<div class="card" style="cursor:pointer;padding:8px 12px" onclick="closeModal('modal-global-search'); switchView('projects'); editProject(${p.id})"><div>${p.name}</div></div>`).join('');
  
  if(!html) html = '<div class="empty-state" style="padding:20px"><p>Nic nenalezeno.</p></div>';
  res.innerHTML = html;
});

window.exportTasksToWord = async () => {
  let tasks = await getAllTasks();
  
  if (currentState.taskFilter === 'active') tasks = tasks.filter(t => t.status === 'active');
  if (currentState.taskFilter === 'in-progress') tasks = tasks.filter(t => t.status === 'in-progress');
  if (currentState.taskFilter === 'done') tasks = tasks.filter(t => t.status === 'done');
  if (currentState.taskFilter === 'my') {
    const ownerName = (await getSetting('ownerName') || '').trim().toLowerCase();
    tasks = tasks.filter(t => {
      const empIds = t.employeeIds || (t.employeeId ? [t.employeeId] : []);
      const empNames = empIds.map(id => (currentState.employeesMap[id]?.name || '').trim().toLowerCase());
      return empNames.some(n => ownerName && n.includes(ownerName));
    });
  }
  
  if (currentState.taskFilterLabelId) {
    const lId = parseInt(currentState.taskFilterLabelId);
    tasks = tasks.filter(t => t.labelIds && t.labelIds.includes(lId));
  }
  if (currentState.activeProjectId) tasks = tasks.filter(t => t.projectId === currentState.activeProjectId);
  if (currentState.taskFilterTeamIds && currentState.taskFilterTeamIds.length > 0) {
    const emps = await getAllEmployees();
    const teamEmpIds = emps.filter(e => e.teamIds && e.teamIds.some(tId => currentState.taskFilterTeamIds.includes(tId))).map(e => e.id);
    tasks = tasks.filter(t => {
      const empIds = t.employeeIds || (t.employeeId ? [t.employeeId] : []);
      return empIds.some(id => teamEmpIds.includes(id));
    });
  }
  if (currentState.taskFilterEmpId) {
    const filterId = parseInt(currentState.taskFilterEmpId);
    tasks = tasks.filter(t => {
      const empIds = t.employeeIds || (t.employeeId ? [t.employeeId] : []);
      return empIds.includes(filterId);
    });
  }
  if (currentState.searchTask) {
    const q = currentState.searchTask.toLowerCase();
    tasks = tasks.filter(t => {
      const empIds = t.employeeIds || (t.employeeId ? [t.employeeId] : []);
      const empNames = empIds.map(id => currentState.employeesMap[id]?.name || '').join(' ');
      return t.title.toLowerCase().includes(q) || 
             (t.description || '').toLowerCase().includes(q) ||
             empNames.toLowerCase().includes(q);
    });
  }

  const activeTasks = [];
  const inProgressTasks = [];
  const doneTasks = [];

  tasks.forEach(t => {
    if (t.status === 'done') doneTasks.push(t);
    else if (t.status === 'in-progress') inProgressTasks.push(t);
    else activeTasks.push(t);
  });

  let filterDesc = '';
  if (currentState.activeProjectId && currentState.projectsMap[currentState.activeProjectId]) {
    filterDesc += `Projekt: ${currentState.projectsMap[currentState.activeProjectId].name} | `;
  }
  if (currentState.taskFilterTeamIds && currentState.taskFilterTeamIds.length > 0) {
    const allTeams = await getAllTeams();
    const tNames = currentState.taskFilterTeamIds.map(id => allTeams.find(x => x.id === id)?.name).filter(Boolean).join(', ');
    filterDesc += `Týmy: ${tNames} | `;
  }
  if (currentState.taskFilterEmpId && currentState.employeesMap[currentState.taskFilterEmpId]) {
    filterDesc += `Osoba: ${currentState.employeesMap[currentState.taskFilterEmpId].name} | `;
  }
  if (filterDesc.endsWith(' | ')) filterDesc = filterDesc.substring(0, filterDesc.length - 3);

  let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'><title>Export Úkolů</title></head>
  <body>
  <style>
    body { font-family: Arial, sans-serif; }
    h1 { font-size: 16pt; margin-top: 24pt; margin-bottom: 8pt; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
    ul { margin-top: 0; padding-left: 20px; }
    li { margin-bottom: 12pt; }
    .urgent { color: #d32f2f; }
    .soon { color: #f57c00; }
    .low { color: #388e3c; }
    .done { color: #555555; text-decoration: line-through; }
    .emp-name { color: #555; font-size: 10pt; font-weight: normal; }
    .proj-name { color: #888; font-size: 10pt; font-style: italic; font-weight: normal; }
    .deadline { color: #d32f2f; font-size: 10pt; font-weight: bold; }
  </style>`;
  
  if (filterDesc) html += `<h2>Filtrováno podle: ${filterDesc}</h2><hr/>`;

  const h48 = Date.now() + 48*3600*1000;

  const getTaskHtml = (t) => {
    const empIds = t.employeeIds || (t.employeeId ? [t.employeeId] : []);
    const emps = empIds.map(id => currentState.employeesMap[id]?.name).filter(Boolean).join(', ');
    const proj = currentState.projectsMap[t.projectId]?.name;
    const dl = t.deadline ? new Date(t.deadline).toLocaleDateString('cs-CZ') : '';
    
    let prioHtml = '';
    if (t.status !== 'done') {
      if (t.priority === 'urgent') prioHtml = `<span class="urgent" style="font-size:8pt; border:1px solid #d32f2f; padding:2px 4px; margin-right:6px; font-weight:bold;">URGENTNÍ</span>`;
      else {
        const isSoon = t.deadline ? (new Date(t.deadline).getTime() <= h48) : (t.priority === 'medium');
        if (isSoon) prioHtml = `<span class="soon" style="font-size:8pt; border:1px solid #f57c00; padding:2px 4px; margin-right:6px; font-weight:bold;">Do 48 hodin</span>`;
        else prioHtml = `<span class="low" style="font-size:8pt; border:1px solid #388e3c; padding:2px 4px; margin-right:6px; font-weight:bold;">Nízké</span>`;
      }
    }

    let res = `<li>${prioHtml}<strong style="font-size:12pt;">${t.title}</strong>`;
    if (emps) res += ` <span class="emp-name">[${emps}]</span>`;
    if (proj) res += ` <span class="proj-name">(${proj})</span>`;
    if (dl) res += ` <span class="deadline">📅 ${dl}</span>`;
    if (t.description) res += `<br/><em style="color:#444;font-size:10pt;">${t.description.replace(/\\n/g, '<br/>')}</em>`;
    res += `</li>`;
    return res;
  };

  if (activeTasks.length > 0) {
    html += `<h1 style="color:#d32f2f">K vyřízení</h1><ul>`;
    activeTasks.forEach(t => { html += getTaskHtml(t); });
    html += `</ul>`;
  }
  if (inProgressTasks.length > 0) {
    html += `<h1 style="color:#f57c00">Rozpracované</h1><ul>`;
    inProgressTasks.forEach(t => { html += getTaskHtml(t); });
    html += `</ul>`;
  }
  if (doneTasks.length > 0) {
    html += `<h1 style="color:#388e3c">Hotovo</h1><ul>`;
    doneTasks.forEach(t => { html += getTaskHtml(t); });
    html += `</ul>`;
  }

  if (tasks.length === 0) {
    html += `<p>Žádné úkoly k exportu pro zadané filtry.</p>`;
  }

  html += `</body></html>`;

  window.lastExportedWordHtml = html;
  
  const iframe = document.getElementById('export-preview-content');
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  
  openModal('modal-export-preview');
};

window.downloadWordExport = () => {
  if (!window.lastExportedWordHtml) return;
  const blob = new Blob(['\\ufeff', window.lastExportedWordHtml], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('A');
  link.href = url;
  link.download = 'Ukoly_Export.doc';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  closeModal('modal-export-preview');
};

// ==========================================
// 11. Event Listeners
// ==========================================
function setupEventListeners() {
  document.addEventListener('click', (e) => {
    const d1 = document.getElementById('emp-team-dropdown-container');
    const b1 = document.getElementById('emp-team-checkboxes');
    if (d1 && b1 && !d1.contains(e.target)) {
      b1.style.display = 'none';
    }
    const d2 = document.getElementById('proj-team-dropdown-container');
    const b2 = document.getElementById('proj-team-checkboxes');
    if (d2 && b2 && !d2.contains(e.target)) {
      b2.style.display = 'none';
    }
    const dn = document.getElementById('note-team-dropdown-container');
    const bn = document.getElementById('note-team-checkboxes');
    if (dn && bn && !dn.contains(e.target)) {
      bn.style.display = 'none';
    }
    const dt = document.getElementById('task-team-dropdown-container');
    const bt = document.getElementById('task-team-checkboxes');
    if (dt && bt && !dt.contains(e.target)) {
      bt.style.display = 'none';
    }
  });


  DOM.navItems.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

  DOM.fab.addEventListener('click', async () => {
    if (currentState.view === 'tasks') {
      document.getElementById('modal-task-title').textContent = 'Nový úkol';
      document.getElementById('form-task').reset();
      document.getElementById('task-id').value = '';
      document.getElementById('btn-task-delete').style.display = 'none';
      await populateProjectSelect('task-project');
      
      allActiveEmployeesCache = await getActiveEmployees();
      allLabelsCache = await getAllLabels();
      
      currentState.currentTaskForm = {
        employeeIds: [],
        labelIds: [],
        checklist: [],
        notes: []
      };
      
      const selEmp = document.getElementById('task-employee-select');
      selEmp.innerHTML = '<option value="">— Vyberte osobu —</option>' + allActiveEmployeesCache.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
      const selLbl = document.getElementById('task-label-select');
      selLbl.innerHTML = '<option value="">— Přidat štítek —</option>' + allLabelsCache.map(l => `<option value="${l.id}">${l.name}</option>`).join('');

      renderTaskFormEmployeeChips();
      renderTaskFormLabelChips();
      renderTaskFormChecklist();
      renderTaskFormNotes();

      if (currentState.activeProjectId) document.getElementById('task-project').value = currentState.activeProjectId;
      openModal('modal-task');
    } else if (currentState.view === 'employees') {
      await openNewEmployeeModal();
    } else if (currentState.view === 'projects') {
      await openNewProjectModal();
    } else if (currentState.view === 'notes') {
      await openNewNoteModal();
    }
  });

  document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', () => {
    const mId = btn.getAttribute('data-modal'); if (mId) closeModal(mId);
  }));
  document.querySelectorAll('.modal-overlay').forEach(ov => ov.addEventListener('click', (e) => {
    if (e.target === ov) closeModal(ov.id);
  }));

  DOM.taskSearch.addEventListener('input', e => { currentState.searchTask = e.target.value; renderTasks(); });
  DOM.empSearch.addEventListener('input', e => { currentState.searchEmp = e.target.value; currentState.empPage = 1; renderEmployees(); });
  DOM.noteSearch.addEventListener('input', e => { currentState.searchNote = e.target.value; renderNotes(); });
  document.getElementById('note-filter-month')?.addEventListener('change', () => renderNotes());
  DOM.projSearch?.addEventListener('input', e => { currentState.searchProj = e.target.value; renderProjects(); });
  DOM.dashPrev.addEventListener('click', () => { currentState.dashboardTaskPage--; renderDashboard(); });
  DOM.dashNext.addEventListener('click', () => { currentState.dashboardTaskPage++; renderDashboard(); });
  DOM.taskFilterEmp.addEventListener('change', e => { 
    const val = e.target.value;
    currentState.taskFilterEmpId = val; 
    if (val) {
      currentState.taskFilterTeamIds = [];
      populateGlobalTeamFilter();
      
      currentState.taskFilterLabelId = "";
      const labelSel = document.getElementById('task-filter-label');
      if (labelSel) {
        labelSel.value = "";
        updateLabelFilterColor();
      }
    }
    renderTasks(); 
  });
  document.getElementById('task-filter-label')?.addEventListener('change', e => { 
    currentState.taskFilterLabelId = e.target.value; 
    updateLabelFilterColor();
    renderTasks(); 
  });

  document.querySelectorAll('#task-filters .filter-chip').forEach(f => f.addEventListener('click', () => {
    document.querySelectorAll('#task-filters .filter-chip').forEach(x => x.classList.remove('active')); f.classList.add('active');
    currentState.taskFilter = f.dataset.f; renderTasks();
  }));
  
  document.querySelectorAll('#view-employees .filter-chip').forEach(f => f.addEventListener('click', () => {
    document.querySelectorAll('#view-employees .filter-chip').forEach(x => x.classList.remove('active')); f.classList.add('active');
    currentState.empFilter = f.dataset.ef; currentState.empPage = 1; renderEmployees();
  }));
  
  document.querySelectorAll('.semafor-card').forEach(card => card.addEventListener('click', () => {
    const f = card.dataset.filter;
    switchView('tasks');
    document.querySelectorAll('#task-filters .filter-chip').forEach(x => x.classList.remove('active'));
    const chip = document.querySelector(`#task-filters .filter-chip[data-f="${f}"]`);
    if(chip) chip.classList.add('active');
    currentState.taskFilter = f; renderTasks();
  }));

  // Clear Context logic is handled earlier
  DOM.btnExport.addEventListener('click', async () => {
    try { 
      await exportAllData(); 
      showToast('Záloha stažena', 'success'); 
      const lEx = await getSetting('lastExport');
      DOM.lastExportInfo.textContent = lEx ? `Export: ${new Date(lEx).toLocaleString('cs-CZ')}` : '';
    }
    catch(err) { showToast('Chyba při exportu', 'error'); }
  });
  DOM.btnImportTrigger.addEventListener('click', () => DOM.importFileInput.click());
  DOM.importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const payload = JSON.parse(event.target.result);
        currentState.importPayload = payload;
        DOM.importFileInfo.innerHTML = `<strong>Soubor:</strong> ${file.name}<br><strong>Exportováno:</strong> ${new Date(payload._meta.exportDate).toLocaleString('cs-CZ')}`;
        openModal('modal-import');
      } catch (err) { showToast('Neplatný JSON soubor zálohy', 'error'); }
      DOM.importFileInput.value = '';
    };
    reader.readAsText(file);
  });
  DOM.importOptions.forEach(opt => opt.addEventListener('click', () => {
    DOM.importOptions.forEach(x => x.classList.remove('selected')); opt.classList.add('selected');
    currentState.importMode = opt.dataset.mode;
  }));
  DOM.btnImportConfirm.addEventListener('click', async () => {
    if (!currentState.importPayload) return;
    try {
      if (currentState.importMode === 'overwrite') await importOverwrite(currentState.importPayload);
      else await importMerge(currentState.importPayload);
      showToast('Import byl úspěšný', 'success'); closeModal('modal-import');
      currentState.importPayload = null; await populateGlobalEmployeeFilter(); renderCurrentView();
    } catch(err) { showToast('Chyba při importu', 'error'); }
  });

  window.toggleBulkSelectAll = function(type, checked) {
    const checkboxes = document.querySelectorAll(`.bulk-select-checkbox[data-type="${type}"]`);
    checkboxes.forEach(cb => { cb.checked = checked; });
    onBulkSelectChange(type);
  };

  window.onBulkSelectChange = function(type) {
    const checkboxes = document.querySelectorAll(`.bulk-select-checkbox[data-type="${type}"]:checked`);
    const count = checkboxes.length;
    const btn = document.getElementById(`btn-bulk-delete-${type}`);
    if (btn) {
      btn.style.display = count > 0 ? 'inline-flex' : 'none';
      const countSpan = btn.querySelector('.bulk-count');
      if (countSpan) countSpan.textContent = count;
    }
  };

  window.performBulkDelete = async function(type) {
    const checkboxes = document.querySelectorAll(`.bulk-select-checkbox[data-type="${type}"]:checked`);
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
    if (ids.length === 0) return;

    let msg = 'Opravdu chcete smazat vybrané položky?';
    if (type === 'project') msg = 'Opravdu chcete smazat vybrané projekty? Odpojí se od všech úkolů a lidí.';
    if (type === 'employee') msg = 'Opravdu chcete smazat vybrané lidi? Odpojí se od všech úkolů.';
    
    if (confirm(msg)) {
      try {
        for (const id of ids) {
          if (type === 'employee') await deleteEmployee(id);
          else if (type === 'team') await deleteTeam(id);
          else if (type === 'project') await deleteProject(id);
          else if (type === 'note') await deleteNote(id);
        }
        
        const btn = document.getElementById(`btn-bulk-delete-${type}`);
        if (btn) btn.style.display = 'none';
        
        showToast('Vybrané položky byly smazány', 'success');
        if (type === 'employee') {
          await populateGlobalEmployeeFilter();
        }
        renderCurrentView();
      } catch (err) {
        showToast('Chyba při hromadném mazání', 'error');
      }
    }
  };

  document.getElementById('btn-task-delete').addEventListener('click', async () => {
    if (confirm('Opravdu smazat?')) { const id = document.getElementById('task-id').value; if (id) { await deleteTask(parseInt(id)); closeModal('modal-task'); showToast('Smazáno'); renderCurrentView(); } }
  });
  document.getElementById('btn-emp-delete').addEventListener('click', async () => {
    if (confirm('Opravdu smazat?')) { const id = document.getElementById('emp-id').value; if (id) { await deleteEmployee(parseInt(id)); closeModal('modal-employee'); await populateGlobalEmployeeFilter(); showToast('Smazáno'); renderCurrentView(); } }
  });
  document.getElementById('btn-note-delete').addEventListener('click', async () => {
    if (confirm('Opravdu smazat?')) { const id = document.getElementById('note-id').value; if (id) { await deleteNote(parseInt(id)); closeModal('modal-note'); showToast('Smazáno'); renderCurrentView(); } }
  });
  document.getElementById('btn-proj-delete').addEventListener('click', async () => {
    if (confirm('Opravdu smazat projekt? Odpojí se od všech úkolů a lidí.')) { const id = document.getElementById('proj-id').value; if (id) { await deleteProject(parseInt(id)); closeModal('modal-project'); showToast('Smazáno'); renderCurrentView(); } }
  });

  const photoInput = document.getElementById('emp-photo-input');
  document.getElementById('emp-photo-preview').addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height; const MAX = 150;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } } else { if (h > MAX) { w *= MAX / h; h = MAX; } }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const b64 = canvas.toDataURL('image/jpeg', 0.8);
        document.getElementById('emp-photo-base64').value = b64;
        document.getElementById('emp-photo-preview').innerHTML = `<img src="${b64}">`;
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Task form multiselect and lists
  document.getElementById('task-employee-select')?.addEventListener('change', e => {
    const val = parseInt(e.target.value);
    if (val && !currentState.currentTaskForm.employeeIds.includes(val)) {
      currentState.currentTaskForm.employeeIds.push(val);
      renderTaskFormEmployeeChips();
    }
    e.target.value = "";
  });
  
  document.getElementById('task-label-select')?.addEventListener('change', e => {
    const val = parseInt(e.target.value);
    if (val && !currentState.currentTaskForm.labelIds.includes(val)) {
      currentState.currentTaskForm.labelIds.push(val);
      renderTaskFormLabelChips();
    }
    e.target.value = "";
  });

  document.getElementById('btn-add-checklist')?.addEventListener('click', () => {
    const input = document.getElementById('task-checklist-input');
    const text = input.value.trim();
    if (text) {
      currentState.currentTaskForm.checklist.push({ text, done: false });
      input.value = '';
      renderTaskFormChecklist();
    }
  });

  document.getElementById('btn-add-task-note')?.addEventListener('click', () => {
    const input = document.getElementById('task-note-input');
    const text = input.value.trim();
    if (text) {
      currentState.currentTaskForm.notes.push({ text, createdAt: new Date().toISOString() });
      input.value = '';
      renderTaskFormNotes();
    }
  });

  initSortable();
}

function initSortable() {
  if (typeof Sortable === 'undefined') return;
  const ka = document.getElementById('kanban-active'), kp = document.getElementById('kanban-in-progress'), kd = document.getElementById('kanban-done');
  
  const commonOptions = {
    group: 'tasks',
    animation: 150,
    draggable: '.card',
    fallbackOnBody: true,
    swapThreshold: 0.65,
    onEnd: handleTaskDrop,
    delay: 150,
    delayOnTouchOnly: true,
    touchStartThreshold: 5
  };

  if (ka && kp && kd) {
    new Sortable(ka, commonOptions);
    new Sortable(kp, commonOptions);
    new Sortable(kd, commonOptions);
  }
  const empList = document.getElementById('employees-list');
  if (empList) new Sortable(empList, {
    animation: 150,
    delay: 150,
    delayOnTouchOnly: true,
    touchStartThreshold: 5,
    onEnd: async () => {
      if (currentState.searchEmp || currentState.empFilter !== 'all') return;
      const items = empList.querySelectorAll('.card');
      for (let i=0; i<items.length; i++) {
        const m = items[i].getAttribute('onclick').match(/showEmployeeDetail\((\d+)\)/);
        if (m) await updateEmployee(parseInt(m[1]), { orderIndex: i });
      }
    }
  });
  const notesList = document.getElementById('notes-list');
  if (notesList) new Sortable(notesList, {
    animation: 150,
    delay: 150,
    delayOnTouchOnly: true,
    touchStartThreshold: 5,
    onEnd: async () => {
      const monthFilter = document.getElementById('note-filter-month');
      if (currentState.searchNote || (monthFilter && monthFilter.value)) return;
      const items = notesList.querySelectorAll('.card');
      for (let i=0; i<items.length; i++) {
        const onclickAttr = items[i].getAttribute('onclick');
        if (!onclickAttr) continue;
        const m = onclickAttr.match(/viewNote\((\d+)\)/);
        if (m) await updateNote(parseInt(m[1]), { orderIndex: i });
      }
    }
  });
}

async function handleTaskDrop(evt) {
  const toStatus = evt.to.dataset.status;
  const onclickAttr = evt.item.getAttribute('onclick');
  if (!onclickAttr) { renderCurrentView(); return; }
  const m = onclickAttr.match(/editTask\((\d+)\)/);
  if (!m) { renderCurrentView(); return; }
  const taskId = parseInt(m[1]);
  const items = evt.to.querySelectorAll('.card');
  for (let i=0; i<items.length; i++) {
    const onclickAttr = items[i].getAttribute('onclick');
    if (!onclickAttr) continue;
    const dm = onclickAttr.match(/editTask\((\d+)\)/);
    if (dm) {
      const dId = parseInt(dm[1]);
      if (dId === taskId) await updateTask(taskId, { status: toStatus, orderIndex: i });
      else await updateTask(dId, { orderIndex: i });
    }
  }
  renderCurrentView();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else initApp();

// Request notification permission on first user interaction (required by iOS Safari PWA)
function enableNotificationsOnGesture() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        showToast('Oznámení byla úspěšně povolena!', 'success');
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification('ToDoM', {
              body: 'Aplikace byla úspěšně propojena se systémem iOS.',
              icon: 'icon-192.png',
              badge: 'icon-192.png'
            });
          }).catch(()=>{});
        }
      } else {
        showToast('Oznámení byla zamítnuta. Povolte je v nastavení.', 'error');
      }
    });
  }
}
window.addEventListener('click', enableNotificationsOnGesture, { once: true });
window.addEventListener('touchstart', enableNotificationsOnGesture, { once: true });
