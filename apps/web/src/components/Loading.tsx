export function Loading({ message }: { message?: string }) {
  return (
    <div className="flex items-center justify-center p-8 text-sm text-slate-400">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-zju-primary" />
      <span className="ml-2">{message ?? "加载中…"}</span>
    </div>
  );
}
