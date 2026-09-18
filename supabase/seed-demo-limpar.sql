-- ============================================================================
-- APPintura — remove os dados de demonstração
--
-- Apaga TUDO do tenant, preservando apenas a empresa, o usuário e o vínculo —
-- ou seja, devolve o sistema ao estado de "recém-instalado, pronto para uso
-- real".
--
--   docker exec -i supabase-db psql -U postgres -d postgres -f - < seed-demo-limpar.sql
--
-- A ordem importa e não é arbitrária: `orcamentos.os_id` e
-- `ordens_servico.orcamento_id` apontam um para o outro, então nenhum dos dois
-- pode ser apagado antes de o vínculo ser desfeito. Por isso o UPDATE vem
-- primeiro.
-- ============================================================================

\set ON_ERROR_STOP on

begin;

update appintura2.orcamentos set os_id = null;
update appintura2.romaneios_recebimento set os_id = null;

delete from appintura2.orcamento_eventos;
delete from appintura2.orcamento_links;
delete from appintura2.orcamento_anexos;
delete from appintura2.orcamento_itens;
delete from appintura2.orcamentos;

delete from appintura2.os_status_historico;
delete from appintura2.os_itens;
delete from appintura2.ordens_servico;

delete from appintura2.romaneio_devolucao_itens;
delete from appintura2.romaneio_devolucao_recebimentos;
delete from appintura2.romaneios_devolucao;
delete from appintura2.romaneio_fotos;
delete from appintura2.romaneio_recebimento_itens;
delete from appintura2.romaneios_recebimento;

delete from appintura2.qualidade_registros;
delete from appintura2.nao_conformidades;
delete from appintura2.estoque_movimentacoes;

delete from appintura2.contas_receber_pagamentos;
delete from appintura2.contas_receber_cobranca_historico;
delete from appintura2.contas_receber;
delete from appintura2.contas_pagar;
delete from appintura2.centros_custo;

delete from appintura2.tabela_preco_itens;
delete from appintura2.clientes;
delete from appintura2.tabelas_preco;
delete from appintura2.cores;
delete from appintura2.insumos_quimicos;
delete from appintura2.transportadoras;

delete from appintura2.notificacoes;
delete from appintura2.rate_limit;

-- Zera os contadores: sem isto o primeiro romaneio real nasceria com número 6,
-- e o cliente veria um salto sem explicação no primeiro documento emitido.
delete from appintura2.tenant_sequencias;

select 'restante -> clientes='  || (select count(*) from appintura2.clientes)
    || ' orcamentos='           || (select count(*) from appintura2.orcamentos)
    || ' os='                   || (select count(*) from appintura2.ordens_servico)
    || ' | preservado: usuarios=' || (select count(*) from appintura2.usuarios)
    || ' tenants='              || (select count(*) from appintura2.tenants)
    || ' vinculos='             || (select count(*) from appintura2.user_roles) as resultado;

commit;
