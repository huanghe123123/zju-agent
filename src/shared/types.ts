export type AuthStatus = "signed-out" | "signing-in" | "signed-in" | "error";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResult {
  ok: boolean;
  displayName?: string;
  message?: string;
}

export interface DeadlineItem {
  id: string;
  course: string;
  title: string;
  dueAt: string;
  source: "学在浙大";
  status: "open" | "submitted" | "closed";
}

export interface ScheduleItem {
  id: string;
  title: string;
  location: string;
  startAt: string;
  endAt: string;
  type: "course" | "exam";
  teacher?: string;
}

export interface ClassroomItem {
  id: string;
  course: string;
  title: string;
  kind: "live" | "replay" | "material";
  startsAt?: string;
  url: string;
}

export interface CourseResource {
  id: string;
  course: string;
  name: string;
  size: string;
  updatedAt: string;
  url: string;
}

export interface DashboardData {
  generatedAt: string;
  deadlines: DeadlineItem[];
  schedule: ScheduleItem[];
  classrooms: ClassroomItem[];
  resources: CourseResource[];
}

export interface DownloadResult {
  ok: boolean;
  path?: string;
  message?: string;
}

export interface DesktopApi {
  login(request: LoginRequest): Promise<LoginResult>;
  getDashboard(): Promise<DashboardData>;
  downloadResource(resource: CourseResource): Promise<DownloadResult>;
  sendTestReminder(title: string, body: string): Promise<boolean>;
}

declare global {
  interface Window {
    zjuAgent: DesktopApi;
  }
}
