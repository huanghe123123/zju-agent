import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "../components/Layout.js";
import { useApiFetch } from "../api/bootstrap.js";
import { useValidateCredential, useLogout } from "../api/auth.js";

export function SettingsPage() {
  const apiFetch = useApiFetch();
  const navigate = useNavigate();
  const validate = useValidateCredential();
  const logout = useLogout();
  const [modelOpen, setModelOpen] = useState(false);
  const [model, setModel] = useState({
    id: crypto.randomUUID(),
    name: "默认模型",
    protocol: "openai" as "openai" | "anthropic",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
    enabled: true,
  });
  const [message, setMessage] = useState<string | null>(null);

  // 作业阈值
  const [urgentHours, setUrgentHours] = useState(24);
  // 提醒偏好
  const [courseReminder, setCourseReminder] = useState(true);
  const [examReminder1d, setExamReminder1d] = useState(true);
  const [examReminder2h, setExamReminder2h] = useState(true);
  const [examReminder30m, setExamReminder30m] = useState(true);
  // 下载目录
  const [downloadDir, setDownloadDir] = useState("~/Downloads/zju-agent");
  // 天气
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [weatherProvider, setWeatherProvider] = useState("wttr.in");

  function reload() {
    window.location.reload();
  }

  async function saveModel() {
    const res = await apiFetch("/api/settings/model-providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(model),
    });
    if (!res.ok) {
      setMessage("保存模型配置失败");
      return;
    }
    setModelOpen(false);
    setMessage("模型配置已保存");
    reload();
  }

  async function revalidate() {
    setMessage(null);
    try {
      const status = await validate.mutateAsync(undefined);
      setMessage(status.ok ? "ZJU 登录验证成功" : `验证失败：${status.message ?? ""}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "验证失败");
    }
  }

  async function doLogout() {
    await logout.mutateAsync();
    setMessage("已登出，凭据已清除");
    reload();
  }

  return (
    <Layout>
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-zju-primary">设置</h1>

        {message && (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
            {message}
          </div>
        )}

        {/* 模型 Provider */}
        <Section title="🤖 模型 Provider">
          <button
            onClick={() => setModelOpen((v) => !v)}
            className="rounded-md bg-zju-primary px-3 py-1.5 text-sm text-white hover:bg-zju-light"
          >
            {modelOpen ? "收起" : "新增 / 更新模型"}
          </button>
          {modelOpen && (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <Field label="名称">
                <input className="input" value={model.name} onChange={(e) => setModel({ ...model, name: e.target.value })} />
              </Field>
              <Field label="协议">
                <select className="input" value={model.protocol} onChange={(e) => setModel({ ...model, protocol: e.target.value as "openai" | "anthropic" })}>
                  <option value="openai">OpenAI 兼容</option>
                  <option value="anthropic">Anthropic 兼容</option>
                </select>
              </Field>
              <Field label="Base URL">
                <input className="input" value={model.baseUrl} onChange={(e) => setModel({ ...model, baseUrl: e.target.value })} />
              </Field>
              <Field label="API Key">
                <input className="input" type="password" value={model.apiKey} onChange={(e) => setModel({ ...model, apiKey: e.target.value })} />
              </Field>
              <Field label="模型">
                <input className="input" value={model.model} onChange={(e) => setModel({ ...model, model: e.target.value })} />
              </Field>
              <div className="flex items-end">
                <button onClick={saveModel} className="rounded-md bg-zju-primary px-4 py-2 text-sm text-white hover:bg-zju-light">
                  保存
                </button>
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-slate-400">
            API Key 仅保存在本机加密存储，不会出现在任何接口响应中。
          </p>
        </Section>

        {/* ZJU 账号 */}
        <Section title="🔐 ZJU 统一身份认证">
          <div className="flex flex-wrap gap-2">
            <button onClick={revalidate} disabled={validate.isPending} className="rounded-md bg-zju-primary px-3 py-1.5 text-sm text-white hover:bg-zju-light disabled:opacity-50">
              {validate.isPending ? "验证中…" : "重新验证登录"}
            </button>
            <button onClick={() => navigate("/setup")} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
              修改账号
            </button>
            <button onClick={doLogout} disabled={logout.isPending} className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50">
              {logout.isPending ? "登出中…" : "登出并清除凭据"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            登出将清除本机保存的 ZJU 密码与所有校园服务 session。
          </p>
        </Section>

        {/* 天气 Provider */}
        <Section title="🌤️ 天气 Provider">
          <button onClick={() => setWeatherOpen((v) => !v)} className="text-sm text-zju-primary hover:underline">
            {weatherOpen ? "收起" : "配置"}
          </button>
          {weatherOpen && (
            <div className="mt-3">
              <Field label="Provider">
                <select className="input" value={weatherProvider} onChange={(e) => setWeatherProvider(e.target.value)}>
                  <option value="wttr.in">wttr.in（免费公开）</option>
                  <option value="openweathermap">OpenWeatherMap（需 API Key）</option>
                </select>
              </Field>
              <p className="mt-2 text-xs text-slate-400">默认使用 wttr.in，无需额外配置。</p>
            </div>
          )}
        </Section>

        {/* 下载目录 */}
        <Section title="📁 下载目录">
          <Field label="资料保存路径">
            <input className="input" value={downloadDir} onChange={(e) => setDownloadDir(e.target.value)} />
          </Field>
          <p className="mt-2 text-xs text-slate-400">课程资料、课件等下载文件的默认保存位置。</p>
        </Section>

        {/* 作业分类阈值 */}
        <Section title="📝 作业分类阈值">
          <Field label={`将截止阈值：距截止 ≤ ${urgentHours} 小时`}>
            <input type="range" min={1} max={72} value={urgentHours} onChange={(e) => setUrgentHours(Number(e.target.value))} className="w-full accent-zju-primary" />
          </Field>
          <p className="text-xs text-slate-400">
            截止时间在此范围内的作业归为"将截止"，超出为"还不急"，已过截止时间为"已截止"。
          </p>
        </Section>

        {/* 提醒偏好 */}
        <Section title="🔔 提醒偏好">
          <div className="space-y-2">
            <Toggle label="课程开始前 15 分钟提醒" checked={courseReminder} onChange={setCourseReminder} />
            <Toggle label="考试前 1 天提醒" checked={examReminder1d} onChange={setExamReminder1d} />
            <Toggle label="考试前 2 小时提醒" checked={examReminder2h} onChange={setExamReminder2h} />
            <Toggle label="考试前 30 分钟提醒" checked={examReminder30m} onChange={setExamReminder30m} />
          </div>
          <p className="mt-2 text-xs text-slate-400">提醒功能将在后续版本通过系统通知实现。</p>
        </Section>

        {/* 权限策略 */}
        <Section title="🛡️ 权限策略">
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            <p className="font-medium mb-1">当前策略（默认）</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>查询类工具（课程/作业/考试/天气）→ 直接执行</li>
              <li>下载单个资料 → 可直接执行</li>
              <li>批量下载 → 必须确认</li>
              <li>作业提交 → 必须确认</li>
              <li>校网充值 → 必须确认</li>
            </ul>
          </div>
          <p className="mt-2 text-xs text-slate-400">高风险操作必须经过用户确认，防止 Agent 静默执行。</p>
        </Section>

        {/* 清除数据 */}
        <Section title="🗑️ 数据管理">
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50">
              清除本地缓存
            </button>
            <button className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50">
              清除会话历史
            </button>
            <button onClick={doLogout} className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50">
              清除所有凭据
            </button>
          </div>
        </Section>

        {/* 导出日志 */}
        <Section title="📋 导出日志">
          <button className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            导出审计日志
          </button>
          <p className="mt-2 text-xs text-slate-400">导出本地操作记录，不包含密码和 API Key。</p>
        </Section>
      </div>

      <style>{`
        .input { width: 100%; border-radius: 0.375rem; border: 1px solid rgb(203 213 225); padding: 0.5rem 0.75rem; font-size: 0.875rem; }
        .input:focus { border-color: #003f88; outline: none; }
      `}</style>
    </Layout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 font-semibold text-slate-800">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-zju-primary"
      />
      {label}
    </label>
  );
}
