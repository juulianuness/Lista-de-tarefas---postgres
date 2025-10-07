const API_BASE = 'http://localhost:3000';

let token = localStorage.getItem('token') || null;
let userEmail = localStorage.getItem('userEmail') || null;

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateUI();
});

function setupEventListeners() {
  document.getElementById('btnShowAuth').addEventListener('click', toggleAuthContainer);

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao logar');
      token = data.token;
      userEmail = data.email;
      localStorage.setItem('token', token);
      localStorage.setItem('userEmail', userEmail);
      updateUI();
    } catch (err) { alert(err.message); }
  });

  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    try {
      const res = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao registrar');
      token = data.token;
      userEmail = data.email;
      localStorage.setItem('token', token);
      localStorage.setItem('userEmail', userEmail);
      updateUI();
    } catch (err) { alert(err.message); }
  });

  document.getElementById('formTarefa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('tarefa').value.trim();
    const priority = document.getElementById('prioridade').value;
    if (!title || !priority) return alert('Preencha título e prioridade');
    try {
      const res = await fetch(`${API_BASE}/api/tasks`, {
        method: 'POST',
        headers: {'Content-Type':'application/json','Authorization':'Bearer '+token},
        body: JSON.stringify({ title, priority })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao criar tarefa');
      document.getElementById('tarefa').value = '';
      document.getElementById('prioridade').value = '';
      await loadTasks();
    } catch (err) { alert(err.message); }
  });
}

function toggleAuthContainer() {
  const c = document.getElementById('authContainer');
  c.style.display = c.style.display === 'none' ? 'block' : 'none';
}

function updateUI() {
  const userArea = document.getElementById('userArea');
  const app = document.getElementById('app');
  const authContainer = document.getElementById('authContainer');

  if (token) {
    userArea.innerHTML = `<span class="me-3">Olá, ${escapeHtml(userEmail)}</span><button id="btnLogout" class="btn btn-outline-danger btn-sm">Sair</button>`;
    document.getElementById('btnLogout').addEventListener('click', logout);
    authContainer.style.display = 'none';
    app.style.display = 'block';
    loadTasks();
  } else {
    userArea.innerHTML = `<button id="btnShowAuth" class="btn btn-outline-primary btn-sm">Entrar / Registrar</button>`;
    document.getElementById('btnShowAuth').addEventListener('click', toggleAuthContainer);
    authContainer.style.display = 'none';
    app.style.display = 'none';
  }
}

function logout() {
  token = null;
  userEmail = null;
  localStorage.removeItem('token');
  localStorage.removeItem('userEmail');
  updateUI();
}

async function loadTasks() {
  try {
    const res = await fetch(`${API_BASE}/api/tasks`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const tasks = await res.json();
    if (!res.ok) throw new Error(tasks.error || 'Erro ao buscar tarefas');
    renderTasks(tasks);
  } catch (err) {
    alert(err.message);
    if (err.message.toLowerCase().includes('token')) logout();
  }
}

function renderTasks(tasks) {
  const tbody = document.getElementById('tabelaTarefas');
  tbody.innerHTML = '';
  tasks.forEach(t => {
    const tr = document.createElement('tr');
    if (t.completed) tr.classList.add('completed');

    // Colunas
    const tdTitle = document.createElement('td');
    tdTitle.textContent = t.title;

    const tdPriority = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = 'priority-badge ' + t.priority.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    badge.textContent = t.priority;
    tdPriority.appendChild(badge);

    const tdAction = document.createElement('td');
    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = t.completed;
    chk.className = 'form-check-input me-2';
    chk.addEventListener('change', () => toggleCompleted(t.id, chk.checked));
    const label = document.createElement('span');
    label.textContent = 'Feito';
    label.className = 'me-3';
    const del = document.createElement('button');
    del.className = 'btn-delete';
    del.textContent = 'Excluir';
    del.addEventListener('click', () => { if(confirm('Deletar esta tarefa?')) deleteTask(t.id); });
    tdAction.appendChild(chk);
    tdAction.appendChild(label);
    tdAction.appendChild(del);

    tr.appendChild(tdTitle);
    tr.appendChild(tdPriority);
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  });
}

async function toggleCompleted(id, completed) {
  try {
    const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
      method: 'PUT',
      headers: {'Content-Type':'application/json','Authorization':'Bearer '+token},
      body: JSON.stringify({ completed })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro');
    await loadTasks();
  } catch (err) { alert(err.message); }
}

async function deleteTask(id) {
  try {
    const res = await fetch(`${API_BASE}/api/tasks/${id}`, {
      method: 'DELETE',
      headers: {'Authorization':'Bearer '+token}
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao deletar');
    await loadTasks();
  } catch (err) { alert(err.message); }
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
