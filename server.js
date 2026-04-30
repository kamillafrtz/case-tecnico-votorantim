const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db, queries } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// cria a pasta de uploads se não existir
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    // TODO: talvez valha usar uuid aqui pra evitar colisão em uploads simultâneos
    cb(null, `foto_${Date.now()}${ext}`);
  }
});

// 5mb deve ser suficiente pra foto de perfil
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

const validarEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validarTel = (tel) => /^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/.test(tel);

// aplica sempre o maior desconto disponível pro cliente
// curitiba = 10%, sp = 5%, compra acima de 1000 = 15%
function calcularDesconto(valorBruto, cidade) {
  let descontoCidade = 0;

  if (cidade) {
    const c = cidade.trim().toLowerCase();
    if (c === 'curitiba') {
      descontoCidade = 0.10;
    } else if (c === 'são paulo' || c === 'sao paulo') {
      descontoCidade = 0.05;
    }
    // TODO: checar se tem outras cidades com desconto que eu possa ter esquecido
  }

  const descontoValor = valorBruto > 1000 ? 0.15 : 0;
  const pct = Math.max(descontoCidade, descontoValor);

  return {
    percentual: pct,
    valorDesconto: valorBruto * pct,
    valorFinal: valorBruto - valorBruto * pct
  };
}

// --- CLIENTES ---

app.post('/api/clientes', upload.single('foto'), (req, res) => {
  try {
    const {
      nome, sobrenome, data_nascimento, telefone, email,
      cep, rua, bairro, cidade, estado
    } = req.body;

    if (!nome || !sobrenome || !email || !cep)
      return res.status(400).json({ erro: 'Campos obrigatórios faltando' });

    if (!validarEmail(email))
      return res.status(400).json({ erro: 'E-mail inválido' });

    if (telefone && !validarTel(telefone))
      return res.status(400).json({ erro: 'Telefone inválido' });

    const jaExiste = db.prepare('SELECT id FROM clientes WHERE email = ?').get(email);
    if (jaExiste)
      return res.status(400).json({ erro: 'Esse e-mail já está cadastrado' });

    const foto = req.file ? `/uploads/${req.file.filename}` : null;

    const endResult = db.prepare(`
      INSERT INTO enderecos (cep, rua, bairro, cidade, estado)
      VALUES (?, ?, ?, ?, ?)
    `).run(cep, rua, bairro, cidade, estado);

    const result = db.prepare(`
      INSERT INTO clientes (nome, sobrenome, data_nascimento, telefone, email, foto, endereco_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(nome, sobrenome, data_nascimento, telefone, email, foto, endResult.lastInsertRowid);

    res.json({ id: result.lastInsertRowid, sucesso: true });
  } catch (err) {
    console.error('erro ao cadastrar cliente:', err);
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/clientes', (req, res) => {
  const clientes = db.prepare(`
    SELECT c.*, e.cep, e.rua, e.bairro, e.cidade, e.estado
    FROM clientes c
    LEFT JOIN enderecos e ON e.id = c.endereco_id
    ORDER BY c.id DESC
  `).all();

  // busca as compras separado pra não complicar o join principal
  const stmtCompras = db.prepare(`
    SELECT v.*, p.nome AS produto_nome
    FROM vendas v
    JOIN produtos p ON p.id = v.produto_id
    WHERE v.cliente_id = ?
  `);

  clientes.forEach(c => {
    c.compras = stmtCompras.all(c.id);
  });

  res.json(clientes);
});

app.get('/api/clientes/:id', (req, res) => {
  const cliente = db.prepare(`
    SELECT c.*, e.cep, e.rua, e.bairro, e.cidade, e.estado
    FROM clientes c
    LEFT JOIN enderecos e ON e.id = c.endereco_id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });
  res.json(cliente);
});

app.put('/api/clientes/:id', upload.single('foto'), (req, res) => {
  try {
    const {
      nome, sobrenome, data_nascimento, telefone, email,
      cep, rua, bairro, cidade, estado
    } = req.body;

    if (!validarEmail(email))
      return res.status(400).json({ erro: 'E-mail inválido' });

    if (telefone && !validarTel(telefone))
      return res.status(400).json({ erro: 'Telefone inválido' });

    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

    // se não enviou foto nova mantém a que já tinha
    const foto = req.file ? `/uploads/${req.file.filename}` : cliente.foto;

    db.prepare(`
      UPDATE enderecos SET cep=?, rua=?, bairro=?, cidade=?, estado=? WHERE id=?
    `).run(cep, rua, bairro, cidade, estado, cliente.endereco_id);

    db.prepare(`
      UPDATE clientes SET nome=?, sobrenome=?, data_nascimento=?, telefone=?, email=?, foto=? WHERE id=?
    `).run(nome, sobrenome, data_nascimento, telefone, email, foto, req.params.id);

    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/clientes/:id', (req, res) => {
  try {
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

    // deleta as vendas antes por causa da fk
    db.prepare('DELETE FROM vendas WHERE cliente_id = ?').run(req.params.id);
    db.prepare('DELETE FROM clientes WHERE id = ?').run(req.params.id);
    if (cliente.endereco_id)
      db.prepare('DELETE FROM enderecos WHERE id = ?').run(cliente.endereco_id);

    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// --- PRODUTOS ---

app.post('/api/produtos', (req, res) => {
  try {
    const { codigo, nome, descricao, valor } = req.body;

    if (!codigo || !nome || valor == null)
      return res.status(400).json({ erro: 'Campos obrigatórios faltando' });

    const existente = db.prepare('SELECT id FROM produtos WHERE codigo = ?').get(codigo);
    if (existente)
      return res.status(400).json({ erro: 'Esse código de produto já existe' });

    const result = db.prepare(`
      INSERT INTO produtos (codigo, nome, descricao, valor)
      VALUES (?, ?, ?, ?)
    `).run(codigo, nome, descricao, parseFloat(valor));

    res.json({ id: result.lastInsertRowid, sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/produtos', (_req, res) => {
  res.json(db.prepare('SELECT * FROM produtos ORDER BY id DESC').all());
});

app.put('/api/produtos/:id', (req, res) => {
  try {
    const { codigo, nome, descricao, valor } = req.body;

    const codigoJaUsado = db.prepare('SELECT id FROM produtos WHERE codigo = ? AND id != ?').get(codigo, req.params.id);
    if (codigoJaUsado)
      return res.status(400).json({ erro: 'Esse código de produto já existe' });

    db.prepare(`
      UPDATE produtos SET codigo=?, nome=?, descricao=?, valor=? WHERE id=?
    `).run(codigo, nome, descricao, parseFloat(valor), req.params.id);

    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/produtos/:id', (req, res) => {
  try {
    // TODO: verificar se tem vendas vinculadas antes de deixar deletar?
    db.prepare('DELETE FROM produtos WHERE id = ?').run(req.params.id);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// --- VENDAS ---

app.post('/api/vendas', (req, res) => {
  try {
    const { cliente_id, produto_id, quantidade } = req.body;

    if (!cliente_id || !produto_id || !quantidade)
      return res.status(400).json({ erro: 'Campos obrigatórios faltando' });

    const cliente = db.prepare(`
      SELECT c.*, e.cidade FROM clientes c
      LEFT JOIN enderecos e ON e.id = c.endereco_id
      WHERE c.id = ?
    `).get(cliente_id);
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(produto_id);
    if (!produto) return res.status(404).json({ erro: 'Produto não encontrado' });

    const valorBruto = produto.valor * parseInt(quantidade);
    const { percentual, valorFinal } = calcularDesconto(valorBruto, cliente.cidade);

    const result = db.prepare(`
      INSERT INTO vendas (cliente_id, produto_id, quantidade, valor_total, desconto_aplicado)
      VALUES (?, ?, ?, ?, ?)
    `).run(cliente_id, produto_id, quantidade, valorFinal, percentual);

    res.json({
      id: result.lastInsertRowid,
      valor_bruto: valorBruto,
      desconto_percentual: percentual,
      valor_final: valorFinal,
      sucesso: true
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.get('/api/vendas', (_req, res) => {
  const vendas = db.prepare(`
    SELECT v.*, p.nome AS produto_nome,
           c.nome || ' ' || c.sobrenome AS cliente_nome
    FROM vendas v
    JOIN produtos p ON p.id = v.produto_id
    JOIN clientes c ON c.id = v.cliente_id
    ORDER BY v.id DESC
  `).all();
  res.json(vendas);
});

// --- RELATÓRIOS ---

app.get('/api/relatorios/clientes', (_req, res) => res.json(queries.listarTodosClientes()));
app.get('/api/relatorios/clientes-por-cidade', (_req, res) => res.json(queries.qtdClientesPorCidade()));
app.get('/api/relatorios/vendas-por-cliente', (_req, res) => res.json(queries.totalVendasPorCliente()));
app.get('/api/relatorios/media-mensal', (_req, res) => res.json(queries.mediaVendasPorMes()));
app.get('/api/relatorios/cidade-top', (_req, res) => res.json(queries.cidadeComMaisVendas()));

app.listen(PORT, () => {
  console.log(`servidor rodando em http://localhost:${PORT}`);
});
