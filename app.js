// Simple to-do app (lists + tasks) with localStorage persistence
const STORAGE_KEY = 'simple_todo_v1';

// Data shape: { lists: [{id, name, tasks: [{id,title,desc,due,completed,createdAt}]}], selectedListId }
let state = { lists: [], selectedListId: null };

// Helpers
const $ = id => document.getElementById(id);
const fmt = (dt) => dt ? new Date(dt).toLocaleString() : '';
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function load() { const raw = localStorage.getItem(STORAGE_KEY); if (raw) state = JSON.parse(raw); else {
  // seed sample list
  state = { lists: [{ id: genId(), name: 'Personal', tasks: [] }, { id: genId(), name: 'Work', tasks: [] }], selectedListId: null };
  state.selectedListId = state.lists[0].id;
} }

// Rendering
function renderLists(){
  const ul = $('lists'); ul.innerHTML = '';
  state.lists.forEach(list => {
    const li = document.createElement('li');
    li.className = list.id === state.selectedListId ? 'active' : '';
    li.tabIndex = 0;
    li.innerHTML = `<span class="name">${escapeHtml(list.name)}</span><div><button data-id="${list.id}" class="select">Open</button></div>`;
    li.querySelector('.select').addEventListener('click', () => { selectList(list.id); });
    li.addEventListener('dblclick', () => { selectList(list.id); });
    ul.appendChild(li);
  });
}

function renderHeader(){
  const list = state.lists.find(l => l.id === state.selectedListId);
  $('current-list-name').textContent = list ? list.name : '(No list)';
}

function renderTasks(){
  const tasksEl = $('tasks'); tasksEl.innerHTML = '';
  const list = state.lists.find(l => l.id === state.selectedListId);
  if (!list) return;

  // sorting
  const sort = $('sort-select').value;
  let tasks = [...list.tasks];
  if(sort === 'due') tasks.sort((a,b)=> (a.due||'') > (b.due||'') ? 1 : -1);
  if(sort === 'created') tasks.sort((a,b)=> a.createdAt - b.createdAt);

  tasks.forEach((task, idx) => {
    const li = document.createElement('li');
    li.className = 'task' + (task.completed ? ' completed' : '') + (task.due && new Date(task.due) < new Date() && !task.completed ? ' overdue' : '');
    li.innerHTML = `
      <div class="left">
        <div style="display:flex;gap:10px;align-items:center">
          <button class="checkbox" data-id="${task.id}">${task.completed? '✓':''}</button>
          <div>
            <h4>${escapeHtml(task.title)}</h4>
            ${task.desc ? `<p>${escapeHtml(task.desc)}</p>` : ''}
            <div class="meta">
              ${task.due? `<span>Due: ${fmt(task.due)}</span>` : ''}
              <span>Added: ${new Date(task.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="actions">
        <button data-action="edit" data-id="${task.id}">Edit</button>
        <button data-action="up" data-id="${task.id}">▲</button>
        <button data-action="down" data-id="${task.id}">▼</button>
        <button data-action="delete" data-id="${task.id}">Delete</button>
      </div>
    `;

    // attach handlers
    li.querySelector('.checkbox').addEventListener('click', e=>{ toggleComplete(task.id); });
    li.querySelectorAll('.actions button').forEach(btn=>{
      btn.addEventListener('click', e=> handleTaskAction(e.target.dataset.action, e.target.dataset.id));
    });

    tasksEl.appendChild(li);
  });
}

function escapeHtml(s){ if(!s) return ''; return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

// Actions
function addList(name){ if(!name) return; const l={id:genId(),name,tasks:[]}; state.lists.push(l); state.selectedListId = l.id; save(); renderAll(); }
function selectList(id){ state.selectedListId = id; save(); renderAll(); }
function renameList(id,newName){ const l = state.lists.find(x=>x.id===id); if(l && newName){ l.name=newName; save(); renderAll(); } }
function deleteList(id){ const idx = state.lists.findIndex(x=>x.id===id); if(idx>-1){ if(!confirm('Delete this list and all tasks?')) return; state.lists.splice(idx,1); if(state.lists.length) state.selectedListId = state.lists[0].id; else state.selectedListId = null; save(); renderAll(); } }

function addTask(title, desc, due){ const list = state.lists.find(l=>l.id===state.selectedListId); if(!list) return; const task = { id:genId(), title, desc, due: due||null, completed:false, createdAt: Date.now() }; list.tasks.push(task); save(); renderAll(); }
function findTask(id){ const list = state.lists.find(l=>l.id===state.selectedListId); if(!list) return [null,-1]; const idx = list.tasks.findIndex(t=>t.id===id); return [list.tasks[idx]||null, idx]; }
function toggleComplete(taskId){ const [t] = findTask(taskId); if(!t) return; t.completed = !t.completed; save(); renderAll(); }
function handleTaskAction(action, id){ if(action==='edit') openEditModal(id); else if(action==='delete'){ if(confirm('Delete this task?')){ deleteTask(id); } } else if(action==='up'){ moveTask(id, -1); } else if(action==='down'){ moveTask(id, +1); } }
function deleteTask(id){ const list = state.lists.find(l=>l.id===state.selectedListId); if(!list) return; const i = list.tasks.findIndex(t=>t.id===id); if(i>-1){ list.tasks.splice(i,1); save(); renderAll(); } }
function moveTask(id, dir){ const list = state.lists.find(l=>l.id===state.selectedListId); if(!list) return; const i = list.tasks.findIndex(t=>t.id===id); if(i===-1) return; const j = i+dir; if(j<0||j>=list.tasks.length) return; [list.tasks[i], list.tasks[j]] = [list.tasks[j], list.tasks[i]]; save(); renderAll(); }

// Edit modal
let editingTaskId = null;
function openEditModal(id){ const [t] = findTask(id); if(!t) return; editingTaskId = id; $('edit-task-title').value = t.title; $('edit-task-desc').value = t.desc||''; $('edit-task-due').value = t.due ? toDateTimeLocal(t.due) : ''; showModal(true); }
function saveEditModal(e){ e.preventDefault(); const title = $('edit-task-title').value.trim(); const desc = $('edit-task-desc').value.trim(); const due = $('edit-task-due').value || null; const [t] = findTask(editingTaskId); if(!t) return; t.title = title; t.desc = desc; t.due = due; save(); showModal(false); renderAll(); }
function showModal(show){ const m = $('edit-modal'); m.setAttribute('aria-hidden', show? 'false':'true'); }
function toDateTimeLocal(val){ if(!val) return ''; const d = new Date(val); // convert to yyyy-mm-ddThh:mm
  const pad=(n)=> String(n).padStart(2,'0');
  const s = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; return s;
}

// Import/Export
function exportData(){ const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='todo-export.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function importDataFile(file){ const reader = new FileReader(); reader.onload = ()=>{ try{ const data = JSON.parse(reader.result); if(data && Array.isArray(data.lists)) { state = data; if(!state.selectedListId && state.lists[0]) state.selectedListId = state.lists[0].id; save(); renderAll(); alert('Imported successfully'); } else alert('Invalid format'); }catch(err){ alert('Invalid JSON'); } }; reader.readAsText(file); }

// UI wiring
function renderAll(){ renderLists(); renderHeader(); renderTasks(); }

function wire(){
  // forms
  $('add-list-form').addEventListener('submit', e=>{ e.preventDefault(); const v = $('new-list-name').value.trim(); if(!v) return; addList(v); $('new-list-name').value=''; });
  $('add-task-form').addEventListener('submit', e=>{ e.preventDefault(); const title = $('task-title').value.trim(); const desc = $('task-desc').value.trim(); const due = $('task-due').value || null; if(!title) return; addTask(title, desc, due); $('task-title').value=''; $('task-desc').value=''; $('task-due').value=''; });
  $('sort-select').addEventListener('change', renderTasks);

  $('rename-list').addEventListener('click', ()=>{
    const list = state.lists.find(l=>l.id===state.selectedListId); if(!list) return; const name = prompt('Rename list', list.name); if(name) renameList(list.id, name.trim()); });
  $('delete-list').addEventListener('click', ()=>{ if(!state.selectedListId) return; deleteList(state.selectedListId); });

  $('edit-task-form').addEventListener('submit', saveEditModal);
  $('cancel-edit').addEventListener('click', ()=> showModal(false));

  $('export-data').addEventListener('click', exportData);
  $('import-data').addEventListener('click', ()=> $('import-input').click());
  $('import-input').addEventListener('change', e=>{ if(e.target.files.length) importDataFile(e.target.files[0]); e.target.value=''; });
}

// Init
load(); wire(); renderAll();

// small interval to highlight overdue changes (re-render every minute)
setInterval(()=>{ renderTasks(); }, 60*1000);
