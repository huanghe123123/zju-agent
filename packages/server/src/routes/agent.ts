/**
 * Agent 路由。
 * 见 ZJU_CAMPUS_AGENT_PROJECT.md 第 10.2 节。
 *
 * 路由：
 *   POST   /api/agent/chat
 *          body: { conversationId?, message }
 *          → text/event-stream，逐事件推送
 *   POST   /api/agent/confirm
 *          body: { confirmationId, decision: "approve" | "reject" }
 *          → text/event-stream，继续 loop
 *   GET    /api/agent/conversations       — 列表
 *   GET    /api/agent/conversations/:id   — 会话 + 消息历史
 *   DELETE /api/agent/conversations/:id   — 删除
 *
 * SSE 事件用 AgentStreamEvent 序列化，每条一行 `data: <json>\n\n`。
 */

import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { ok, wrap, AppError, ErrorCode } from "@zju-agent/core";
import type { AgentStreamEvent, AgentMessage } from "@zju-agent/core";
import type { ServicesContainer } from "../services.js";
import type { ServerConfig } from "../config/env.js";
import { AgentLoop } from "../agent/loop.js";
import { recordToMessage } from "../storage/conversations.js";
import { logger } from "../config/logger.js";

export function agentRoutes(
  deps: ServicesContainer & { config: ServerConfig },
): FastifyPluginAsync {
  return async (app) => {
    // --- 发起对话 ---
    app.post<{
      Body: { conversationId?: string; message?: string };
    }>("/chat", async (req, reply) => {
      const body = req.body ?? {};
      const message = (body.message ?? "").trim();
      if (!message) {
        return failBody(reply, 400, ErrorCode.TOOL_INPUT_INVALID, "消息不能为空。");
      }

      // 取或创建会话
      let conv = body.conversationId
        ? deps.conversations.get(body.conversationId)
        : null;
      if (!conv) {
        conv = deps.conversations.create(message.slice(0, 30));
      }

      // 加载历史消息
      const history = deps.conversations
        .listMessages(conv.id)
        .map((r) => recordToMessage(r));

      // 追加本轮 user 消息
      const userMsg: AgentMessage = { role: "user", content: message };
      deps.conversations.appendMessage(conv.id, userMsg);
      history.push(userMsg);

      return streamAgentRun(deps, reply, conv.id, history, (loop, cb) =>
        loop.run(history, cb),
      );
    });

    // --- 确认 / 拒绝 ---
    app.post<{
      Body: { confirmationId?: string; decision?: "approve" | "reject" };
    }>("/confirm", async (req, reply) => {
      const body = req.body ?? {};
      const { confirmationId, decision } = body;
      if (!confirmationId || !decision) {
        return failBody(
          reply,
          400,
          ErrorCode.TOOL_INPUT_INVALID,
          "缺少 confirmationId 或 decision。",
        );
      }
      const stored = deps.confirmations.get(confirmationId);
      if (!stored) {
        return failBody(
          reply,
          404,
          ErrorCode.TOOL_CONFIRMATION_EXPIRED,
          "该确认已过期或不存在。",
        );
      }
      const conv = deps.conversations.get(stored.conversationId);
      if (!conv) {
        return failBody(reply, 404, ErrorCode.UNKNOWN_ERROR, "会话不存在。");
      }
      const history = deps.conversations
        .listMessages(conv.id)
        .map((r) => recordToMessage(r));

      return streamAgentRun(deps, reply, conv.id, history, (loop, cb) =>
        decision === "approve"
          ? loop.resumeAfterConfirm(confirmationId, history, cb)
          : loop.resumeAfterReject(confirmationId, history, cb),
      );
    });

    // --- 会话列表 ---
    app.get("/conversations", async () => {
      return ok(deps.conversations.list());
    });

    // --- 会话详情（含消息历史） ---
    app.get<{ Params: { id: string } }>("/conversations/:id", async (req) => {
      return wrap(async () => {
        const conv = deps.conversations.get(req.params.id);
        if (!conv) {
          throw new AppError(ErrorCode.UNKNOWN_ERROR, "会话不存在。", {
            retryable: false,
          });
        }
        const messages = deps.conversations.listMessages(conv.id);
        return { ...conv, messages };
      });
    });

    // --- 删除会话 ---
    app.delete<{ Params: { id: string } }>("/conversations/:id", async (req) => {
      return wrap(async () => {
        deps.conversations.delete(req.params.id);
        return { ok: true };
      });
    });
  };
}

/** 把 AgentStreamEvent 通过 SSE 推给前端 */
async function streamAgentRun(
  deps: ServicesContainer & { config: ServerConfig },
  reply: FastifyReply,
  conversationId: string,
  _history: AgentMessage[],
  run: (
    loop: AgentLoop,
    cb: AgentLoopCallbacks,
  ) => Promise<{ paused: boolean; confirmationId: string | null }>,
) {
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.flushHeaders?.();

  const send = (event: AgentStreamEvent) => {
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const loop = new AgentLoop(deps);
  loop.setConversationId(conversationId);

  const cb: AgentLoopCallbacks = {
    emit: send,
    persist: (msg: AgentMessage) => {
      deps.conversations.appendMessage(conversationId, msg);
    },
  };

  try {
    const result = await run(loop, cb);
    // 结束事件
    reply.raw.write(
      `data: ${JSON.stringify({
        type: "done",
        paused: result.paused,
        confirmationId: result.confirmationId,
        conversationId,
      } as DoneEvent)}\n\n`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent 运行失败";
    logger.warn("Agent loop 失败", { conversationId, message });
    reply.raw.write(
      `data: ${JSON.stringify({
        type: "error",
        code: "UNKNOWN_ERROR",
        message,
      } as AgentStreamEvent)}\n\n`,
    );
  } finally {
    reply.raw.end();
  }
}

function failBody(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
) {
  reply.code(status).send({ ok: false, error: { code, message, retryable: false } });
}

type DoneEvent = {
  type: "done";
  paused: boolean;
  confirmationId: string | null;
  conversationId: string;
};

type AgentLoopCallbacks = {
  emit(event: AgentStreamEvent): void;
  persist(msg: AgentMessage): void;
};
