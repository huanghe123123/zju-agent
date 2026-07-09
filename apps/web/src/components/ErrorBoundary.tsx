import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null; info: ErrorInfo | null };

/**
 * 全局错误边界。
 * 任何子组件渲染期抛错都会被捕获，避免整树卸载导致白屏，
 * 并把错误信息显示出来便于诊断。
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    // 控制台留痕，便于在 DevTools 查看
    console.error("[ErrorBoundary] 渲染异常:", error, info);
  }

  override render() {
    if (this.state.hasError) {
      const err = this.state.error;
      return (
        <div className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm">
          <div className="mb-2 font-semibold text-rose-700">
            ⚠️ 页面渲染出错
          </div>
          <div className="mb-2 text-rose-600">{err?.message ?? String(err)}</div>
          {err?.stack && (
            <pre className="max-h-60 overflow-auto rounded bg-white/70 p-2 text-[11px] text-slate-600">
              {err.stack}
            </pre>
          )}
          {this.state.info?.componentStack && (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-white/70 p-2 text-[11px] text-slate-500">
              {this.state.info.componentStack}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null, info: null })}
            className="mt-3 rounded bg-zju-primary px-3 py-1.5 text-xs text-white hover:bg-zju-light"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
