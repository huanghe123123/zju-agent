import { lazy, Suspense } from "react";
import type { RouteObject } from "react-router-dom";

const HomePage = lazy(() => import("../pages/Chat.js").then((m) => ({ default: m.ChatPage })));
const SetupPage = lazy(() => import("../pages/Setup.js").then((m) => ({ default: m.SetupPage })));
const CoursesPage = lazy(() => import("../pages/Courses.js").then((m) => ({ default: m.CoursesPage })));
const AssignmentsPage = lazy(() => import("../pages/Assignments.js").then((m) => ({ default: m.AssignmentsPage })));
const ExamsPage = lazy(() => import("../pages/Exams.js").then((m) => ({ default: m.ExamsPage })));
const ToolboxPage = lazy(() => import("../pages/Toolbox.js").then((m) => ({ default: m.ToolboxPage })));
const DownloadsPage = lazy(() => import("../pages/Downloads.js").then((m) => ({ default: m.DownloadsPage })));
const ClassroomPage = lazy(() => import("../pages/Classroom.js").then((m) => ({ default: m.ClassroomPage })));
const SettingsPage = lazy(() => import("../pages/Settings.js").then((m) => ({ default: m.SettingsPage })));

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<div className="p-6 text-slate-500">加载中…</div>}>{element}</Suspense>;
}

export const routes: RouteObject[] = [
  { path: "/", element: withSuspense(<HomePage />) },
  { path: "/setup", element: withSuspense(<SetupPage />) },
  { path: "/courses", element: withSuspense(<CoursesPage />) },
  { path: "/assignments", element: withSuspense(<AssignmentsPage />) },
  { path: "/exams", element: withSuspense(<ExamsPage />) },
  { path: "/toolbox", element: withSuspense(<ToolboxPage />) },
  { path: "/downloads", element: withSuspense(<DownloadsPage />) },
  { path: "/classroom", element: withSuspense(<ClassroomPage />) },
  { path: "/settings", element: withSuspense(<SettingsPage />) },
];
