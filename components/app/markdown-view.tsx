import type { ReactNode } from "react";

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const len = text.length;
  while (i < len) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        nodes.push(
          <strong key={key++} className="font-semibold text-[var(--color-fg)]">
            {text.slice(i + 2, end)}
          </strong>,
        );
        i = end + 2;
        continue;
      }
    }
    if (text[i] === "*" && text[i + 1] !== " ") {
      const end = text.indexOf("*", i + 1);
      if (end !== -1 && text[end - 1] !== " ") {
        nodes.push(
          <em key={key++} className="italic">
            {text.slice(i + 1, end)}
          </em>,
        );
        i = end + 1;
        continue;
      }
    }
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end !== -1) {
        nodes.push(
          <code
            key={key++}
            className="rounded bg-[var(--color-bg-muted)] px-1 py-0.5 font-mono text-[0.85em]"
          >
            {text.slice(i + 1, end)}
          </code>,
        );
        i = end + 1;
        continue;
      }
    }
    let next = i + 1;
    while (next < len && text[next] !== "*" && text[next] !== "`") next++;
    nodes.push(text.slice(i, next));
    i = next;
  }
  return nodes;
}

interface Block {
  type: "h1" | "h2" | "h3" | "p" | "ul" | "ol";
  items?: string[];
  text?: string;
}

function toBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: "p", text: para.join(" ").trim() });
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ type: list.type, items: list.items });
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      blocks.push({ type: `h${h[1].length}` as "h1" | "h2" | "h3", text: h[2] });
      continue;
    }
    const ul = /^[-*•]\s+(.*)$/.exec(line);
    if (ul) {
      flushPara();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(ul[1]);
      continue;
    }
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    if (ol) {
      flushPara();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(ol[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

export function MarkdownView({ source, className }: { source: string; className?: string }) {
  const blocks = toBlocks(source);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.type === "h1")
          return (
            <h2 key={i} className="mt-3 mb-2 text-base font-semibold tracking-tight first:mt-0">
              {renderInline(b.text ?? "")}
            </h2>
          );
        if (b.type === "h2")
          return (
            <h3 key={i} className="mt-3 mb-1.5 text-sm font-semibold tracking-tight first:mt-0">
              {renderInline(b.text ?? "")}
            </h3>
          );
        if (b.type === "h3")
          return (
            <h4 key={i} className="mt-2 mb-1 text-sm font-semibold first:mt-0">
              {renderInline(b.text ?? "")}
            </h4>
          );
        if (b.type === "ul")
          return (
            <ul key={i} className="my-2 ml-5 list-disc space-y-1">
              {b.items?.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ul>
          );
        if (b.type === "ol")
          return (
            <ol key={i} className="my-2 ml-5 list-decimal space-y-1">
              {b.items?.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ol>
          );
        return (
          <p key={i} className="my-2 first:mt-0 last:mb-0">
            {renderInline(b.text ?? "")}
          </p>
        );
      })}
    </div>
  );
}
