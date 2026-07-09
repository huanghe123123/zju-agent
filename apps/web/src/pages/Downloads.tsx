import { useState } from "react";
import { Layout } from "../components/Layout.js";
import { ErrorState } from "../components/ErrorState.js";
import { Loading } from "../components/Loading.js";
import { useDownloads, useDeleteDownload, downloadPreviewUrl } from "../api/zju.js";
import { useToken } from "../api/bootstrap.js";
import { formatBytes, formatDateTime } from "../utils/format.js";
import type { DownloadRecord } from "../api/zju.js";

type PreviewState =
  | { type: "none" }
  | { type: "loading"; id: string }
  | { type: "error"; message: string }
  | { type: "image"; url: string }
  | { type: "pdf"; url: string }
  | { type: "text"; url: string }
  | { type: "unsupported"; fileName: string; mime?: string };

/** 哪些文件可在浏览器内联预览 */
function previewKind(record: DownloadRecord): "image" | "pdf" | "text" | "unsupported" {
  const mime = record.mimeType?.toLowerCase() ?? "";
  const ext = record.fileName.toLowerCase().split(".").pop() ?? "";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return "image";
  }
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (["text/plain", "text/markdown", "application/json"].includes(mime) || ["txt", "md", "json"].includes(ext)) {
    return "text";
  }
  return "unsupported";
}

export function DownloadsPage() {
  const { data, isLoading, error, refetch, isFetching } = useDownloads();
  const del = useDeleteDownload();
  const token = useToken();
  const [preview, setPreview] = useState<PreviewState>({ type: "none" });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const records = data?.records ?? [];

  async function openPreview(record: DownloadRecord) {
    setSelectedId(record.id);
    setPreview({ type: "loading", id: record.id });
    try {
      const kind = previewKind(record);
      const url = downloadPreviewUrl(record.id, token, true);
      if (kind === "unsupported") {
        setPreview({ type: "unsupported", fileName: record.fileName, mime: record.mimeType });
        return;
      }
      // 文本类需 fetch 内容；图片/PDF 直接用 URL（带 token query）
      if (kind === "text") {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });
        if (!res.ok) throw new Error(`读取失败 HTTP ${res.status}`);
        const text = await res.text();
        // 用 blob URL 渲染文本，避免直接塞大字符串进 state
        const blobUrl = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
        setPreview({ type: "text", url: blobUrl });
      } else {
        setPreview({ type: kind, url });
      }
    } catch (err) {
      setPreview({
        type: "error",
        message: err instanceof Error ? err.message : "预览失败",
      });
    }
  }

  function closePreview() {
    if (preview.type === "text" && preview.url.startsWith("blob:")) {
      URL.revokeObjectURL(preview.url);
    }
    setPreview({ type: "none" });
    setSelectedId(null);
  }

  return (
    <Layout>
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zju-primary">下载</h1>
          {data?.downloadDir && (
            <div className="mt-1 text-xs text-slate-400">存储目录：{data.downloadDir}</div>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-sm text-slate-500 hover:text-zju-primary disabled:opacity-50"
        >
          {isFetching ? "刷新中…" : "刷新"}
        </button>
      </div>

      {error ? (
        <ErrorState message={error.message} />
      ) : isLoading ? (
        <Loading />
      ) : records.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          还没有下载过文件。前往「课程」页下载课件后会出现在这里。
        </div>
      ) : (
        <ul className="space-y-2">
          {records.map((r) => (
            <DownloadRow
              key={r.id}
              record={r}
              selected={selectedId === r.id}
              onPreview={() => openPreview(r)}
              onDelete={(purge) => del.mutate({ id: r.id, purge })}
              deleting={del.isPending}
            />
          ))}
        </ul>
      )}

      {preview.type !== "none" && (
        <PreviewDrawer state={preview} onClose={closePreview} />
      )}
    </Layout>
  );
}

function DownloadRow({
  record,
  selected,
  onPreview,
  onDelete,
  deleting,
}: {
  record: DownloadRecord;
  selected: boolean;
  onPreview: () => void;
  onDelete: (purge: boolean) => void;
  deleting: boolean;
}) {
  const token = useToken();
  const kind = previewKind(record);
  const canPreview = kind !== "unsupported";
  const [confirming, setConfirming] = useState(false);

  return (
    <li
      className={`rounded-lg border bg-white p-3 shadow-sm transition ${
        selected ? "border-zju-primary ring-1 ring-zju-primary" : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 text-2xl">{fileIcon(record.fileName)}</div>
        <div className="min-w-0 flex-1">
          <button
            onClick={onPreview}
            className="block w-full truncate text-left text-sm font-medium text-slate-800 hover:text-zju-primary"
            title={record.fileName}
          >
            {record.fileName}
          </button>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
            <span>{formatBytes(record.size)}</span>
            <span>·</span>
            <span>{formatDateTime(record.createdAt)}</span>
            {record.source === "classroom" && (
              <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-500">智云</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canPreview && (
            <button
              onClick={onPreview}
              className="rounded px-2 py-1 text-xs text-zju-primary hover:bg-slate-100"
            >
              预览
            </button>
          )}
          <a
            href={downloadPreviewUrl(record.id, token, false)}
            className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
          >
            下载
          </a>
          {confirming ? (
            <span className="flex items-center gap-1 text-xs">
              <button
                onClick={() => { onDelete(true); setConfirming(false); }}
                disabled={deleting}
                className="rounded bg-rose-600 px-2 py-1 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                删文件
              </button>
              <button
                onClick={() => { onDelete(false); setConfirming(false); }}
                disabled={deleting}
                className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                仅删记录
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="rounded px-1 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              disabled={deleting}
              className="rounded px-2 py-1 text-xs text-rose-500 hover:bg-rose-50 disabled:opacity-50"
            >
              删除
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function PreviewDrawer({
  state,
  onClose,
}: {
  state: PreviewState;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-3xl flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="font-semibold text-zju-primary">预览</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="flex-1 overflow-auto bg-slate-50 p-4">
          {state.type === "loading" && (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">加载中…</div>
          )}
          {state.type === "error" && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
              {state.message}
            </div>
          )}
          {state.type === "unsupported" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <div className="text-4xl">📄</div>
              <div className="text-sm text-slate-600">{state.fileName}</div>
              <div className="text-xs text-slate-400">
                此类型文件无法在浏览器内预览{state.mime ? `（${state.mime}）` : ""}，请点击「下载」用本地软件打开。
              </div>
            </div>
          )}
          {state.type === "image" && (
            <img src={state.url} alt="预览" className="mx-auto max-h-full max-w-full object-contain" />
          )}
          {state.type === "pdf" && (
            <iframe src={state.url} title="PDF 预览" className="h-full w-full border-0 bg-white" />
          )}
          {state.type === "text" && (
            <iframe src={state.url} title="文本预览" className="h-full w-full border-0 bg-white p-4 font-mono text-sm" />
          )}
        </div>
      </div>
    </div>
  );
}

function fileIcon(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["pdf"].includes(ext)) return "📕";
  if (["doc", "docx"].includes(ext)) return "📘";
  if (["ppt", "pptx"].includes(ext)) return "📙";
  if (["xls", "xlsx"].includes(ext)) return "📗";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "🖼️";
  if (["mp4", "mov", "avi"].includes(ext)) return "🎬";
  if (["mp3", "wav"].includes(ext)) return "🎵";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  if (["txt", "md", "json"].includes(ext)) return "📄";
  return "📦";
}
