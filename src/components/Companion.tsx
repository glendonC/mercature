import { BotAvatar } from "bot-avatars";
import { useState, type ReactNode } from "react";
import { useLanguage } from "../i18n";

/** The guide's one colour on every screen: the neutral field grey of the design tokens. */
export const guideColor = () => getComputedStyle(document.documentElement).getPropertyValue("--field").trim() || "gray";

/** The guide itself: the same grey blob wherever it appears. working: busy while a real promise runs. */
export function GuideAvatar({ size, working = false }: { size: number; working?: boolean }) {
  const [color] = useState(guideColor);
  return (
    <BotAvatar
      type="blob"
      state={working ? "working" : "default"}
      size={size}
      color={color}
      shading="plastic"
      speed={0.4}
      turn={0.25}
      jumpEvery={0}
      interactive={false}
      saturation={1}
      theme="light"
    />
  );
}

export default function Companion({
  children,
  working = false,
}: {
  children: ReactNode;
  working?: boolean;
  /** The screen's mode. The guide looks the same in every mode. */
  tone?: "guide" | "evidence" | "review";
}) {
  const { t } = useLanguage();
  return (
    <aside className="companion" aria-label={t("guide.place")}>
      <span aria-hidden="true">
        <GuideAvatar size={64} working={working} />
      </span>
      <p>{children}</p>
    </aside>
  );
}
