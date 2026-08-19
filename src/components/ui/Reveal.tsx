"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Blendet Inhalte beim Scrollen ein. Bewusst ohne Animations-Bibliothek:
 * ein IntersectionObserver plus CSS-Keyframes hält das Bundle klein.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      // @ts-expect-error – ref-Typ variiert je nach Tag, Verhalten ist identisch
      ref={ref}
      className={`reveal ${className}`}
      data-visible={visible ? "true" : "false"}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
