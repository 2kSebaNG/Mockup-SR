import type { ReactNode } from "react";

export type Description = { term: ReactNode; detail: ReactNode };

/** Label → value pairs of a detail page; the label goes above the value on phones. */
export function DescriptionList({ items }: { items: Description[] }) {
  return (
    <dl className="ds-dl">
      {items.map((item, index) => (
        <div key={index}>
          <dt>{item.term}</dt>
          <dd>{item.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
