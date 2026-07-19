# 📊 Painel Admin — Estúdio Luz Urbana

Painel de gerenciamento completo para o Estúdio Luz Urbana, permitindo controlar agendamentos de ensaios fotográficos e gerenciar a galeria de fotos do site público.

---

## 🚀 Acesso

**URL:** `https://fenda.isaacmota1007.workers.dev/admin` (ou seu domínio)

### Login
- Acesse `login.html`
- Faça login com suas credenciais de e-mail e senha (autenticado via Supabase)
- Serão redirecionado automaticamente para `painel.html` se a sessão for válida

---

## 📋 Funcionalidades Principais

### 1️⃣ **Painel de Agendamentos** (`painel.html`)

Acompanhamento em tempo real de todos os ensaios agendados.

#### **Cards de Status**
- **Total:** quantidade total de agendamentos no banco
- **Aceitos:** quantos estão em andamento (aceitos)
- **Clientes:** total de clientes com agendamento

#### **Gráfico Mensal**
- Exibe os últimos 6 meses de agendamentos
- Mostra variação percentual entre mês atual e anterior
- Mês atual destacado em ouro

#### **Calendário Interativo**
- Visualize agendamentos por data
- Clique em um dia para ver os detalhes dos ensaios daquele dia
- Navegue pelos meses com as setas

#### **Listas de Status**
Clique no título de cada seção para expandir/recolher.

**Pendentes** 🟠
- Agendamentos não aceitos ainda
- Botões disponíveis:
  - **Pendente:** manter no estado pendente
  - **Aceitar (Andamento):** aceitar o ensaio
  - **Encerrar:** finalizar sem aceitar
  - **Excluir:** remover agendamento

**Em Andamento** 🔵
- Ensaios já aceitos e confirmados
- Mesmos botões da seção Pendentes

**Ensaios Finalizados** 🟢
- Agendamentos já realizados ou encerrados
- Status automático: quando passa a data, qualquer agendamento (pendente ou em andamento) vira "Finalizado" automaticamente
- Botões disponíveis:
  - **Reabrir (Andamento):** só aparece se a data ainda não passou (ensaios futuros)
  - **Excluir:** remover agendamento

#### **Botão "Ver mais"**
- `Ver todos organizados por data` → modal com todos os agendamentos agrupados por data

---

### 2️⃣ **Gerenciador de Galeria** (`admin.html`)

Upload e gerenciamento de fotos do portfólio do estúdio.

#### **Botão de Upload** 📤
- Ícone na barra lateral esquerda (próximo ao ícone de gráfico)
- Abre um modal centralizado para envio de imagens

#### **Como Enviar Fotos**
1. Clique no botão 📤 na barra lateral
2. Clique em **"Escolher arquivos"** ou arraste as imagens
3. Selecione uma ou múltiplas fotos (formatos: JPG, PNG, WebP, etc)
4. Clique em **"📤 Enviar Imagens"**
5. Aguarde a mensagem de sucesso
6. O modal fecha automaticamente e a galeria atualiza

#### **Galeria de Fotos**
- Exibe todas as fotos publicadas no portfólio
- Cada foto tem um botão **"Excluir"** (vermelho)
- Clique para remover a imagem do banco e do storage

---

## 🔄 **Fluxo de um Agendamento**

```
Novo Agendamento (Formulário Site)
           ↓
    PENDENTE 🟠
      (não aceito)
           ↓
   Pendente / Aceitar / Encerrar / Excluir
           ↓
EM ANDAMENTO 🔵      ou      FINALIZADO 🟢
(aceito, confirmado)    (encerrado manual ou data passou)
           ↓
  Reabrir* / Excluir
```

*Reabrir só aparece se a data ainda não passou

---

## 🗄️ **Backend & Banco de Dados**

### Supabase
- **Projeto ID:** `ublmmwatrqvthbcmnrps`
- **URL:** `https://tbwmsgztpyyratambgqs.supabase.co`

### Tabelas Usadas

**`agendamentos`** — Ensaios agendados
- `id` (PK, auto)
- `nome` (text)
- `email` (text)
- `telefone` (text)
- `ensaio` (text) — tipo de ensaio
- `data` (date)
- `horario` (time)
- `mensagem` (text)
- `status` (text) — `pendente` | `andamento` | `finalizado` | `concluido`

**`galeria`** — Fotos publicadas
- `id` (PK, auto)
- `imagem_url` (text) — URL pública do Storage

### Storage
**Bucket:** `fotos`
- Armazena imagens do portfólio
- Acesso público (URLs retornadas são públicas)

---

## 🔐 **Autenticação & Segurança**

- Autenticação via **Supabase Auth** (email + senha)
- **RLS (Row Level Security)** ativa nas tabelas
- Sessão verificada no carregamento de cada página
- Se não autenticado, redireciona automaticamente para `login.html`

---

## 📱 **Responsividade**

O painel é totalmente responsivo e funciona bem em:
- Desktop (recomendado)
- Tablet
- Celular (via Acode ou navegador)

---

## 🎨 **Design & Tema**

- **Cores:** Ouro (primária), azul, laranja, verde (status)
- **Tipografia:** Poppins (Google Fonts)
- **Efeito vidro:** Cards com backdrop blur e transparência
- **Animações:** Suaves (0.2s–0.25s)

---

## 🐛 **Troubleshooting**

### Agendamentos não aparecem
- Verifique conexão com Supabase
- Confirme que a tabela `agendamentos` tem registros
- Cheque RLS policies (devem permitir SELECT)

### Fotos não fazem upload
- Verificar se o bucket `fotos` existe e é público
- Confirmar permissões de Storage no Supabase
- Tentar em outro navegador ou limpar cache

### Login não funciona
- Confirmação de email ativa? Verifique no Supabase Auth settings
- Usuário criado manualmente? Vai precisar de um invite link ou ativar sem confirmação

### Modal de upload não aparece
- Verificar console do navegador (F12) para erros JS
- Tentar recarregar a página

---

## 📝 **Arquivos Principais**

```
LB-admin/
├── index.html           # Página inicial (redirecionada)
├── login.html           # Login de autenticação
├── painel.html          # Painel de agendamentos
├── admin.html           # Gerenciador de galeria
├── painel.js            # Lógica de agendamentos
├── admin.js             # Lógica de upload/galeria
├── script.js            # Autenticação & logout
├── painel.css           # Estilos do painel
├── admin.css            # Estilos da galeria
├── login.css            # Estilos de login
├── style.css            # Estilos globais
└── img/                 # Assets (logo, ícones)
```

---

## 🚢 **Deploy**

Hospedado em **Cloudflare Workers** com auto-deploy via GitHub.

- Qualquer push na branch `main` atualiza o site automaticamente
- Verifique em `fenda.isaacmota1007.workers.dev`

---

## 📞 **Suporte**

Para problemas ou melhorias:
- Verifique o console do navegador (DevTools)
- Consulte logs do Supabase
- Recarregue a página (Ctrl+Shift+R para limpar cache)

---

**Última atualização:** Julho 2026
