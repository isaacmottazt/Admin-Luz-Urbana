/**
 * 🔧 SCRIPT DE DEBUG PARA PAINEL ADMIN
 * 
 * Como usar:
 * 1. Abra o painel admin
 * 2. Pressione F12 (ou Ctrl+Shift+I)
 * 3. Vá para a aba "Console"
 * 4. Cole TODO o conteúdo deste arquivo
 * 5. Pressione Enter
 * 6. Veja os resultados
 */

console.clear();
console.log('%c🔧 INICIANDO DEBUG DO PAINEL ADMIN', 'font-size: 16px; font-weight: bold; color: #d6a04c;');
console.log('%c═══════════════════════════════════════════════════════', 'color: #d6a04c;');

// ======================================
// 1. VERIFICAR SUPABASE
// ======================================
console.log('\n%c1️⃣  VERIFICANDO SUPABASE', 'font-size: 14px; font-weight: bold; color: #36a2eb;');
console.log('─────────────────────────────────────────────────────');

if (typeof supabase !== 'undefined') {
    console.log('✅ Supabase está carregado');
} else {
    console.log('%c❌ Supabase NÃO está carregado!', 'color: #ff6b6b;');
}

// ======================================
// 2. VERIFICAR CLIENTE SUPABASE
// ======================================
console.log('\n%c2️⃣  VERIFICANDO CLIENTE SUPABASE', 'font-size: 14px; font-weight: bold; color: #36a2eb;');
console.log('─────────────────────────────────────────────────────');

if (typeof client !== 'undefined') {
    console.log('✅ Cliente Supabase está inicializado');
    console.log('   URL:', client.supabaseUrl || 'N/A');
} else {
    console.log('%c❌ Cliente Supabase NÃO existe!', 'color: #ff6b6b;');
}

// ======================================
// 3. VERIFICAR AUTENTICAÇÃO
// ======================================
console.log('\n%c3️⃣  VERIFICANDO AUTENTICAÇÃO', 'font-size: 14px; font-weight: bold; color: #36a2eb;');
console.log('─────────────────────────────────────────────────────');

(async () => {
    try {
        const { data: { session }, error } = await client.auth.getSession();
        
        if (error) {
            console.log('%c❌ Erro ao verificar sessão:', 'color: #ff6b6b;', error.message);
        } else if (session) {
            console.log('✅ Sessão ativa!');
            console.log('   Usuário:', session.user.email);
            console.log('   ID:', session.user.id);
        } else {
            console.log('%c⚠️  Sem sessão ativa', 'color: #ffa500;');
        }
    } catch (e) {
        console.log('%c❌ Erro ao verificar autenticação:', 'color: #ff6b6b;', e.message);
    }

    // ======================================
    // 4. VERIFICAR BANCO DE DADOS
    // ======================================
    console.log('\n%c4️⃣  VERIFICANDO BANCO DE DADOS', 'font-size: 14px; font-weight: bold; color: #36a2eb;');
    console.log('─────────────────────────────────────────────────────');

    try {
        const { data, error } = await client
            .from('agendamentos')
            .select('*')
            .limit(5);

        if (error) {
            console.log('%c❌ Erro ao consultar agendamentos:', 'color: #ff6b6b;', error.message);
            console.log('   Código do erro:', error.code);
        } else {
            console.log('✅ Conectado ao banco de dados!');
            console.log('   Quantidade de registros:', data ? data.length : 0);
            
            if (data && data.length > 0) {
                console.log('   Primeiros dados:');
                console.table(data.slice(0, 3));
            } else {
                console.log('   ⚠️  Nenhum agendamento encontrado');
            }
        }
    } catch (e) {
        console.log('%c❌ Erro ao acessar banco de dados:', 'color: #ff6b6b;', e.message);
    }

    // ======================================
    // 5. VERIFICAR DOM
    // ======================================
    console.log('\n%c5️⃣  VERIFICANDO ELEMENTOS DO DOM', 'font-size: 14px; font-weight: bold; color: #36a2eb;');
    console.log('─────────────────────────────────────────────────────');

    const elementosEsperados = [
        'painel-vidro',
        'totalAgendamentos',
        'totalAceitos',
        'totalClientes',
        'pendentes-lista',
        'andamento-lista',
        'finalizados-lista',
        'graficoMensalCanvas',
        'calendarioGrid',
        'modalLista',
        'diagnostico'
    ];

    let todosPresentes = true;
    elementosEsperados.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            console.log(`✅ #${id}`);
        } else {
            console.log(`%c❌ #${id}`, 'color: #ff6b6b;');
            todosPresentes = false;
        }
    });

    if (todosPresentes) {
        console.log('%c✅ Todos os elementos do DOM estão presentes!', 'color: #51cf66;');
    } else {
        console.log('%c⚠️  Alguns elementos estão faltando', 'color: #ffa500;');
    }

    // ======================================
    // 6. VERIFICAR FUNÇÕES
    // ======================================
    console.log('\n%c6️⃣  VERIFICANDO FUNÇÕES CRÍTICAS', 'font-size: 14px; font-weight: bold; color: #36a2eb;');
    console.log('─────────────────────────────────────────────────────');

    const funcoesEsperadas = [
        'carregarAgendamentos',
        'renderizarCardsDeStatus',
        'atualizarCards',
        'verTodosAgendamentos',
        'verAgendamentosAceitos',
        'logout'
    ];

    let todasPresentes = true;
    funcoesEsperadas.forEach(nome => {
        if (typeof window[nome] === 'function') {
            console.log(`✅ ${nome}()`);
        } else {
            console.log(`%c❌ ${nome}()`, 'color: #ff6b6b;');
            todasPresentes = false;
        }
    });

    if (todasPresentes) {
        console.log('%c✅ Todas as funções estão presentes!', 'color: #51cf66;');
    } else {
        console.log('%c⚠️  Algumas funções estão faltando', 'color: #ffa500;');
    }

    // ======================================
    // 7. TESTE MANUAL DE CARREGAMENTO
    // ======================================
    console.log('\n%c7️⃣  TESTE MANUAL DE CARREGAMENTO', 'font-size: 14px; font-weight: bold; color: #36a2eb;');
    console.log('─────────────────────────────────────────────────────');

    try {
        console.log('⏳ Tentando carregar agendamentos manualmente...');
        
        // Esta função executará a mesma lógica de carregamento
        const resposta = await client
            .from('agendamentos')
            .select('*')
            .order('id', { ascending: false });

        if (resposta.error) {
            console.log('%c❌ Erro:', 'color: #ff6b6b;', resposta.error.message);
        } else if (resposta.data) {
            console.log('%c✅ Dados carregados com sucesso!', 'color: #51cf66;');
            console.log('   Total:', resposta.data.length, 'agendamentos');
            
            // Mostrar distribuição por status
            const contadores = {
                pendente: 0,
                andamento: 0,
                finalizado: 0
            };
            
            resposta.data.forEach(item => {
                const status = item.status || 'pendente';
                if (contadores[status] !== undefined) {
                    contadores[status]++;
                }
            });
            
            console.log('   Distribuição por status:');
            console.log('   - Pendentes:', contadores.pendente);
            console.log('   - Em Andamento:', contadores.andamento);
            console.log('   - Finalizados:', contadores.finalizado);
        }
    } catch (e) {
        console.log('%c❌ Erro no teste:', 'color: #ff6b6b;', e.message);
    }

    // ======================================
    // 8. RESUMO FINAL
    // ======================================
    console.log('\n%c═══════════════════════════════════════════════════════', 'color: #d6a04c;');
    console.log('%c📊 RESUMO DO DEBUG', 'font-size: 14px; font-weight: bold; color: #d6a04c;');
    console.log('%c═══════════════════════════════════════════════════════', 'color: #d6a04c;');

    console.log('\n💡 Próximos passos:');
    console.log('   1. Se tudo está ✅ verde, o problema está na exibição');
    console.log('   2. Se algo está ❌ vermelho, corrija antes de testar');
    console.log('   3. Limpe o cache (Ctrl+Shift+Del) se fez alterações');
    console.log('   4. Recarregue a página (Ctrl+F5)');
    console.log('   5. Execute este script novamente para confirmar');

})();
