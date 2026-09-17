-- ============================================================================
-- APPintura — consulta pública da OS (QR code de rastreabilidade)
--
-- Depende das migrations das Fases 0 a 7.
--
-- A Fase 3 prevê um QR por lote de peças apontando para a consulta pública da
-- OS. A etiqueta circula no pátio, no caminhão e na mão do cliente, então a URL
-- vaza junto com ela — e é por isso que isto NÃO pode ser um select na tabela.
--
-- Devolve só o que confirma a rastreabilidade: número, etapa e previsão. Nada
-- de cliente, preço, custo, cor ou descrição das peças. Mesmo desenho da
-- `consultar_romaneio_publico` da Fase 7.
-- ============================================================================

-- `create or replace` não muda o tipo de retorno de uma função que já existe;
-- o drop antes deixa a migration reexecutável sem erro.
drop function if exists appintura2.consultar_os_publica(uuid);

create function appintura2.consultar_os_publica(p_os_id uuid)
returns table (
  numero            integer,
  status            appintura2.status_os,
  previsao_entrega  timestamptz,
  atualizado_em     timestamptz
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    os.numero,
    os.status,
    os.previsao_entrega,
    -- Última transição registrada; se não houver, a entrada da OS.
    coalesce(
      (select max(h.created_at)
         from appintura2.os_status_historico h
        where h.os_id = os.id),
      os.created_at
    ) as atualizado_em
  from appintura2.ordens_servico os
  where os.id = p_os_id
$$;

comment on function appintura2.consultar_os_publica(uuid) is
  'Consulta anônima do QR da OS. SECURITY DEFINER para expor só estes campos sem dar grant em ordens_servico.';

grant execute on function appintura2.consultar_os_publica(uuid) to anon, authenticated;

notify pgrst, 'reload schema';

insert into appintura2.schema_migrations (version, name)
values ('20260917170000', 'appintura2_consulta_publica_os')
on conflict (version) do nothing;
