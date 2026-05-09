import { Alert, Button, Card, Input, Typography, message } from "antd";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { canStartAiJobGeneration, formatJdPreview, JdAssistantResult } from "../domain/aiJob";

type AiJdAssistantProps = {
  jobId?: string;
  initialJd?: string;
  defaultPrompt?: string;
  cardTitle?: string;
  buttonText?: string;
  prepareJob?: (prompt: string) => Promise<{ jobId: string }>;
  onSaved?: (payload: { jobId: string; result: JdAssistantResult; jdText: string }) => void;
};

type JdChatResponse = {
  result: JdAssistantResult;
};

export function AiJdAssistant({
  jobId,
  initialJd,
  defaultPrompt = "",
  cardTitle = "和 AI 说明岗位需求",
  buttonText = "生成并保存 JD",
  prepareJob,
  onSaved
}: AiJdAssistantProps) {
  const [sessionId, setSessionId] = useState<string>();
  const [preparedJobId, setPreparedJobId] = useState<string>();
  const [content, setContent] = useState(defaultPrompt);
  const [resultText, setResultText] = useState(initialJd ?? "");
  const [errorText, setErrorText] = useState<string>();

  const createSession = useMutation({
    mutationFn: (targetJobId: string) => api.post<{ id: string }>("/ai/jd-chat/sessions", { jobId: targetJobId })
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      setErrorText(undefined);
      const targetJobId = jobId ?? preparedJobId ?? (await prepareJob?.(content))?.jobId;
      if (!targetJobId) {
        throw new Error("请先创建岗位草稿");
      }
      if (!preparedJobId && !jobId) {
        setPreparedJobId(targetJobId);
      }

      const activeSessionId = sessionId ?? (await createSession.mutateAsync(targetJobId)).id;
      setSessionId(activeSessionId);
      return {
        jobId: targetJobId,
        response: await api.post<JdChatResponse>(`/ai/jd-chat/${activeSessionId}/messages`, {
          content,
          saveToJobId: targetJobId
        })
      };
    },
    onSuccess: ({ jobId: savedJobId, response }) => {
      const jdText = formatJdPreview(response.result);
      setResultText(jdText);
      setContent("");
      message.success("AI JD 已生成并保存到岗位");
      onSaved?.({ jobId: savedJobId, result: response.result, jdText });
    },
    onError: (error) => {
      const text = error instanceof Error ? error.message : "AI JD 生成失败";
      setErrorText(text);
      message.error(text);
    }
  });

  const canGenerate = canStartAiJobGeneration({ prompt: content, isPending: sendMessage.isPending });

  return (
    <div className="grid grid-2">
      <Card title={cardTitle}>
        {errorText ? <Alert type="error" showIcon message={errorText} style={{ marginBottom: 12 }} /> : null}
        <Input.TextArea
          rows={10}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="例如：我们要招 HRBP，负责支持业务团队组织发展、人才盘点、绩效落地和管理者辅导，上海，薪资面议..."
        />
        <Button
          type="primary"
          style={{ marginTop: 12 }}
          loading={sendMessage.isPending}
          disabled={!canGenerate}
          onClick={() => sendMessage.mutate()}
        >
          {buttonText}
        </Button>
      </Card>
      <Card title="JD 预览">
        <Typography.Paragraph style={{ whiteSpace: "pre-wrap" }}>{resultText || "暂无内容"}</Typography.Paragraph>
      </Card>
    </div>
  );
}
