import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A list and the detail of what is picked in it, side by side (a queue of orders to decide). Narrow, it shows one at
 * a time: the list, or the detail when `open` with a button back to the list (`onBack`). It measures itself, not the
 * window.
 */
export function MasterDetail({ label, list, detail, open, onBack, backLabel = "Volver a la lista" }: {
  label: string; list: ReactNode; detail: ReactNode; open: boolean; onBack: () => void; backLabel?: string;
}) {
  return (
    <div className="ds-master-detail" data-open={open} aria-label={label} role="region">
      <div className="ds-master-detail-list">{list}</div>
      <div className="ds-master-detail-detail">
        <Button variant="ghost" size="sm" className="ds-master-detail-back" onClick={onBack}><ArrowLeft />{backLabel}</Button>
        {detail}
      </div>
    </div>
  );
}
