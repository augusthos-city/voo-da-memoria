# 🐦 Voo da Memória — Site do Projeto

Site institucional para o Projeto **Voo da Memória: O Quero-Quero como Símbolo da Identidade e História dos Servidores do IFSC Araranguá**.

---

## 📁 Estrutura de Pastas

```
voo-da-memoria/
├── server.js              # Backend Node.js (Express)
├── package.json
├── stories.json           # Banco de dados (JSON flat-file, gerado automaticamente)
├── .env                   # Variáveis de ambiente (crie você mesmo)
├── public/
│   ├── index.html         # Página principal
│   ├── admin.html         # Painel de moderação
│   ├── css/
│   │   ├── style.css      # Estilos principais
│   │   └── admin.css      # Estilos do painel admin
│   ├── js/
│   │   ├── main.js        # JavaScript principal
│   │   └── admin.js       # JavaScript do painel admin
│   └── uploads/           # Arquivos enviados (criado automaticamente)
└── README.md
```

---

## 🚀 Como Rodar Localmente

### Pré-requisitos
- **Node.js** v18+ ([nodejs.org](https://nodejs.org))
- **npm** (já vem com o Node.js)

### Passo a Passo

```bash
# 1. Clone ou baixe o projeto
git clone <url-do-repositorio>
cd voo-da-memoria

# 2. Instale as dependências
npm install

# 3. (Opcional) Crie o arquivo .env para configurar o token de admin
echo "ADMIN_TOKEN=sua_senha_secreta" > .env
echo "PORT=3000" >> .env

# 4. Inicie o servidor
npm start

# 5. Acesse no navegador
# http://localhost:3000          → Site principal
# http://localhost:3000/admin.html → Painel de moderação
```

> **Token padrão de administrador:** `voo2026`  
> Altere via variável de ambiente `ADMIN_TOKEN` antes de publicar!

---

## 📦 Dependências

| Pacote | Versão | Descrição |
|--------|--------|-----------|
| `express` | ^4.18 | Servidor web |
| `multer` | ^1.4.5-lts | Upload de arquivos |
| `sanitize-html` | ^2.11 | Sanitização de inputs |

### Desenvolvimento
| Pacote | Versão | Descrição |
|--------|--------|-----------|
| `nodemon` | ^3.0 | Reinicialização automática |

---

## 🔒 Segurança Implementada

- Sanitização de todos os inputs de texto (`sanitize-html`)
- Validação de tipo MIME de arquivo (whitelist de tipos permitidos)
- Validação de tamanho (máximo 10 MB)
- Renomeação aleatória de arquivos enviados (prevenção de path traversal)
- Moderação obrigatória: histórias ficam `pending` até aprovação
- Token de admin via header HTTP (não exposto na URL)

---

## 🌐 Deploy

### Render.com (recomendado — gratuito)

1. Crie uma conta em [render.com](https://render.com)
2. Clique em **New Web Service**
3. Conecte ao seu repositório GitHub
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment Variables:**
     - `ADMIN_TOKEN` → sua senha secreta
     - `PORT` → 3000
5. Clique em **Deploy**

> ⚠️ No Render gratuito, o sistema de arquivos é efêmero. Para persistência, use um volume ou migre para um banco de dados externo (PostgreSQL, MongoDB Atlas).

### Railway.app

```bash
# Instale a CLI do Railway
npm install -g @railway/cli

# Login e deploy
railway login
railway init
railway up
```

### VPS (Ubuntu)

```bash
# Instale Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone e instale
git clone <repo> /var/www/voo-da-memoria
cd /var/www/voo-da-memoria && npm install

# Use PM2 para manter rodando
npm install -g pm2
pm2 start server.js --name "voo-da-memoria"
pm2 startup && pm2 save

# Configure Nginx como proxy reverso
# server { listen 80; location / { proxy_pass http://localhost:3000; } }
```

---

## 🎛️ Painel de Moderação

Acesse `/admin.html` e insira o token de administrador.

**Funcionalidades:**
- Visualizar todas as histórias (pendentes, aprovadas, rejeitadas)
- Aprovar / Rejeitar / Devolver para pendente
- Excluir histórias (com exclusão do arquivo associado)
- Estatísticas em tempo real

---

## 📞 Contato

**IFSC — Instituto Federal de Santa Catarina**  
Câmpus Araranguá  
[ifsc.edu.br](https://www.ifsc.edu.br)

Coordenadora: Dr.ª Luciane Nóbrega Juliano
