import { useState } from "react";
import { Layout } from "../components/Layout.js";
import { ErrorState } from "../components/ErrorState.js";
import { Loading } from "../components/Loading.js";
import { useDownloads, useDeleteDownload, downloadPreviewUrl } from "../api/zju.js";
import { useToken } from "../api/bootstrap.js";
import { formatBytes, formatDateTime } from "../utils/format.js";
import type { DownloadRecord } from "../api/zju.js";
import { Badge, Button, Card, EmptyState } from "@crisp-ui-kit/crisp";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolderOpen,
  faXmark,
  faFilePdf,
  faFileWord,
  faFilePowerpoint,
  faFileExcel,
  faFileImage,
  faFileVideo,
  faFileAudio,
  faFileZipper,
  faFileLines,
  faFile,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

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
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zju-primary">下载</h1>
          {data?.downloadDir && (
            <div className="mt-1 text-xs text-slate-400">存储目录：{data.downloadDir}</div>
          )}
        </div>
        <Button
          intent="neutral"
          size="sm"
          onClick={() => refetch()}
          loading={isFetching}
          className="text-xs"
        >
          {isFetching ? "刷新中…" : "刷新"}
        </Button>
      </div>

      {error ? (
        <ErrorState message={error.message} />
      ) : isLoading ? (
        <Loading />
      ) : records.length === 0 ? (
        <Card raised className="p-8 text-center">
          <EmptyState
            variant="default"
            icon={<FontAwesomeIcon icon={faFolderOpen} className="text-3xl text-slate-300" />}
            title="还没有下载过文件"
            description="前往「课程」页下载课件后会出现在这里。"
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
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
        </div>
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
  const [downloading, setDownloading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const token = useToken();
  const canPreview = previewKind(record) !== "unsupported";
  const iconInfo = fileIconInfo(record.fileName);

  async function downloadFile() {
    try {
      setDownloading(true);
      const url = downloadPreviewUrl(record.id, false, token);
      const a = document.createElement("a");
      a.href = url;
      a.download = record.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card
      raised
      interactive
      className={`p-3.5 transition-all duration-150 ${
        selected ? "border-zju-primary ring-1 ring-zju-primary" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`shrink-0 text-xl ${iconInfo.color}`}>
          <FontAwesomeIcon icon={iconInfo.icon} />
        </div>
        <div className="min-w-0 flex-1">
          <button
            onClick={onPreview}
            className="block w-full truncate text-left text-sm font-semibold text-slate-800 hover:text-zju-primary cursor-pointer"
            title={record.fileName}
          >
            {record.fileName}
          </button>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
            <span>{formatBytes(record.size)}</span>
            <span>·</span>
            <span>{formatDateTime(record.createdAt)}</span>
            {record.source === "classroom" && (
              <Badge tone="neutral" size="small">
                智云
              </Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {canPreview && (
            <Button
              intent="ghost"
              size="sm"
              onClick={onPreview}
              className="text-xs text-zju-primary font-medium"
            >
              预览
            </Button>
          )}
          <Button
            intent="neutral"
            size="sm"
            onClick={() => void downloadFile()}
            loading={downloading}
            className="text-xs text-slate-700"
          >
            下载
          </Button>
          {confirming ? (
            <span className="flex items-center gap-1 text-xs">
              <Button
                intent="danger"
                size="sm"
                onClick={() => { onDelete(true); setConfirming(false); }}
                disabled={deleting}
                className="text-xs"
              >
                删文件
              </Button>
              <Button
                intent="neutral"
                size="sm"
                onClick={() => { onDelete(false); setConfirming(false); }}
                disabled={deleting}
                className="text-xs"
              >
                仅删记录
              </Button>
              <Button
                intent="ghost"
                size="sm"
                onClick={() => setConfirming(false)}
                className="text-xs"
              >
                <FontAwesomeIcon icon={faXmark} className="text-xs" />
              </Button>
            </span>
          ) : (
            <Button
              intent="ghost"
              size="sm"
              onClick={() => setConfirming(true)}
              disabled={deleting}
              className="text-xs text-slate-400 hover:text-rose-600"
            >
              删除
            </Button>
          )}
        </div>
      </div>
    </Card>
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
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <FontAwesomeIcon icon={faXmark} />
          </button>
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
              <div className="text-4xl text-slate-400">
                <FontAwesomeIcon icon={faFileLines} />
              </div>
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

function fileIconInfo(name: string): { icon: IconDefinition; color: string } {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["pdf"].includes(ext)) return { icon: faFilePdf, color: "text-rose-600" };
  if (["doc", "docx"].includes(ext)) return { icon: faFileWord, color: "text-blue-600" };
  if (["ppt", "pptx"].includes(ext)) return { icon: faFilePowerpoint, color: "text-amber-600" };
  if (["xls", "xlsx"].includes(ext)) return { icon: faFileExcel, color: "text-emerald-600" };
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return { icon: faFileImage, color: "text-purple-600" };
  if (["mp4", "mov", "avi"].includes(ext)) return { icon: faFileVideo, color: "text-indigo-600" };
  if (["mp3", "wav"].includes(ext)) return { icon: faFileAudio, color: "text-pink-600" };
  if (["zip", "rar", "7z"].includes(ext)) return { icon: faFileZipper, color: "text-amber-700" };
  if (["txt", "md", "json"].includes(ext)) return { icon: faFileLines, color: "text-slate-600" };
  return { icon: faFile, color: "text-slate-500" };
}
