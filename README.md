# Case Técnico — Sistema de Cadastro e Vendas

Projeto feito pro case técnico da Votorantim. São dois desafios: um sistema web em Node.js e uma automação com Selenium em Python.

---

## Desafio 1 — Sistema Web

### Stack usada

- **Node.js 24+** — usei o `node:sqlite` nativo que veio no Node 24, então não precisei de biblioteca de banco de dados
- **Express** — pra criar a API
- **Multer** — pra upload da foto dos clientes
- HTML, CSS e JS puro no front — quis manter simples, sem framework

### Pré-requisitos

- [Node.js 24 ou superior](https://nodejs.org/) — a versão importa por causa do `node:sqlite` nativo
- npm (já vem com o Node)

### Como rodar

```bash
npm install
npm start
```

Abre `http://localhost:3000` no navegador.

Se quiser rodar em outra porta:

```bash
PORT=8080 npm start
```

Pra desenvolvimento com reload automático:

```bash
npm run dev
```

### Estrutura

```
case-tecnico-votorantim/
├── server.js              # API REST
├── db.js                  # banco e queries dos relatórios
├── public/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── uploads/               # criado automaticamente
└── automacao-python/      # desafio 2
```

### Funcionalidades

**Clientes**
- Cadastro com nome, sobrenome, nascimento, telefone, e-mail e foto
- CEP com preenchimento automático via BrasilAPI (aperta Enter ou clica em "Buscar CEP")
- Validação de e-mail e telefone no front e no back
- Histórico de compras de cada cliente visível na tabela

**Produtos**
- Cadastro, edição e exclusão com código único, nome, descrição e valor

**Vendas**
- Desconto calculado automaticamente na hora do registro
- Aplica sempre o maior desconto entre:
  - Cliente de Curitiba → 10%
  - Cliente de São Paulo → 5%
  - Compra acima de R$ 1.000 → 15%
- A resposta da API retorna valor original, percentual e valor final

**Relatórios**

| Rota | Retorna |
|---|---|
| `GET /api/relatorios/clientes` | Todos os clientes com endereço |
| `GET /api/relatorios/clientes-por-cidade` | Quantidade de clientes por cidade |
| `GET /api/relatorios/vendas-por-cliente` | Total gasto por cliente |
| `GET /api/relatorios/media-mensal` | Média de vendas por mês |
| `GET /api/relatorios/cidade-top` | Cidade que mais comprou |

**Tabela de clientes**
- Paginação (5 por página)
- Filtros por ano e mês de cadastro
- Ordenação por nome ou data

### Banco de dados

O `banco.db` é criado automaticamente na primeira vez que o servidor sobe. Tem 4 tabelas: `enderecos`, `clientes`, `produtos` e `vendas`, com foreign keys e WAL habilitados.

### Endpoints

```
POST   /api/clientes
GET    /api/clientes
GET    /api/clientes/:id
PUT    /api/clientes/:id
DELETE /api/clientes/:id

POST   /api/produtos
GET    /api/produtos
PUT    /api/produtos/:id
DELETE /api/produtos/:id

POST   /api/vendas
GET    /api/vendas
```

---

## Desafio 2 — Automação Python com Selenium

Script que lê um Excel com dados de clientes, produtos e vendas, preenche o sistema automaticamente e grava o resultado de cada operação de volta no arquivo.

### Dependências

- **Python 3.10+**
- **Selenium** — controla o Chrome
- **openpyxl** — lê e escreve no Excel
- **webdriver-manager** — baixa o ChromeDriver automaticamente
- **requests** — pra registrar as vendas direto via API

### Pré-requisitos

- [Python 3.10+](https://www.python.org/)
- [Google Chrome](https://www.google.com/chrome/)
- pip

### Como rodar

O servidor do Desafio 1 precisa estar rodando antes.

```bash
cd automacao-python
pip install -r requirements.txt
python automacao.py
```

O Chrome vai abrir e você consegue acompanhar o preenchimento em tempo real.

### Estrutura

```
automacao-python/
├── automacao.py       # script principal
├── dados.xlsx         # dados de entrada
└── requirements.txt
```

### Como o Excel funciona

Três abas:

- **Clientes** — nome, sobrenome, nascimento, telefone, e-mail, CEP
- **Produtos** — código, nome, descrição, valor
- **Vendas** — e-mail do cliente, código do produto, quantidade

Depois de rodar, cada linha recebe um status:
- **Verde** = cadastrado com sucesso
- **Vermelho** = erro, com a mensagem
- Linhas já com status "sucesso" são puladas se o script rodar de novo
- Pra vendas, o ID real gerado pelo banco é gravado na coluna `pedido_id`
