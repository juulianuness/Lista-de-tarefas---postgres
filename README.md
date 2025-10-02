# todo-app-postgres

Versão do projeto usando **Postgres** como banco. API Node.js + Express que gerencia usuários e tarefas.
Cada usuário vê apenas suas tarefas. Inclui autenticação JWT.

## Como usar (resumo)
1. Instale Node.js (v16+).
2. Instale dependências: `npm install`
3. Crie um banco Postgres e ajuste `DATABASE_URL` no arquivo `.env`.
4. Copie `.env.example` para `.env` e coloque suas credenciais.
5. Rode o servidor: `npm start`
6. Abra `http://localhost:3000` e use register/login.

Arquivos inclusos:
- server.js (API)
- public/* (frontend)
- package.json
- .env.example
