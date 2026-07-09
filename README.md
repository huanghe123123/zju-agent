# zju-agent

浙大校园智能助手。第一版目标是 Windows 桌面软件，聚焦：

- 学在浙大 DDL 查看
- 智云课堂课程列表、直播入口、回放、资料
- 课程表、课程提醒、考试提醒
- 学在浙大课程文件下载

## 开发

```sh
pnpm install
pnpm run dev
```

## 打包便携版 exe

```sh
pnpm run package:portable
```

输出文件在 `release/ZJU-Agent-0.1.0-portable.exe`。

当前应用使用 mock 数据跑通桌面端体验。真实接口接入见 `docs/packet-capture-guide.md` 和 `docs/integration-plan.md`。
