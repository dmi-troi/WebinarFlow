export interface Webinar {
  id: string;
  title: string;
  description: string | null;
  date: string;
  responsibleId: string | null;
  email: string | null;
  status: 'planned' | 'active' | 'completed' | 'cancelled' | 'archived';
  completedAt: string | null;
  mtsLinkWebinarId: string | null;
  mtsLinkEventId: string | null;
  mtsLinkEventSessionId: string | null;
  mtsLinkUrl: string | null;
  mtsLinkLastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  responsible?: Responsible | null;
  tasks?: Task[];
}

export interface Task {
  id: string;
  title: string;
  webinarId: string | null;
  responsibleId: string | null;
  taskType: 'unisender' | 'mtsLink' | 'reminder' | 'eventDay' | 'sms' | 'general';
  dueDate: string;
  status: 'pending' | 'in_progress' | 'done' | 'archived';
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  webinar?: Webinar | null;
  responsible?: Responsible | null;
}

export interface Responsible {
  id: string;
  name: string;
  email: string | null;
  telegram: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { webinars: number; tasks: number };
}

export interface DashboardStats {
  totalWebinars: number;
  activeWebinars: number;
  totalTasks: number;
  todayTasks: number;
  completedTasks: number;
  pendingTasks: number;
  upcomingTasks: Task[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'webinar' | 'task';
  taskType?: string;
  status: string;
  responsible?: string;
  webinarTitle?: string;
  color: string;
}
