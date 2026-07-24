import { create } from 'zustand';

type Page = 'dashboard' | 'webinars' | 'tasks' | 'calendar' | 'archive' | 'responsibles' | 'settings';

interface AppState {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  webinarDialogOpen: boolean;
  setWebinarDialogOpen: (open: boolean) => void;
  taskDialogOpen: boolean;
  setTaskDialogOpen: (open: boolean) => void;
  refreshKey: number;
  triggerRefresh: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'dashboard',
  setCurrentPage: (page) => set({ currentPage: page }),
  webinarDialogOpen: false,
  setWebinarDialogOpen: (open) => set({ webinarDialogOpen: open }),
  taskDialogOpen: false,
  setTaskDialogOpen: (open) => set({ taskDialogOpen: open }),
  refreshKey: 0,
  triggerRefresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}));
