-- ============================================================================
-- APPintura — novos valores de enum para o módulo de Orçamento
--
-- Depende de 20260917200000_appintura2_orcamentos_publico.sql.
--
-- ARQUIVO SEPARADO DE PROPÓSITO: o Postgres não deixa usar um valor de enum na
-- mesma transação em que ele foi adicionado. Se estes `alter type` estivessem
-- junto com as funções que os referenciam, a migration falharia com
-- "unsafe use of new value of enum type".
--
-- Aplicar SEM `--single-transaction`.
-- ============================================================================

alter type appintura2.tipo_notificacao add value if not exists 'orcamento_visualizado';
alter type appintura2.tipo_notificacao add value if not exists 'orcamento_aprovado';
alter type appintura2.tipo_notificacao add value if not exists 'orcamento_rejeitado';
alter type appintura2.tipo_notificacao add value if not exists 'orcamento_alteracao';
alter type appintura2.tipo_notificacao add value if not exists 'orcamento_expirado';
alter type appintura2.tipo_notificacao add value if not exists 'orcamento_vencendo';

-- Aprovação parcial (Fase 5): o cliente aceitou parte dos itens. É um estado
-- distinto de `aprovado` porque o valor fechado é menor que o proposto, e o
-- funil precisa saber diferenciar os dois.
alter type appintura2.status_orcamento add value if not exists 'aprovado_parcial';
alter type appintura2.evento_orcamento add value if not exists 'aprovado_parcial';

insert into appintura2.schema_migrations (version, name)
values ('20260917210000', 'appintura2_orcamento_enums')
on conflict (version) do nothing;
