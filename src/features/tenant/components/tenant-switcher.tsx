import { Building2, Check, ChevronsUpDown } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTenant } from '@/features/tenant/tenant-context'
import { formatCnpj } from '@/lib/format'
import { ROLE_LABEL } from '@/types/domain'

export function TenantSwitcher() {
  const { tenantAtivo, vinculos, trocarTenant } = useTenant()

  // Um único vínculo não precisa de controle interativo — vira apenas identificação.
  if (vinculos.length <= 1) {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <Building2 className="size-4 shrink-0 text-brand-medium" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-brand-dark">
            {tenantAtivo.nome_fantasia}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {formatCnpj(tenantAtivo.cnpj)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="h-12 min-w-0 shrink max-w-[17rem] justify-between gap-2 px-3 text-left"
          aria-label={`Empresa ativa: ${tenantAtivo.nome_fantasia}. Trocar de empresa`}
        >
          <Building2 className="size-4 shrink-0 text-brand-medium" aria-hidden />

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-brand-dark">
              {tenantAtivo.nome_fantasia}
            </span>
            <span className="block truncate font-mono text-xs font-normal text-muted-foreground">
              {formatCnpj(tenantAtivo.cnpj)}
            </span>
          </span>

          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[17rem]">
        <DropdownMenuLabel>Suas empresas</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {vinculos.map((vinculo) => {
          const ativo = vinculo.tenant.id === tenantAtivo.id

          return (
            <DropdownMenuItem
              key={vinculo.tenant.id}
              onSelect={() => trocarTenant(vinculo.tenant.id)}
              className="gap-2 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {vinculo.tenant.nome_fantasia}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {formatCnpj(vinculo.tenant.cnpj)} · {ROLE_LABEL[vinculo.role]}
                </span>
              </span>

              {ativo && <Check className="size-4 shrink-0 text-brand-medium" aria-hidden />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
