-- ============================================================================
-- APPintura — Fase 7: consulta pública do romaneio (QR code do PDF)
--
-- Objetos no schema `appintura2`. Depende das migrations das Fases 0 a 6.
-- ============================================================================

/*
 * Consulta pública do QR impresso no romaneio.
 *
 * Devolve SÓ o que confirma a autenticidade do papel: número, data e totais.
 * Nada de cliente, descrição da carga ou fotos — o documento com o QR circula
 * no pátio e no caminhão, e a URL vaza junto com ele.
 *
 * SECURITY DEFINER com `search_path` fixo: é a forma de expor exatamente estes
 * campos ao papel `anon` sem abrir select em tabela nenhuma.
 */
create or replace function appintura2.consultar_romaneio_publico(
  p_tipo text,
  p_romaneio_id uuid
)
returns table (
  numero integer,
  data_hora timestamptz,
  total_itens bigint,
  total_unidades numeric
)
language sql
security definer
stable
set search_path = ''
as $$
  select
    r.numero,
    r.data_hora,
    count(i.id) as total_itens,
    coalesce(sum(i.quantidade), 0) as total_unidades
  from appintura2.romaneios_recebimento r
  left join appintura2.romaneio_recebimento_itens i on i.romaneio_id = r.id
  where p_tipo = 'recebimento' and r.id = p_romaneio_id
  group by r.numero, r.data_hora

  union all

  select
    d.numero,
    d.data_hora,
    count(i.id) as total_itens,
    coalesce(sum(i.quantidade), 0) as total_unidades
  from appintura2.romaneios_devolucao d
  left join appintura2.romaneio_devolucao_itens i on i.devolucao_id = d.id
  where p_tipo = 'devolucao' and d.id = p_romaneio_id
  group by d.numero, d.data_hora
$$;

grant execute on function appintura2.consultar_romaneio_publico(text, uuid)
  to anon, authenticated;

/*
 * A Edge Function `gerar-pdf-romaneio` roda com o JWT do próprio usuário, então
 * ela lê os romaneios pelas policies já existentes das Fases 2 e 5. Não há
 * permissão nova a conceder aqui — e isso é proposital: se a função usasse
 * service_role, bastaria trocar o id na chamada para baixar o romaneio de outra
 * empresa.
 *
 * A única variável de ambiente nova é APP_PUBLIC_URL, usada para montar a URL
 * que vai dentro do QR:
 *   supabase secrets set APP_PUBLIC_URL=https://app.appintura.com.br
 */

insert into appintura2.schema_migrations (version, name)
values ('20260915150000', 'fase7_consulta_publica_romaneio')
on conflict (version) do nothing;
