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

## Envio automático pelo Telegram

A página `relatorio.html` possui o botão **Enviar pelo Telegram** para um disparo manual autenticado. Além disso, a função `api/telegram-relatorio.js` gera o relatório diretamente no servidor e o envia automaticamente toda segunda-feira às **00:00 no horário de Brasília**. O cron da Vercel usa UTC, por isso o agendamento está configurado como `0 3 * * 1`.

Para hospedar o Admin na Vercel, configure estas variáveis de ambiente no servidor:

```text
TELEGRAM_BOT_TOKEN=token recebido do @BotFather
TELEGRAM_CHAT_ID=6520427340
SUPABASE_URL=https://tbwmsgztpyyratambgqs.supabase.co
SUPABASE_ANON_KEY=chave pública do Supabase
SUPABASE_SERVICE_ROLE_KEY=chave secreta do Supabase
CRON_SECRET=senha longa e aleatória para testes autorizados
MOTAZT_ADMIN_ORIGIN=https://seu-dominio-do-admin.com
```

O arquivo `.env.example` contém o modelo sem credenciais reais. O token do Telegram e a `SUPABASE_SERVICE_ROLE_KEY` devem ser tratados como senhas e nunca devem ser colocados no HTML, JavaScript público, GitHub ou ZIP distribuído. O `chat_id` configurado corresponde à conversa privada que iniciou o bot `@motazstudio_bot`. O cron funciona somente na implantação de produção da Vercel.
