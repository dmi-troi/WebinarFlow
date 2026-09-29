'use client';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  LayoutDashboard,
  Video,
  CheckSquare,
  CalendarDays,
  Archive,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
} from 'lucide-react';
import { useState } from 'react';
import { BrandLogo } from './BrandLogo';

type Page = 'dashboard' | 'webinars' | 'tasks' | 'calendar' | 'archive' | 'responsibles' | 'settings';

const navItems: { page: Page; label: string; icon: React.ElementType; description: string }[] = [
  { page: 'dashboard', label: 'Дашборд', description: 'Обзор и контроль', icon: LayoutDashboard },
  { page: 'webinars', label: 'Вебинары', description: 'Мероприятия', icon: Video },
  { page: 'tasks', label: 'Задачи', description: 'Подготовка', icon: CheckSquare },
  { page: 'calendar', label: 'Календарь', description: 'Расписание', icon: CalendarDays },
  { page: 'archive', label: 'Архив', description: 'Завершённые', icon: Archive },
  { page: 'responsibles', label: 'Ответственные', description: 'Команда', icon: Users },
  { page: 'settings', label: 'Настройки', description: 'Система', icon: Settings },
];

export function AppSidebar() {
  const { currentPage, setCurrentPage } = useAppStore();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`${collapsed ? 'w-[76px]' : 'w-[260px]'} hidden md:flex flex-col transition-[width] duration-300 bg-[#08182f] border-r border-white/10`}
    >
      <div className={`${collapsed ? 'px-3' : 'px-5'} py-5 flex items-center min-h-[76px]`}>
        <BrandLogo className={collapsed ? 'w-10 h-10' : 'h-10 max-w-[190px]'} alt="WebinarFlow" />
      </div>

      <div className="mx-4 h-px bg-white/10" />

      <ScrollArea className="flex-1 py-4">
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map(({ page, label, description, icon: Icon }) => {
            const active = currentPage === page;
            return (
              <Button
                key={page}
                variant="ghost"
                title={collapsed ? `${label} — ${description}` : undefined}
                className={`group relative justify-start gap-3 w-full min-h-11 rounded-xl text-sm px-3 transition-all ${
                  active
                    ? 'bg-[#1E5BEB] text-white shadow-lg shadow-[#1E5BEB]/20 hover:bg-[#1E5BEB]/90'
                    : 'text-[#9bb0cf] hover:text-white hover:bg-white/[0.07]'
                }`}
                onClick={() => setCurrentPage(page)}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-white' : 'text-[#7f95b8] group-hover:text-white'}`} />
                {!collapsed && (
                  <span className="min-w-0 text-left">
                    <span className="block font-medium">{label}</span>
                    <span className={`block text-[10px] ${active ? 'text-white/70' : 'text-[#607799]'}`}>{description}</span>
                  </span>
                )}
              </Button>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="mx-4 h-px bg-white/10" />
      <div className={`${collapsed ? 'p-3' : 'p-4'} space-y-3`}>
        <div className={`${collapsed ? 'hidden' : 'block'} rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3`}>
          <div className="flex items-center gap-2 text-xs font-medium text-white">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            MTS Link
          </div>
          <p className="mt-1 text-[10px] text-[#7288a9]">Подключение в режиме чтения</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          className="w-full justify-center text-[#7890b4] hover:text-white hover:bg-white/[0.06]"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4 mr-2" /> Свернуть</>}
        </Button>
        {!collapsed && <p className="text-[10px] text-[#3f5678] text-center">WebinarFlow v3.1 local</p>}
      </div>
    </aside>
  );
}
