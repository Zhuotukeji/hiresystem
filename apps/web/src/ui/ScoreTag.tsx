import { Tag } from "antd";

export function ScoreTag({ level, score }: { level?: string; score?: number }) {
  const color = level === "green" ? "success" : level === "yellow" ? "warning" : level === "red" ? "error" : "default";
  const label = level === "green" ? "绿色" : level === "yellow" ? "黄色" : level === "red" ? "红色" : "待判断";
  return <Tag color={color}>{score ?? "--"} / {label}</Tag>;
}
