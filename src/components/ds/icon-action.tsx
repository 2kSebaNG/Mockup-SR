import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * A row action: a ghost icon button whose tooltip says what it does. Disabled, it stays visible and focusable and
 * the tooltip says why (`reason`), so people learn what blocks it. With `asChild` the child (a router `Link`) is
 * the control. Needs a `TooltipProvider` above (AppShell pages have one).
 */
export function IconAction({ label, reason, disabled = false, danger = false, asChild = false, onClick, children }: {
  label: string; reason?: string | null | undefined; disabled?: boolean; danger?: boolean; asChild?: boolean;
  onClick?: ComponentProps<"button">["onClick"]; children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* The wrapper keeps the tooltip reachable when the button is disabled. */}
        <span tabIndex={disabled ? 0 : -1} className="ds-icon-action-wrap">
          <Button variant="ghost" size="icon" asChild={asChild} className={cn("ds-icon-action", danger && "ds-icon-action--danger")} aria-label={label} disabled={disabled} onClick={onClick}>
            {children}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{disabled && reason ? reason : label}</TooltipContent>
    </Tooltip>
  );
}

/** Icon actions side by side, aligned to the end of the row. */
export function Actions({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("ds-actions", className)} {...props} />;
}
