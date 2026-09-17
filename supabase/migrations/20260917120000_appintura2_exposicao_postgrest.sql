-- ============================================================================
-- APPintura — expõe o schema `appintura2` na API REST (PostgREST)
--
-- Depende das migrations das Fases 0 a 7.
--
-- Um schema só é alcançável pelo supabase-js quando está em `pgrst.db_schemas`.
-- Este Supabase é compartilhado: a lista já contém os schemas de aperp,
-- apticket e apfiscal, então NÃO se pode sobrescrever o valor — o bloco abaixo
-- lê o que está lá e só acrescenta `appintura2` se ainda não estiver presente.
-- Rodar de novo é inofensivo.
--
-- A configuração fica no banco (não no env do container) porque é assim que
-- este servidor já a mantém; com `db-config` ligado, o valor do banco é o que
-- o PostgREST usa.
-- ============================================================================

do $$
declare
  v_atual text;
  v_novo  text;
begin
  select split_part(cfg, '=', 2)
    into v_atual
  from pg_db_role_setting s
  cross join unnest(s.setconfig) as cfg
  where s.setrole = 'authenticator'::regrole
    and s.setdatabase = 0
    and cfg like 'pgrst.db_schemas=%'
  limit 1;

  -- Sem linha configurada, o PostgREST está usando o default do env do
  -- container. Preservamos o mínimo que o Supabase precisa e acrescentamos
  -- o nosso.
  v_atual := coalesce(v_atual, 'public,storage,graphql_public');

  if 'appintura2' = any (string_to_array(replace(v_atual, ' ', ''), ',')) then
    raise notice 'appintura2 ja exposto (%); nada a fazer.', v_atual;
    return;
  end if;

  v_novo := v_atual || ',appintura2';
  execute format('alter role authenticator set pgrst.db_schemas = %L', v_novo);
  raise notice 'pgrst.db_schemas: % -> %', v_atual, v_novo;
end
$$;

-- Recarrega a configuração do PostgREST sem reiniciar o container (os outros
-- sistemas que usam esta mesma API não sofrem queda).
notify pgrst, 'reload config';
notify pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- Rede de segurança dos privilégios
--
-- As default privileges da Fase 0 já cobrem tudo que foi criado depois delas.
-- Este bloco existe para o caso de algum objeto ter sido criado fora daquele
-- caminho (hotfix aplicado à mão, restore parcial): reafirmar é idempotente e
-- barato. RLS continua sendo o que separa os tenants — GRANT só abre a porta.
-- ----------------------------------------------------------------------------

grant usage on schema appintura2 to anon, authenticated, service_role;

grant select, insert, update, delete
  on all tables in schema appintura2 to authenticated;
grant all on all tables in schema appintura2 to service_role;
grant usage, select on all sequences in schema appintura2 to authenticated, service_role;

-- `anon` NÃO recebe grant de tabela: o único acesso anônimo é a função de
-- consulta pública do romaneio (Fase 7), que é SECURITY DEFINER.

-- O `on all tables` acima é grosso demais: pega a tabela de controle e devolve
-- a `usuarios` o select em TODAS as colunas, `senha_hash` inclusive. As duas
-- voltam ao regime restrito da Fase 0.
revoke all on appintura2.schema_migrations from anon, authenticated;

revoke all on appintura2.usuarios from anon, authenticated;
grant select (id, email, nome, telefone, ativo, ultimo_login_em, created_at)
  on appintura2.usuarios to authenticated;
grant update (nome, telefone) on appintura2.usuarios to authenticated;

insert into appintura2.schema_migrations (version, name)
values ('20260917120000', 'appintura2_exposicao_postgrest')
on conflict (version) do nothing;
