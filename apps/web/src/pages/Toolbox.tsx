import { Link } from "react-router-dom";
import { Layout } from "../components/Layout.js";

const CARDS = [
  {
    title: "智云课堂",
    description: "查看课堂资源、下载课件和语音转文字",
    icon: "🎓",
    to: null,
    available: false,
  },
  {
    title: "天气查询",
    description: "查询当前天气与未来预报，默认杭州",
    icon: "🌤️",
    to: null,
    available: true,
    hint: "可在 AI 助手中询问天气",
  },
  {
    title: "校网充值",
    description: "查询校网状态、余额、发起充值",
    icon: "💳",
    to: null,
    available: false,
  },
  {
    title: "CC98 论坛",
    description: "浏览 CC98 帖子（后续版本接入）",
    icon: "💬",
    to: null,
    available: false,
  },
  {
    title: "图书馆座位",
    description: "预约图书馆座位（后续版本接入）",
    icon: "📖",
    to: null,
    available: false,
  },
  {
    title: "ETA 成绩",
    description: "查看成绩与 GPA（后续版本接入）",
    icon: "📊",
    to: null,
    available: false,
  },
];

export function ToolboxPage() {
  return (
    <Layout>
      <h1 className="mb-4 text-2xl font-bold text-zju-primary">百宝箱</h1>
      <p className="mb-6 text-sm text-slate-500">
        拓展功能与可选模块，点击卡片进入对应功能。
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((card) => (
          <Card key={card.title} {...card} />
        ))}
      </div>
    </Layout>
  );
}

function Card({
  title,
  description,
  icon,
  to,
  available,
  hint,
}: {
  title: string;
  description: string;
  icon: string;
  to: string | null;
  available: boolean;
  hint?: string;
}) {
  const body = (
    <div
      className={`rounded-lg border p-4 shadow-sm transition ${
        available
          ? to
            ? "border-slate-200 bg-white hover:border-zju-primary hover:shadow-md"
            : "border-slate-200 bg-white"
          : "border-dashed border-slate-200 bg-slate-50/50"
      }`}
    >
      <div className="mb-2 text-2xl">{icon}</div>
      <h3 className="mb-1 text-sm font-semibold text-slate-800">
        {title}
        {!available && (
          <span className="ml-1.5 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-normal text-slate-500">
            即将推出
          </span>
        )}
      </h3>
      <p className="text-xs text-slate-500">{description}</p>
      {hint && (
        <p className="mt-1.5 text-[11px] text-slate-400">{hint}</p>
      )}
      {available && to && (
        <span className="mt-2 inline-block text-[11px] font-medium text-zju-primary">
          进入 →
        </span>
      )}
    </div>
  );

  if (to && available) {
    return <Link to={to}>{body}</Link>;
  }
  return body;
}
