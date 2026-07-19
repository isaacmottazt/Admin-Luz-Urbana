# 📊 Painel Admin — Estúdio Luz Urbana

Painel de gerenciamento completo para o Estúdio Luz Urbana, permitindo controlar agendamentos de ensaios fotográficos e gerenciar a galeria de fotos do site público.

---

## 🚀 Acesso

**URL:** `https://fenda.isaacmota1007.workers.dev/admin` (ou seu domínio)

### Login
- Acesse `login.html`
- Faça login com suas credenciais de e-mail e senha (autenticado via Supabase)
- Serão redirecionado automaticamente para `index.html` se a sessão for válida

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

### 2️⃣ **Gerenciador de Galeria** (`index.html`)

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

Hospedado em ** Vercel** com auto-deploy via GitHub.

- Qualquer push na branch `main` atualiza o site automaticamente
- Verifique em `fenda.isaacmota1007.workers.dev`

---

**Última atualização:** Julho 2026
