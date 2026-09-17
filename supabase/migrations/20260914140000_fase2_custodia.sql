-- ============================================================================
-- APPintura — Fase 2: Recebimento, Devolução e Custódia
--
-- Registro físico da mercadoria de terceiros. Independente do status de produção:
-- a OS (Fase 3) não devolve peça nenhuma — quem devolve é o romaneio de saída.
--
-- Objetos no schema `appintura2`. Depende das migrations das Fases 0 e 1.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------

create type appintura2.unidade_item as enum ('peca', 'kg', 'm2', 'conjunto');

create type appintura2.condicao_item as enum ('integra', 'avariada', 'com_observacao');

create type appintura2.status_recebimento as enum (
  'pendente_conferencia',
  'recebido_conferido',
  'recebido_com_ressalva'
);

create type appintura2.status_devolucao as enum (
  'aguardando_retirada',
  'retirado',
  'retirado_parcial'
);

-- ----------------------------------------------------------------------------
-- Configurações operacionais por empresa
-- ----------------------------------------------------------------------------

create table appintura2.configuracoes_tenant (
  tenant_id uuid primary key references appintura2.tenants (id) on delete cascade,
  dias_alerta_custodia integer not null default 15,
  constraint configuracoes_dias_alerta_valido
    check (dias_alerta_custodia between 1 and 365)
);

-- ----------------------------------------------------------------------------
-- Numeração sequencial POR TENANT
--
-- Uma sequence global vazaria o volume de uma empresa para outra (o cliente
-- veria seu romaneio nº 4.812 no primeiro dia de uso). O contador por tenant
-- fica numa tabela própria: o UPDATE ... RETURNING trava a linha, então duas
-- conferências simultâneas não tiram o mesmo número.
-- ----------------------------------------------------------------------------

create table appintura2.tenant_sequencias (
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  tipo text not null,
  ultimo_numero integer not null default 0,
  primary key (tenant_id, tipo)
);

create or replace function appintura2.proximo_numero(p_tenant_id uuid, p_tipo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numero integer;
begin
  insert into appintura2.tenant_sequencias (tenant_id, tipo, ultimo_numero)
  values (p_tenant_id, p_tipo, 1)
  on conflict (tenant_id, tipo)
    do update set ultimo_numero = appintura2.tenant_sequencias.ultimo_numero + 1
  returning ultimo_numero into v_numero;

  return v_numero;
end
$$;

create or replace function appintura2.atribuir_numero_recebimento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.numero := appintura2.proximo_numero(new.tenant_id, 'recebimento');
  return new;
end
$$;

create or replace function appintura2.atribuir_numero_devolucao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.numero := appintura2.proximo_numero(new.tenant_id, 'devolucao');
  return new;
end
$$;

-- ----------------------------------------------------------------------------
-- Romaneio de recebimento (entrada)
-- ----------------------------------------------------------------------------

create table appintura2.romaneios_recebimento (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  numero integer not null,
  cliente_id uuid not null references appintura2.clientes (id) on delete restrict,
  transportadora_id uuid references appintura2.transportadoras (id) on delete set null,
  data_hora timestamptz not null default now(),
  documento_numero text not null default '',
  documento_serie text not null default '',
  documento_chave text not null default '',
  conferente_id uuid not null references appintura2.usuarios (id),
  status appintura2.status_recebimento not null default 'pendente_conferencia',
  observacao text not null default '',
  assinatura_path text,
  assinatura_nome text not null default '',
  -- FK adicionada na migration da Fase 3, quando ordens_servico existir.
  os_id uuid,
  created_at timestamptz not null default now(),
  constraint romaneios_recebimento_numero_unico unique (tenant_id, numero)
);

create index romaneios_recebimento_tenant_idx
  on appintura2.romaneios_recebimento (tenant_id, data_hora desc);
create index romaneios_recebimento_cliente_idx
  on appintura2.romaneios_recebimento (cliente_id);

create trigger romaneios_recebimento_numero
  before insert on appintura2.romaneios_recebimento
  for each row
  when (new.numero is null)
  execute function appintura2.atribuir_numero_recebimento();

create table appintura2.romaneio_recebimento_itens (
  id uuid primary key default gen_random_uuid(),
  romaneio_id uuid not null
    references appintura2.romaneios_recebimento (id) on delete cascade,
  descricao text not null,
  quantidade numeric(12, 3) not null,
  unidade appintura2.unidade_item not null default 'peca',
  peso_kg numeric(12, 3),
  condicao_chegada appintura2.condicao_item not null default 'integra',
  observacao text not null default '',
  constraint recebimento_item_quantidade_positiva check (quantidade > 0)
);

create index romaneio_recebimento_itens_romaneio_idx
  on appintura2.romaneio_recebimento_itens (romaneio_id);

-- ----------------------------------------------------------------------------
-- Romaneio de devolução (saída)
-- ----------------------------------------------------------------------------

create table appintura2.romaneios_devolucao (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  numero integer not null,
  cliente_id uuid not null references appintura2.clientes (id) on delete restrict,
  data_hora timestamptz not null default now(),
  retirado_por_nome text not null default '',
  retirado_por_documento text not null default '',
  transportadora_id uuid references appintura2.transportadoras (id) on delete set null,
  placa text not null default '',
  status appintura2.status_devolucao not null default 'aguardando_retirada',
  assinatura_path text,
  responsavel_id uuid not null references appintura2.usuarios (id),
  created_at timestamptz not null default now(),
  constraint romaneios_devolucao_numero_unico unique (tenant_id, numero)
);

create index romaneios_devolucao_tenant_idx
  on appintura2.romaneios_devolucao (tenant_id, data_hora desc);
create index romaneios_devolucao_cliente_idx
  on appintura2.romaneios_devolucao (cliente_id);

-- Uma devolução pode consolidar itens de vários romaneios de entrada.
create table appintura2.romaneio_devolucao_recebimentos (
  devolucao_id uuid not null
    references appintura2.romaneios_devolucao (id) on delete cascade,
  recebimento_id uuid not null
    references appintura2.romaneios_recebimento (id) on delete restrict,
  primary key (devolucao_id, recebimento_id)
);

create table appintura2.romaneio_devolucao_itens (
  id uuid primary key default gen_random_uuid(),
  devolucao_id uuid not null
    references appintura2.romaneios_devolucao (id) on delete cascade,
  -- É esta FK que torna o comparativo recebido x devolvido possível.
  recebimento_item_id uuid not null
    references appintura2.romaneio_recebimento_itens (id) on delete restrict,
  quantidade numeric(12, 3) not null,
  condicao_saida appintura2.condicao_item not null default 'integra',
  justificativa text not null default '',
  constraint devolucao_item_quantidade_positiva check (quantidade > 0)
);

create index romaneio_devolucao_itens_devolucao_idx
  on appintura2.romaneio_devolucao_itens (devolucao_id);
create index romaneio_devolucao_itens_origem_idx
  on appintura2.romaneio_devolucao_itens (recebimento_item_id);

-- ----------------------------------------------------------------------------
-- Fotos (metadados; o binário vive no bucket appintura2-romaneios-fotos)
-- ----------------------------------------------------------------------------

create table appintura2.romaneio_fotos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references appintura2.tenants (id) on delete cascade,
  recebimento_item_id uuid
    references appintura2.romaneio_recebimento_itens (id) on delete cascade,
  devolucao_item_id uuid
    references appintura2.romaneio_devolucao_itens (id) on delete cascade,
  /** Caminho no bucket: {tenant_id}/{romaneio_id}/{arquivo} */
  storage_path text not null,
  nome text not null default '',
  capturada_em timestamptz not null default now(),
  -- Toda foto pertence a exatamente um item, de entrada ou de saída.
  constraint romaneio_foto_um_dono check (
    (recebimento_item_id is not null and devolucao_item_id is null)
    or (recebimento_item_id is null and devolucao_item_id is not null)
  )
);

create index romaneio_fotos_recebimento_idx
  on appintura2.romaneio_fotos (recebimento_item_id);
create index romaneio_fotos_devolucao_idx
  on appintura2.romaneio_fotos (devolucao_item_id);

create trigger romaneios_devolucao_numero
  before insert on appintura2.romaneios_devolucao
  for each row
  when (new.numero is null)
  execute function appintura2.atribuir_numero_devolucao();

-- ----------------------------------------------------------------------------
-- Saldo de custódia
--
-- `security_invoker = true` é OBRIGATÓRIO: view sem essa opção roda com os
-- privilégios do dono e ignora RLS — seria um vazamento de dados entre empresas
-- pela porta dos fundos.
-- ----------------------------------------------------------------------------

create view appintura2.saldo_custodia
with (security_invoker = true)
as
select
  r.tenant_id,
  r.cliente_id,
  r.id as recebimento_id,
  r.numero as recebimento_numero,
  r.data_hora as data_entrada,
  i.id as recebimento_item_id,
  i.descricao,
  i.unidade,
  i.quantidade as recebido,
  coalesce(d.devolvido, 0) as devolvido,
  i.quantidade - coalesce(d.devolvido, 0) as saldo,
  greatest(0, (current_date - r.data_hora::date)) as dias_em_custodia
from appintura2.romaneios_recebimento r
join appintura2.romaneio_recebimento_itens i on i.romaneio_id = r.id
left join lateral (
  select sum(di.quantidade) as devolvido
  from appintura2.romaneio_devolucao_itens di
  where di.recebimento_item_id = i.id
) d on true;

comment on view appintura2.saldo_custodia is
  'Recebido menos devolvido por item. Nunca materializar: o saldo tem que refletir correção de romaneio no mesmo instante.';

-- ----------------------------------------------------------------------------
-- RLS
--
-- Recebimento e devolução são operação de portaria, então a escrita inclui a
-- role `portaria` além de admin e gestor.
-- ----------------------------------------------------------------------------

create or replace function appintura2.pode_movimentar_custodia(tenant_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from appintura2.user_roles ur
    where ur.user_id = (select appintura2.usuario_atual())
      and ur.tenant_id = pode_movimentar_custodia.tenant_id
      and ur.role in ('admin', 'gestor_producao', 'portaria')
      and ur.status = 'ativo'
  )
$$;

grant execute on function appintura2.pode_movimentar_custodia(uuid) to authenticated;

alter table appintura2.configuracoes_tenant enable row level security;
alter table appintura2.tenant_sequencias enable row level security;
alter table appintura2.romaneios_recebimento enable row level security;
alter table appintura2.romaneio_recebimento_itens enable row level security;
alter table appintura2.romaneios_devolucao enable row level security;
alter table appintura2.romaneio_devolucao_recebimentos enable row level security;
alter table appintura2.romaneio_devolucao_itens enable row level security;
alter table appintura2.romaneio_fotos enable row level security;

-- tenant_sequencias: sem policy de acesso direto. O contador só é tocado pela
-- função SECURITY DEFINER; ninguém lê nem escreve pelo client.

create policy "configuracoes_select"
  on appintura2.configuracoes_tenant for select to authenticated
  using (tenant_id in (select appintura2.get_user_tenant_ids()));

create policy "configuracoes_upsert"
  on appintura2.configuracoes_tenant for insert to authenticated
  with check (appintura2.has_role('admin', tenant_id));

create policy "configuracoes_update"
  on appintura2.configuracoes_tenant for update to authenticated
  using (appintura2.has_role('admin', tenant_id))
  with check (appintura2.has_role('admin', tenant_id));

-- Tabelas com tenant_id próprio.
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'romaneios_recebimento',
    'romaneios_devolucao',
    'romaneio_fotos'
  ]
  loop
    execute format($f$
      create policy %1$I on appintura2.%2$I
        for select to authenticated
        using (tenant_id in (select appintura2.get_user_tenant_ids()));
    $f$, tabela || '_select', tabela);

    execute format($f$
      create policy %1$I on appintura2.%2$I
        for insert to authenticated
        with check (appintura2.pode_movimentar_custodia(tenant_id));
    $f$, tabela || '_insert', tabela);

    execute format($f$
      create policy %1$I on appintura2.%2$I
        for update to authenticated
        using (appintura2.pode_movimentar_custodia(tenant_id))
        with check (appintura2.pode_movimentar_custodia(tenant_id));
    $f$, tabela || '_update', tabela);

    -- Sem policy de DELETE: romaneio é registro de responsabilidade e não se
    -- apaga. Correção é feita por novo romaneio, não por exclusão.
  end loop;
end
$$;

-- Tabelas filhas: autorização pela raiz.

create policy "recebimento_itens_select"
  on appintura2.romaneio_recebimento_itens for select to authenticated
  using (
    exists (
      select 1 from appintura2.romaneios_recebimento r
      where r.id = romaneio_recebimento_itens.romaneio_id
        and r.tenant_id in (select appintura2.get_user_tenant_ids())
    )
  );

create policy "recebimento_itens_insert"
  on appintura2.romaneio_recebimento_itens for insert to authenticated
  with check (
    exists (
      select 1 from appintura2.romaneios_recebimento r
      where r.id = romaneio_recebimento_itens.romaneio_id
        and appintura2.pode_movimentar_custodia(r.tenant_id)
    )
  );

create policy "recebimento_itens_update"
  on appintura2.romaneio_recebimento_itens for update to authenticated
  using (
    exists (
      select 1 from appintura2.romaneios_recebimento r
      where r.id = romaneio_recebimento_itens.romaneio_id
        and appintura2.pode_movimentar_custodia(r.tenant_id)
    )
  )
  with check (
    exists (
      select 1 from appintura2.romaneios_recebimento r
      where r.id = romaneio_recebimento_itens.romaneio_id
        and appintura2.pode_movimentar_custodia(r.tenant_id)
    )
  );

create policy "devolucao_itens_select"
  on appintura2.romaneio_devolucao_itens for select to authenticated
  using (
    exists (
      select 1 from appintura2.romaneios_devolucao d
      where d.id = romaneio_devolucao_itens.devolucao_id
        and d.tenant_id in (select appintura2.get_user_tenant_ids())
    )
  );

create policy "devolucao_itens_insert"
  on appintura2.romaneio_devolucao_itens for insert to authenticated
  with check (
    exists (
      select 1 from appintura2.romaneios_devolucao d
      where d.id = romaneio_devolucao_itens.devolucao_id
        and appintura2.pode_movimentar_custodia(d.tenant_id)
    )
  );

create policy "devolucao_recebimentos_select"
  on appintura2.romaneio_devolucao_recebimentos for select to authenticated
  using (
    exists (
      select 1 from appintura2.romaneios_devolucao d
      where d.id = romaneio_devolucao_recebimentos.devolucao_id
        and d.tenant_id in (select appintura2.get_user_tenant_ids())
    )
  );

create policy "devolucao_recebimentos_insert"
  on appintura2.romaneio_devolucao_recebimentos for insert to authenticated
  with check (
    exists (
      select 1 from appintura2.romaneios_devolucao d
      where d.id = romaneio_devolucao_recebimentos.devolucao_id
        and appintura2.pode_movimentar_custodia(d.tenant_id)
    )
  );

-- ----------------------------------------------------------------------------
-- Storage: bucket appintura2-romaneios-fotos
--
-- O bucket e as policies levam o prefixo do schema porque `storage.buckets` e
-- `storage.objects` são compartilhados com os outros sistemas deste Supabase —
-- já existe um bucket `romaneios-fotos` de outro produto.
--
-- Privado. O caminho é {tenant_id}/{romaneio_id}/{arquivo}, e a primeira pasta
-- é exatamente o que a policy compara — por isso o upload NUNCA pode montar o
-- caminho com um tenant_id vindo do client sem passar por esta checagem.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'appintura2-romaneios-fotos',
  'appintura2-romaneios-fotos',
  false,
  5242880, -- 5 MB: a foto é comprimida no cliente antes do upload
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "appintura2_romaneios_fotos_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'appintura2-romaneios-fotos'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from appintura2.get_user_tenant_ids() as tenant_id
    )
  );

create policy "appintura2_romaneios_fotos_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'appintura2-romaneios-fotos'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from appintura2.get_user_tenant_ids() as tenant_id
    )
  );

-- Sem UPDATE nem DELETE: foto de conferência é prova. Substituição se faz com
-- novo arquivo, preservando o original.

insert into appintura2.schema_migrations (version, name)
values ('20260914140000', 'fase2_custodia')
on conflict (version) do nothing;
