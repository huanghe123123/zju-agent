export function ErrorState({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
      <div className="text-sm font-medium text-rose-700">加载失败</div>
      <div className="mt-1 text-xs text-rose-600">{message}</div>
      {hint && <div className="mt-2 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
