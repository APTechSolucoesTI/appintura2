-- ============================================================================
-- APPintura — área por item passa a ser obrigatória no orçamento
--
-- Depende de 20260917240000_appintura2_orcamento_publico_itens.sql.
--
-- BUG encontrado em QA: `orcamento_itens.area_m2` tinha DEFAULT 0 e nenhuma
-- checagem, mas `os_itens.area_m2` exige `> 0`. A conversão copia o valor
-- direto — então um orçamento salvo sem área era aceito, enviado e aberto pelo
-- cliente normalmente, e explodia com check_violation no exato momento da
-- APROVAÇÃO. A transação inteira voltava atrás: o cliente via erro genérico,
-- o orçamento ficava travado em `enviado` e toda nova tentativa falhava igual.
--
-- O campo do formulário vinha preenchido com "0" por padrão, então esse era o
-- caminho COMUM, não uma borda.
--
-- A correção move a falha para onde ela pode ser resolvida: quem conserta é o
-- vendedor, na criação, e não o cliente, na decisão. Área também alimenta o
-- consumo estimado de tinta e o custo por m² — zero ali já era dado errado.
-- ============================================================================

-- `area_m2` é NOT NULL, então não há como "esvaziar" a linha legada: ela teria
-- de receber uma área de verdade, e só quem orçou sabe qual. A migration
-- portanto PARA em vez de adivinhar — hoje não há nenhuma linha assim, e se um
-- dia houver, alguém precisa olhar antes.
do $$
declare
  v_legadas integer;
begin
  select count(*) into v_legadas from appintura2.orcamento_itens where area_m2 <= 0;

  if v_legadas > 0 then
    raise exception
      'Existem % itens de orçamento com área zerada. Corrija-os antes de aplicar esta migration.',
      v_legadas
      using errcode = '23514';
  end if;
end
$$;

alter table appintura2.orcamento_itens
  alter column area_m2 drop default;

do $cs$ begin
  alter table appintura2.orcamento_itens
    add constraint orcamento_itens_area_positiva check (area_m2 > 0);
exception when duplicate_object then null;
end $cs$;

comment on column appintura2.orcamento_itens.area_m2 is
  'Area por unidade, em m2. Obrigatoria e > 0: alimenta o consumo de tinta e o custo por m2, e e copiada para os_itens, que tambem exige positiva.';

-- ----------------------------------------------------------------------------
-- A RPC recusa cedo, com mensagem que diz o que fazer
--
-- Sem isto o erro que chega na tela é o texto cru da constraint, que não ajuda
-- quem está preenchendo o formulário.
-- ----------------------------------------------------------------------------

create or replace function appintura2.validar_itens_orcamento(p_itens jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_item jsonb;
begin
  if p_itens is null then
    return;
  end if;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    if coalesce((v_item ->> 'area_m2')::numeric, 0) <= 0 then
      raise exception
        'Informe a área em m² do item "%": ela define o consumo de tinta e o custo da peça.',
        coalesce(v_item ->> 'descricao', '(sem descrição)')
        using errcode = '23514';
    end if;
  end loop;
end
$$;

revoke all on function appintura2.validar_itens_orcamento(jsonb) from public, anon;
grant execute on function appintura2.validar_itens_orcamento(jsonb) to authenticated, service_role;

insert into appintura2.schema_migrations (version, name)
values ('20260918100000', 'appintura2_orcamento_area_obrigatoria')
on conflict (version) do nothing;
