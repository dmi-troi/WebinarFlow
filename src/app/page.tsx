'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { AppSidebar } from '@/components/webinarflow/AppSidebar';
import { DashboardPage } from '@/components/webinarflow/DashboardPage';
import { WebinarsPage } from '@/components/webinarflow/WebinarsPage';
import { TasksPage } from '@/components/webinarflow/TasksPage';
import { CalendarPage } from '@/components/webinarflow/CalendarPage';
import { ArchivePage } from '@/components/webinarflow/ArchivePage';
import { ResponsiblesPage } from '@/components/webinarflow/ResponsiblesPage';
import { SettingsPage } from '@/components/webinarflow/SettingsPage';
import { BrandLogo } from '@/components/webinarflow/BrandLogo';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogIn, LayoutDashboard, Video, CheckSquare, CalendarDays, Archive, Users, Settings, ChevronUp } from 'lucide-react';

const pages = {
  dashboard: DashboardPage,
  webinars: WebinarsPage,
  tasks: TasksPage,
  calendar: CalendarPage,
  archive: ArchivePage,
  responsibles: ResponsiblesPage,
  settings: SettingsPage,
} as const;

const mainNav = [
  { page: 'dashboard', label: 'Главная', icon: LayoutDashboard },
  { page: 'webinars', label: 'Вебинары', icon: Video },
  { page: 'tasks', label: 'Задачи', icon: CheckSquare },
  { page: 'calendar', label: 'Календарь', icon: CalendarDays },
];
const moreNav = [
  { page: 'archive', label: 'Архив', icon: Archive },
  { page: 'responsibles', label: 'Ответственные', icon: Users },
  { page: 'settings', label: 'Настройки', icon: Settings },
];
const pageTitles: Record<string, string> = {
  dashboard: 'Главная', webinars: 'Вебинары', tasks: 'Задачи', calendar: 'Календарь', archive: 'Архив', responsibles: 'Ответственные', settings: 'Настройки',
};

function LoginScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (res.ok) window.location.reload();
      else {
        const data = await res.json();
        setError(data.error || 'Ошибка');
      }
    } catch {
      setError('Нет связи с сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08182f] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl">
        <div className="text-center mb-7">
          <BrandLogo className="h-12 max-w-[200px] mx-auto mb-4" />
          <h1 className="text-white text-xl font-bold">WebinarFlow</h1>
          <p className="text-[#7d90ac] text-sm mt-1">Введите пароль для входа</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" autoFocus className="bg-white/[0.06] border-white/10 text-white placeholder:text-[#6f829f] h-11" />
          {error && <p className="text-red-300 text-sm">{error}</p>}
          <Button type="submit" disabled={!password || loading} className="w-full h-11 bg-[#1E5BEB] hover:bg-[#1749bb]">
            {loading ? '...' : <><LogIn className="h-4 w-4 mr-2" />Войти</>}
          </Button>
        </form>
      </div>
    </div>
  );
}

function MobileHeader() {
  const currentPage = useAppStore((s) => s.currentPage);
  return (
    <header className="md:hidden sticky top-0 z-40 bg-[#08182f] border-b border-white/10 px-4 py-2.5 flex items-center gap-3">
      <BrandLogo className="h-7 max-w-[115px]" alt="WebinarFlow" />
      <span className="text-white/85 text-sm font-medium ml-auto">{pageTitles[currentPage]}</span>
    </header>
  );
}

function MobileNav() {
  const { currentPage, setCurrentPage } = useAppStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const isMorePage = moreNav.some((n) => n.page === currentPage);
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-50">
      {moreOpen && (
        <div className="absolute bottom-full left-0 right-0 bg-[#0c2140] border-t border-white/10 shadow-2xl">
          {moreNav.map(({ page, label, icon: Icon }) => (
            <button key={page} onClick={() => { setCurrentPage(page as typeof currentPage); setMoreOpen(false); }} className={`w-full flex items-center gap-3 px-5 py-3.5 text-sm transition-colors ${currentPage === page ? 'text-[#6bb1ff] bg-[#1E5BEB]/10' : 'text-[#91a6c4] hover:bg-white/[0.05]'}`}>
              <Icon className="h-[18px] w-[18px]" />{label}
            </button>
          ))}
        </div>
      )}
      <nav className="flex bg-[#08182f] border-t border-white/10">
        {mainNav.map(({ page, label, icon: Icon }) => {
          const active = currentPage === page;
          return (
            <button key={page} onClick={() => { setCurrentPage(page as typeof currentPage); setMoreOpen(false); }} className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${active ? 'text-[#6bb1ff]' : 'text-[#647a9b]'}`}>
              <Icon className={`h-5 w-5 ${active ? 'stroke-[2.2]' : ''}`} />
              <span className={`text-[10px] leading-none ${active ? 'font-medium' : ''}`}>{label}</span>
            </button>
          );
        })}
        <button onClick={() => setMoreOpen(!moreOpen)} className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors ${isMorePage || moreOpen ? 'text-[#6bb1ff]' : 'text-[#647a9b]'}`}>
          <ChevronUp className={`h-5 w-5 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
          <span className={`text-[10px] leading-none ${isMorePage || moreOpen ? 'font-medium' : ''}`}>Ещё</span>
        </button>
      </nav>
    </div>
  );
}

export default function Home() {
  const currentPage = useAppStore((s) => s.currentPage);
  const PageComponent = pages[currentPage];
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth').then((r) => r.json()).then((d) => setAuthed(d.authenticated)).catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <div className="min-h-screen bg-[#08182f] flex items-center justify-center"><div className="h-8 w-8 animate-spin border-2 border-[#6bb1ff] border-t-transparent rounded-full" /></div>;
  if (!authed) return <LoginScreen />;

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileHeader />
        <main className="flex-1 overflow-auto pb-16 md:pb-0"><PageComponent /></main>
      </div>
      <MobileNav />
      <Toaster />
    </div>
  );
}
