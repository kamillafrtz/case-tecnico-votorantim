// configuração do banco usando o sqlite nativo do Node 24
// não precisei de biblioteca externa, o node:sqlite já resolve
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const _db = new DatabaseSync(path.join(__dirname, 'banco.db'));

_db.exec(`PRAGMA journal_mode = WAL`);
_db.exec(`PRAGMA foreign_keys = ON`);

_db.exec(`
  CREATE TABLE IF NOT EXISTS enderecos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cep TEXT NOT NULL,
    rua TEXT,
    bairro TEXT,
    cidade TEXT,
    estado TEXT
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    sobrenome TEXT NOT NULL,
    data_nascimento TEXT,
    telefone TEXT,
    email TEXT NOT NULL,
    foto TEXT,
    data_cadastro TEXT DEFAULT CURRENT_TIMESTAMP,
    endereco_id INTEGER,
    FOREIGN KEY (endereco_id) REFERENCES enderecos(id)
  );

  CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    descricao TEXT,
    valor REAL NOT NULL,
    data_cadastro TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vendas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    valor_total REAL NOT NULL,
    desconto_aplicado REAL DEFAULT 0,
    data_compra TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  );
`);

// o node:sqlite tem uma API levemente diferente do better-sqlite3
// esse wrapper deixa o server.js mais limpo
function prepare(sql) {
  const stmt = _db.prepare(sql);
  return {
    run: (...params) => {
      const result = stmt.run(...params);
      return { lastInsertRowid: result.lastInsertRowid, changes: result.changes };
    },
    get: (...params) => stmt.get(...params),
    all: (...params) => stmt.all(...params),
  };
}

const db = { prepare };

// queries dos relatórios (requisito 9)
const queries = {

  listarTodosClientes: () => db.prepare(`
    SELECT c.id, c.nome, c.sobrenome, c.email, c.telefone, c.data_nascimento,
           e.cep, e.rua, e.bairro, e.cidade, e.estado
    FROM clientes c
    LEFT JOIN enderecos e ON e.id = c.endereco_id
    ORDER BY c.id DESC
  `).all(),

  qtdClientesPorCidade: () => db.prepare(`
    SELECT e.cidade, COUNT(*) AS quantidade
    FROM clientes c
    JOIN enderecos e ON e.id = c.endereco_id
    GROUP BY e.cidade
    ORDER BY quantidade DESC
  `).all(),

  totalVendasPorCliente: () => db.prepare(`
    SELECT c.id, c.nome || ' ' || c.sobrenome AS cliente,
           COALESCE(SUM(v.valor_total), 0) AS total_vendas
    FROM clientes c
    LEFT JOIN vendas v ON v.cliente_id = c.id
    GROUP BY c.id
    ORDER BY total_vendas DESC
  `).all(),

  // agrupa por mês no formato YYYY-MM
  mediaVendasPorMes: () => db.prepare(`
    SELECT strftime('%Y-%m', data_compra) AS mes,
           ROUND(AVG(valor_total), 2) AS media,
           COUNT(*) AS qtd_vendas
    FROM vendas
    GROUP BY mes
    ORDER BY mes DESC
  `).all(),

  cidadeComMaisVendas: () => db.prepare(`
    SELECT e.cidade, COUNT(v.id) AS qtd_vendas, SUM(v.valor_total) AS total
    FROM vendas v
    JOIN clientes c ON c.id = v.cliente_id
    JOIN enderecos e ON e.id = c.endereco_id
    GROUP BY e.cidade
    ORDER BY qtd_vendas DESC
    LIMIT 1
  `).get()
};

module.exports = { db, queries };
