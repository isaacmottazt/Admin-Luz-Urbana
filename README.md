# Motazt Studio — Admin

Este pacote contém somente o painel administrativo do Motazt Studio. O site público não está incluído.

## Estrutura

A página `login.html` é a porta de entrada do administrador. Depois do login, `index.html` gerencia a galeria pública e os destaques. A página `admin-galerias.html` gerencia os álbuns privados, incluindo criação, validade, status, upload e exclusão de fotos.

## Banco de dados

Antes de criar novos álbuns, execute as migrações necessárias no SQL Editor do Supabase. `melhorias-albuns.sql` habilita publicação, mural, agradecimento e exclusão administrativa; `corrigir-exclusao-albuns.sql` corrige a remoção de fotos e álbuns; `codigo-curto-historicos.sql` adiciona código curto, histórico de acessos e histórico de downloads. Execute cada arquivo somente no projeto Supabase correto.

## Site público

O botão **Ver Link** usa por padrão `https://motazt-studio.vercel.app/album?codigo=MZ-XXXXXX`. O link antigo `/galeria-privada?id=UUID` continua funcionando e é normalizado para a rota amigável. Se o site público estiver em outro domínio, defina a variável abaixo antes do script inline de `admin-galerias.html`:

```html
<script>
  window.MOTAZT_SITE_URL = 'https://seu-dominio.com';
</script>
```

A URL deve apontar somente para a origem do site público, sem incluir `/album` nem `/galeria-privada`.

## Publicação

Hospede o conteúdo desta pasta separadamente do site público. Mantenha os arquivos na mesma pasta para que as referências relativas entre `login.html`, `index.html` e `admin-galerias.html` funcionem corretamente.

O painel exige uma sessão autenticada do Supabase para acessar as áreas administrativas. O login continua usando e-mail e senha exclusivamente para o administrador; o **cadastro dos clientes nos álbuns usa telefone**.

## Envio manual pelo Telegram

A página `relatorio.html` possui o botão **Enviar pelo Telegram**. O envio só acontece quando o administrador clica no botão; não há agendamento, webhook ou disparo em segundo plano. O endpoint `api/telegram-relatorio.js` valida a sessão do Supabase e usa a Bot API do Telegram sem expor o token no navegador.

Para hospedar o Admin em Vercel ou outro ambiente compatível com funções Node, configure estas variáveis de ambiente no servidor:

```text
TELEGRAM_BOT_TOKEN=token recebido do @BotFather
TELEGRAM_CHAT_ID=6520427340
SUPABASE_URL=https://tbwmsgztpyyratambgqs.supabase.co
SUPABASE_ANON_KEY=chave pública do Supabase
MOTAZT_ADMIN_ORIGIN=https://seu-dominio-do-admin.com
```

O arquivo `.env.example` contém o modelo sem credenciais reais. O token deve ser tratado como senha e nunca deve ser colocado no HTML, JavaScript público, GitHub ou ZIP distribuído. O `chat_id` configurado corresponde à conversa privada que iniciou o bot `@motazstudio_bot`.
