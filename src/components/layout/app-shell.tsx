import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

import { AppTopbar } from './app-topbar'
import { SidebarNav } from './sidebar-nav'

export function AppShell() {
  const [menuAberto, setMenuAberto] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar fixa a partir de lg; abaixo disso vira drawer (tablet retrato / celular). */}
      <aside className="hidden w-72 shrink-0 lg:block">
        <div className="fixed inset-y-0 left-0 w-72">
          <SidebarNav />
        </div>
      </aside>

      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent side="left" className="w-72 border-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Módulos do APPintura</SheetTitle>
          <SidebarNav onNavigate={() => setMenuAberto(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar onAbrirMenu={() => setMenuAberto(true)} />

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
