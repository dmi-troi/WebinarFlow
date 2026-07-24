'use client';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard, Video, CheckSquare, CalendarDays,
  Archive, Users, Settings, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useState } from 'react';

type Page = 'dashboard' | 'webinars' | 'tasks' | 'calendar' | 'archive' | 'responsibles' | 'settings';

const navItems: { page: Page; label: string; icon: React.ElementType }[] = [
  { page: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { page: 'webinars', label: 'Вебинары', icon: Video },
  { page: 'tasks', label: 'Задачи', icon: CheckSquare },
  { page: 'calendar', label: 'Календарь', icon: CalendarDays },
  { page: 'archive', label: 'Архив', icon: Archive },
  { page: 'responsibles', label: 'Ответственные', icon: Users },
  { page: 'settings', label: 'Настройки', icon: Settings },
];

export function AppSidebar() {
  const { currentPage, setCurrentPage } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} hidden md:flex flex-col transition-all duration-300 bg-[#0A1628] border-r border-[#1E3A6E]`}>      {/* Logo */}
      <div className="p-4 flex items-center min-h-[64px]">
        <img src="/logo-eurokappa-transparent.png" alt="eurokappa Academy" className={`object-contain shrink-0 ${collapsed ? 'w-10 h-10' : 'h-11'}`} />
      </div>

      <div className="mx-3 h-px bg-[#1E3A6E]" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-3">
        <nav className="flex flex-col gap-1 px-2">
          {navItems.map(({ page, label, icon: Icon }) => {
            const active = currentPage === page;
            return (
              <Button
                key={page}
                variant="ghost"
                className={`justify-start gap-3 w-full h-9 text-sm ${
                  active
                    ? 'bg-[#1E5BEB] text-white hover:bg-[#1E5BEB]/90 shadow-md shadow-[#1E5BEB]/20'
                    : 'text-[#8BA3C7] hover:text-white hover:bg-[#0F2557]'
                }`}
                onClick={() => setCurrentPage(page)}
              >
                <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : ''}`} />
                {!collapsed && <span>{label}</span>}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="mx-3 h-px bg-[#1E3A6E]" />
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-[#5A6B8A] hover:text-white hover:bg-[#0F2557]"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4 mr-1" /> Свернуть</>}
        </Button>
      </div>

      {/* Version badge */}
      {!collapsed && (
        <div className="px-4 pb-3">
          <p className="text-[10px] text-[#3A4F6F]">WebinarFlow v3.0</p>
        </div>
      )}
    </aside>
  );
}
