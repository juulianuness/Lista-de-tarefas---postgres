require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'troque_este_segredo_para_producao';
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERRO: defina DATABASE_URL no .env (veja .env.example)');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// Inicializa tabelas
async function initDb() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        priority TEXT NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('DB initialized');
  } finally {
    client.release();
  }
}

initDb().catch(err => { console.error('DB init error', err); process.exit(1); });

// Auth middleware
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Token não fornecido' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Formato de token inválido' });
  const token = parts[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido' });
    req.user = decoded;
    next();
  });
}

// REGISTER
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
      [email, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, email: user.email });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email já cadastrado' });
    console.error(err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Credenciais inválidas' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Credenciais inválidas' });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

// GET tasks
app.get('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const sql = `
      SELECT id, title, priority, completed, created_at
      FROM tasks
      WHERE user_id = $1
      ORDER BY
        CASE priority WHEN 'Alta' THEN 3 WHEN 'Média' THEN 2 WHEN 'Media' THEN 2 WHEN 'Baixa' THEN 1 ELSE 0 END DESC,
        created_at ASC
    `;
    const result = await pool.query(sql, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar tarefas' });
  }
});

// POST create task
app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, priority } = req.body;
    if (!title || !priority) return res.status(400).json({ error: 'title e priority obrigatórios' });
    const result = await pool.query(
      'INSERT INTO tasks (user_id, title, priority) VALUES ($1, $2, $3) RETURNING id, title, priority, completed, created_at',
      [userId, title, priority]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar tarefa' });
  }
});

// PUT update task
app.put('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;
    const { title, priority, completed } = req.body;

    const find = await pool.query('SELECT * FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
    if (find.rows.length === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });

    const newTitle = title !== undefined ? title : find.rows[0].title;
    const newPriority = priority !== undefined ? priority : find.rows[0].priority;
    const newCompleted = completed !== undefined ? completed : find.rows[0].completed;

    const updated = await pool.query(
      'UPDATE tasks SET title = $1, priority = $2, completed = $3 WHERE id = $4 RETURNING id, title, priority, completed, created_at',
      [newTitle, newPriority, newCompleted, taskId]
    );
    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar tarefa' });
  }
});

// DELETE task
app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const taskId = req.params.id;
    const del = await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [taskId, userId]);
    if (del.rowCount === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao deletar tarefa' });
  }
});

// Serve SPA somente se não for API
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`API rodando em http://localhost:${PORT}`));
