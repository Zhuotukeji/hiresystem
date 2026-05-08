import { ReactNode } from "react";

export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {desc ? <div className="muted">{desc}</div> : null}
      </div>
      {actions}
    </div>
  );
}
