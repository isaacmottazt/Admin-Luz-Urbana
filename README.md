# Motazt Studio — Admin

Este pacote contém somente o painel administrativo do Motazt Studio. O site público não está incluído.

## Estrutura

A página `login.html` é a porta de entrada do administrador. Depois do login, `index.html` gerencia a galeria pública e os destaques. A página `admin-galerias.html` gerencia os álbuns privados, incluindo criação, validade, status, upload e exclusão de fotos.

## Banco de dados

Antes de criar novos álbuns, execute `migracao-telefone.sql` no SQL Editor do Supabase. A migração adiciona `cliente_telefone` e torna o e-mail antigo opcional para que o cadastro dos álbuns use apenas telefone.

## Site público

O botão **Ver Link** usa por padrão `https://motazt-studio.vercel.app/galeria-privada?id=...`. Se o site público estiver em outro domínio, defina a variável abaixo antes do script inline de `admin-galerias.html`:

```html
<script>
  window.MOTAZT_SITE_URL = 'https://seu-dominio.com';
</script>
```

A URL deve apontar para a origem do site público, sem incluir `/galeria-privada`.

## Publicação

Hospede o conteúdo desta pasta separadamente do site público. Mantenha os arquivos na mesma pasta para que as referências relativas entre `login.html`, `index.html` e `admin-galerias.html` funcionem corretamente.

O painel exige uma sessão autenticada do Supabase para acessar as áreas administrativas. O login continua usando e-mail e senha exclusivamente para o administrador; o **cadastro dos clientes nos álbuns usa telefone**.
