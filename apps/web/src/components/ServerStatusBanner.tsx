import { useEffect } from "react";
import { useBootstrapStore } from "../api/bootstrap.js";

export function ServerStatusBanner({
  isReady,
  isConnected,
  error,
}: {
  isReady: boolean;
  isConnected: boolean;
  error: string | null;
}) {
  // 后端连接成功后，每隔 15s 探活一次
  const token = useBootstrapStore((s) => s.token);
  const setIsConnected = (v: boolean) => useBootstrapStore.setState({ isConnected: v });

  useEffect(() => {
    if (!isConnected || !token) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/health", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setIsConnected(res.ok);
      } catch {
        setIsConnected(false);
      }
    }, 15_000);
    return () => clearInterval(id);
  }, [isConnected, token]);

  if (!isReady) {
    return (
      <div className="bg-slate-200 text-slate-700 px-4 py-2 text-sm">
        正在连接本地后端服务…
      </div>
    );
  }
  if (!isConnected) {
    return (
      <div className="bg-rose-100 text-rose-800 px-4 py-2 text-sm">
        ⚠️ 无法连接本地后端服务。{error ? `（${error}）` : "请确认后端已启动（默认 127.0.0.1:7788）。"}
      </div>
    );
  }
  return null;
}
