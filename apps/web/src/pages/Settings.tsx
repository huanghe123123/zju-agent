import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

  async function reloadSettings() {
    // 触发重新拉取（Settings 页改用 query 更直观，这里做最小改动：刷新页面 query）
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
    void reloadSettings();
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
    void reloadSettings();
  }

  return (
    <div className="space-y-4">
      <h1 className="mb-2 text-2xl font-bold text-zju-primary">设置</h1>

      {message && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          {message}
        </div>
      )}

      <Section title="模型 Provider">
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
          提示：API Key 仅保存在本机加密存储，不会出现在任何接口响应中。
        </p>
      </Section>

      <Section title="ZJU 账号">
        <div className="flex gap-2">
          <button
            onClick={revalidate}
            disabled={validate.isPending}
            className="rounded-md bg-zju-primary px-3 py-1.5 text-sm text-white hover:bg-zju-light disabled:opacity-50"
          >
            {validate.isPending ? "验证中…" : "重新验证登录"}
          </button>
          <button
            onClick={() => navigate("/setup")}
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            修改账号
          </button>
          <button
            onClick={doLogout}
            disabled={logout.isPending}
            className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            {logout.isPending ? "登出中…" : "登出并清除凭据"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          登出将清除本机保存的 ZJU 密码与所有校园服务 session。
        </p>
      </Section>

      <style>{`
        .input { width: 100%; border-radius: 0.375rem; border: 1px solid rgb(203 213 225); padding: 0.5rem 0.75rem; font-size: 0.875rem; }
        .input:focus { border-color: #003f88; outline: none; }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-600">{label}</span>
      {children}
    </label>
  );
}

// 引用避免类型未使用告警
