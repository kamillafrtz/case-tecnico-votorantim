class Endereco {
  constructor({ cep, rua, bairro, cidade, estado }) {
    this.cep = cep;
    this.rua = rua;
    this.bairro = bairro;
    this.cidade = cidade;
    this.estado = estado;
  }
}

class Cliente {
  constructor({ id, nome, sobrenome, data_nascimento, telefone, email, foto, endereco }) {
    this.id = id;
    this.nome = nome;
    this.sobrenome = sobrenome;
    this.data_nascimento = data_nascimento;
    this.telefone = telefone;
    this.email = email;
    this.foto = foto;
    this.endereco = endereco; 
  }
  nomeCompleto() { return `${this.nome} ${this.sobrenome}`; }
}

class Produto {
  constructor({ id, codigo, nome, descricao, valor, data_cadastro }) {
    this.id = id;
    this.codigo = codigo;
    this.nome = nome;
    this.descricao = descricao;
    this.valor = valor;
    this.data_cadastro = data_cadastro;
  }
}

class Venda {
  constructor({ id, cliente_id, produto_id, quantidade, valor_total, data_compra }) {
    this.id = id;
    this.cliente_id = cliente_id;
    this.produto_id = produto_id;
    this.quantidade = quantidade;
    this.valor_total = valor_total;
    this.data_compra = data_compra;
  }
}

const estado = {
  clientes: [],
  produtos: [],
  vendas: [],
  paginaAtual: 1,
  porPagina: 5
};

const $ = (id) => document.getElementById(id);
const fmtMoeda = (v) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
const fmtData = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';

function showMsg(elementId, texto, tipo = 'success') {
  const el = $(elementId);
  el.className = `msg show ${tipo}`;
  el.textContent = texto;
  setTimeout(() => el.classList.remove('show'), 4000);
}

const validarEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validarTelefone = (t) => /^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/.test(t);

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    $('tab-' + tab.dataset.tab).classList.add('active');
  });
});

async function buscarCep() {
  const cep = $('cep').value.replace(/\D/g, '');
  if (cep.length !== 8) {
    showMsg('msg-cliente', 'CEP deve conter 8 dígitos', 'error');
    return;
  }
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cep}`);
    if (!res.ok) throw new Error('CEP não encontrado');
    const dados = await res.json();
    $('rua').value = dados.street || '';
    $('bairro').value = dados.neighborhood || '';
    $('cidade').value = dados.city || '';
    $('estado').value = dados.state || '';
    showMsg('msg-cliente', 'CEP encontrado!', 'success');
  } catch (err) {
    showMsg('msg-cliente', `Erro ao buscar CEP: ${err.message}`, 'error');
  }
}

$('btn-buscar-cep').addEventListener('click', buscarCep);
$('cep').addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); buscarCep(); } });

$('form-cliente').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validarEmail($('email').value)) return showMsg('msg-cliente', 'E-mail inválido', 'error');
  const tel = $('telefone').value;
  if (tel && !validarTelefone(tel)) return showMsg('msg-cliente', 'Telefone inválido. Ex: (11) 91234-5678', 'error');

  const fd = new FormData();
  ['nome', 'sobrenome', 'data_nascimento', 'telefone', 'email',
   'cep', 'rua', 'bairro', 'cidade', 'estado'].forEach(c => fd.append(c, $(c).value));
  if ($('foto').files[0]) fd.append('foto', $('foto').files[0]);

  const id = $('cliente-id').value;
  const url = id ? `/api/clientes/${id}` : '/api/clientes';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, { method, body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro);
    showMsg('msg-cliente', id ? 'Cliente atualizado!' : 'Cliente cadastrado!', 'success');
    limparFormCliente();
    await carregarClientes();
  } catch (err) {
    showMsg('msg-cliente', `Erro: ${err.message}`, 'error');
  }
});

$('btn-editar-cliente').addEventListener('click', () => $('form-cliente').requestSubmit());

$('btn-deletar-cliente').addEventListener('click', async () => {
  const id = $('cliente-id').value;
  if (!id || !confirm('Confirma a exclusão deste cliente?')) return;
  try {
    const res = await fetch(`/api/clientes/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Falha ao deletar');
    showMsg('msg-cliente', 'Cliente deletado', 'success');
    limparFormCliente();
    await carregarClientes();
  } catch (err) {
    showMsg('msg-cliente', err.message, 'error');
  }
});

$('btn-limpar-cliente').addEventListener('click', limparFormCliente);

function limparFormCliente() {
  $('form-cliente').reset();
  $('cliente-id').value = '';
  $('form-cliente-titulo').textContent = 'Cadastro de Cliente';
  $('btn-salvar-cliente').classList.remove('hidden');
  $('btn-editar-cliente').classList.add('hidden');
  $('btn-deletar-cliente').classList.add('hidden');
}

function carregarClienteNoForm(c) {
  $('cliente-id').value = c.id;
  $('nome').value = c.nome;
  $('sobrenome').value = c.sobrenome;
  $('data_nascimento').value = c.data_nascimento || '';
  $('telefone').value = c.telefone || '';
  $('email').value = c.email;
  $('cep').value = c.cep || '';
  $('rua').value = c.rua || '';
  $('bairro').value = c.bairro || '';
  $('cidade').value = c.cidade || '';
  $('estado').value = c.estado || '';
  $('form-cliente-titulo').textContent = `Editando Cliente #${c.id}`;
  $('btn-salvar-cliente').classList.add('hidden');
  $('btn-editar-cliente').classList.remove('hidden');
  $('btn-deletar-cliente').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function carregarClientes() {
  const res = await fetch('/api/clientes');
  const dados = await res.json();
  estado.clientes = dados.map(d => new Cliente({
    ...d,
    endereco: new Endereco({ cep: d.cep, rua: d.rua, bairro: d.bairro, cidade: d.cidade, estado: d.estado })
  }));
  estado.clientes.forEach((c, i) => { c.compras = dados[i].compras; c.data_cadastro = dados[i].data_cadastro; });
  popularFiltrosAno();
  renderizarTabelaClientes();
  popularSelectClientes();
}

function popularFiltrosAno() {
  const anos = [...new Set(estado.clientes.map(c => (c.data_cadastro || '').substring(0, 4)).filter(Boolean))];
  const sel = $('filtro-ano');
  const valorAtual = sel.value;
  sel.innerHTML = '<option value="">Todos</option>' + anos.map(a => `<option value="${a}">${a}</option>`).join('');
  sel.value = valorAtual;
}

function aplicarFiltrosOrdenacao(lista) {
  const ano = $('filtro-ano').value;
  const mes = $('filtro-mes').value;
  const ord = $('ordenacao').value;

  let filtrada = lista.filter(c => {
    const data = c.data_cadastro || '';
    if (ano && data.substring(0, 4) !== ano) return false;
    if (mes && data.substring(5, 7) !== mes) return false;
    return true;
  });

  filtrada.sort((a, b) => {
    if (ord === 'id-desc') return b.id - a.id;
    if (ord === 'id-asc') return a.id - b.id;
    if (ord === 'nome-asc') return a.nome.localeCompare(b.nome);
    if (ord === 'nome-desc') return b.nome.localeCompare(a.nome);
  });
  return filtrada;
}

function renderizarTabelaClientes() {
  const filtrada = aplicarFiltrosOrdenacao(estado.clientes);
  const totalPaginas = Math.max(1, Math.ceil(filtrada.length / estado.porPagina));
  if (estado.paginaAtual > totalPaginas) estado.paginaAtual = totalPaginas;

  const inicio = (estado.paginaAtual - 1) * estado.porPagina;
  const pagina = filtrada.slice(inicio, inicio + estado.porPagina);

  const tbody = document.querySelector('#tabela-clientes tbody');
  tbody.innerHTML = pagina.map(c => {
    const compras = (c.compras || []).map(v =>
      `${v.produto_nome} (${v.quantidade}x) - ${fmtMoeda(v.valor_total)}`
    ).join('<br>') || '-';
    const fotoHtml = c.foto
      ? `<img src="${c.foto}" class="foto-tabela" alt="">`
      : `<div class="foto-tabela"></div>`;
    return `
      <tr data-id="${c.id}">
        <td>${fotoHtml}</td>
        <td>${c.id}</td>
        <td>${c.nomeCompleto()}</td>
        <td>${c.email}</td>
        <td>${c.telefone || '-'}</td>
        <td>${c.endereco.cidade || '-'}</td>
        <td>${fmtData(c.data_cadastro)}</td>
        <td style="font-size:0.8rem">${compras}</td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const cliente = estado.clientes.find(c => c.id == tr.dataset.id);
      const dadosForm = {
        ...cliente, ...cliente.endereco
      };
      carregarClienteNoForm(dadosForm);
    });
  });

  $('page-info').textContent = `Página ${estado.paginaAtual} de ${totalPaginas}`;
}

['filtro-ano', 'filtro-mes', 'ordenacao'].forEach(id =>
  $(id).addEventListener('change', () => { estado.paginaAtual = 1; renderizarTabelaClientes(); })
);

$('prev-page').addEventListener('click', () => { if (estado.paginaAtual > 1) { estado.paginaAtual--; renderizarTabelaClientes(); } });
$('next-page').addEventListener('click', () => { estado.paginaAtual++; renderizarTabelaClientes(); });

$('form-produto').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dados = {
    codigo: $('prod-codigo').value,
    nome: $('prod-nome').value,
    descricao: $('prod-descricao').value,
    valor: $('prod-valor').value
  };
  const id = $('produto-id').value;
  const url = id ? `/api/produtos/${id}` : '/api/produtos';
  const method = id ? 'PUT' : 'POST';
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro);
    showMsg('msg-produto', id ? 'Produto atualizado!' : 'Produto cadastrado!', 'success');
    $('form-produto').reset();
    $('produto-id').value = '';
    await carregarProdutos();
  } catch (err) {
    showMsg('msg-produto', `Erro: ${err.message}`, 'error');
  }
});

$('btn-limpar-produto').addEventListener('click', () => {
  $('form-produto').reset();
  $('produto-id').value = '';
});

async function carregarProdutos() {
  const res = await fetch('/api/produtos');
  const dados = await res.json();
  estado.produtos = dados.map(d => new Produto(d));
  const tbody = document.querySelector('#tabela-produtos tbody');
  tbody.innerHTML = estado.produtos.map(p => `
    <tr>
      <td>${p.id}</td>
      <td>${p.codigo}</td>
      <td>${p.nome}</td>
      <td>${fmtMoeda(p.valor)}</td>
      <td>${fmtData(p.data_cadastro)}</td>
      <td>
        <button onclick="editarProduto(${p.id})">Editar</button>
        <button class="danger" onclick="deletarProduto(${p.id})">Excluir</button>
      </td>
    </tr>
  `).join('');
  popularSelectProdutos();
}

window.editarProduto = (id) => {
  const p = estado.produtos.find(x => x.id === id);
  $('produto-id').value = p.id;
  $('prod-codigo').value = p.codigo;
  $('prod-nome').value = p.nome;
  $('prod-descricao').value = p.descricao || '';
  $('prod-valor').value = p.valor;
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deletarProduto = async (id) => {
  if (!confirm('Excluir este produto?')) return;
  await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
  carregarProdutos();
};

function popularSelectClientes() {
  $('venda-cliente').innerHTML = '<option value="">Selecione...</option>' +
    estado.clientes.map(c => `<option value="${c.id}">${c.id} - ${c.nomeCompleto()}</option>`).join('');
}

function popularSelectProdutos() {
  document.querySelectorAll('.item-produto').forEach(sel => {
    const valorAtual = sel.value;
    sel.innerHTML = opcoesTodosProdutos();
    sel.value = valorAtual;
  });
}

function opcoesTodosProdutos() {
  return '<option value="">Selecione...</option>' +
    estado.produtos.map(p =>
      `<option value="${p.id}" data-valor="${p.valor}">${p.codigo} - ${p.nome} (${fmtMoeda(p.valor)})</option>`
    ).join('');
}

let itemVendaCount = 0;

function adicionarItemVenda() {
  itemVendaCount++;
  const id = itemVendaCount;
  const div = document.createElement('div');
  div.className = 'item-venda-row';
  div.dataset.item = id;
  div.innerHTML = `
    <label class="item-label">Produto*
      <select class="item-produto" data-item="${id}" required>
        ${opcoesTodosProdutos()}
      </select>
    </label>
    <label class="item-label item-qtd">Qtd*
      <input type="number" class="item-quantidade" data-item="${id}" min="1" value="1" required>
    </label>
    <label class="item-label item-subtotal">Subtotal
      <input type="text" class="item-total" disabled placeholder="R$ 0,00">
    </label>
    <button type="button" class="btn-remove-item btn-ghost btn-sm" data-item="${id}" title="Remover item">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
  $('lista-itens-venda').appendChild(div);

  div.querySelector('.item-produto').addEventListener('change', () => atualizarSubtotal(id));
  div.querySelector('.item-quantidade').addEventListener('input', () => atualizarSubtotal(id));
  div.querySelector('.btn-remove-item').addEventListener('click', () => removerItemVenda(id));
}

function removerItemVenda(id) {
  const row = document.querySelector(`.item-venda-row[data-item="${id}"]`);
  if (row) row.remove();
  recalcularTotalGeral();
}

function atualizarSubtotal(id) {
  const row = document.querySelector(`.item-venda-row[data-item="${id}"]`);
  const opt = row.querySelector('.item-produto').selectedOptions[0];
  const qtd = parseInt(row.querySelector('.item-quantidade').value) || 0;
  const totalEl = row.querySelector('.item-total');
  if (opt && opt.dataset.valor) {
    totalEl.value = fmtMoeda(parseFloat(opt.dataset.valor) * qtd);
  } else {
    totalEl.value = '';
  }
  recalcularTotalGeral();
}

function recalcularTotalGeral() {
  const rows = document.querySelectorAll('.item-venda-row');
  let total = 0;
  rows.forEach(row => {
    const opt = row.querySelector('.item-produto').selectedOptions[0];
    const qtd = parseInt(row.querySelector('.item-quantidade').value) || 0;
    if (opt && opt.dataset.valor) {
      total += parseFloat(opt.dataset.valor) * qtd;
    }
  });
  $('venda-total-geral').textContent = fmtMoeda(total);
}

$('btn-add-item').addEventListener('click', adicionarItemVenda);

adicionarItemVenda();

$('form-venda').addEventListener('submit', async (e) => {
  e.preventDefault();
  const clienteId = parseInt($('venda-cliente').value);
  if (!clienteId) return showMsg('msg-venda', 'Selecione um cliente', 'error');

  const rows = document.querySelectorAll('.item-venda-row');
  if (rows.length === 0) return showMsg('msg-venda', 'Adicione pelo menos um produto', 'error');

  const itens = [];
  for (const row of rows) {
    const produtoId = parseInt(row.querySelector('.item-produto').value);
    const quantidade = parseInt(row.querySelector('.item-quantidade').value);
    if (!produtoId) return showMsg('msg-venda', 'Selecione o produto em todos os itens', 'error');
    itens.push({ cliente_id: clienteId, produto_id: produtoId, quantidade });
  }

  try {
    let ids = [], valorTotal = 0;
    for (const item of itens) {
      const res = await fetch('/api/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.erro);
      ids.push(r.id);
      valorTotal += r.valor_final;
    }
    showMsg('msg-venda', `${itens.length} item(s) registrado(s)! Total: ${fmtMoeda(valorTotal)}`, 'success');
    
    $('lista-itens-venda').innerHTML = '';
    itemVendaCount = 0;
    adicionarItemVenda();
    $('form-venda').querySelector('#venda-cliente').value = '';
    $('venda-total-geral').textContent = 'R$ 0,00';
    await carregarVendas();
    await carregarClientes();
  } catch (err) {
    showMsg('msg-venda', `Erro: ${err.message}`, 'error');
  }
});

async function carregarVendas() {
  const res = await fetch('/api/vendas');
  const dados = await res.json();
  estado.vendas = dados.map(d => new Venda(d));

  const grupos = [];
  const mapa = new Map();

  dados.forEach(v => {
    const chave = `${v.cliente_id}_${v.data_compra ? v.data_compra.substring(0, 10) : ''}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chave,
        cliente_nome: v.cliente_nome,
        data_compra: v.data_compra,
        itens: [],
        total: 0
      });
      grupos.push(mapa.get(chave));
    }
    const g = mapa.get(chave);
    g.itens.push(v);
    g.total += parseFloat(v.valor_total);
  });

  grupos.sort((a, b) => new Date(b.data_compra) - new Date(a.data_compra));

  const tbody = document.querySelector('#tabela-vendas tbody');
  tbody.innerHTML = grupos.map(g => {
    const produtosHtml = g.itens.map(v =>
      `<span class="venda-item-tag">${v.produto_nome} <strong>${v.quantidade}x</strong></span>`
    ).join('');
    const desconto = g.itens[0] ? (g.itens[0].desconto_aplicado * 100).toFixed(0) + '%' : '-';
    return `
      <tr>
        <td>${g.cliente_nome}</td>
        <td><div class="venda-itens-lista">${produtosHtml}</div></td>
        <td>${fmtMoeda(g.total)}</td>
        <td>${desconto}</td>
        <td>${fmtData(g.data_compra)}</td>
      </tr>`;
  }).join('');
}

document.querySelectorAll('.rel-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const res = await fetch(`/api/relatorios/${btn.dataset.rel}`);
    const dados = await res.json();
    $('rel-resultado').textContent = JSON.stringify(dados, null, 2);
  });
});

(async () => {
  await carregarClientes();
  await carregarProdutos();
  await carregarVendas();
})();