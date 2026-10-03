import { BotAvatar } from "bot-avatars";
import type { ReactNode } from "react";
export default function Companion({
  children,
  working = false,
  tone = "guide",
}: {
  children: ReactNode;
  working?: boolean;
  tone?: "guide" | "evidence" | "review";
}) {
  return (
    <aside className="companion" aria-label="Place guide">
      <span aria-hidden="true">
        <BotAvatar
          type={tone === "evidence" ? "clover" : "blob"}
          state={working ? "working" : "default"}
          size={64}
          color={tone === "evidence" ? "#b6cfa3" : tone === "review" ? "#dcb8a1" : "#a4c7d7"}
          shading="plastic"
          speed={0.4}
          turn={0.25}
          jumpEvery={0}
          interactive={false}
          saturation={1}
          theme="light"
        />
      </span>
      <p>{children}</p>
    </aside>
  );
}
