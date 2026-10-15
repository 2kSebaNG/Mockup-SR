import { useState } from "react";
import { ClipboardList, FilePlus2, MessageSquare, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RequirementModal } from "@/components/requirement-modal";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

export function QuickAccess() {
  const [open, setOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  return (
    <div className="quick-access">
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="floating" size="floating" aria-label="Accesos directos" title="Accesos directos" className="quick-access-trigger">
            <Plus strokeWidth={1.8} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={16} className="quick-access-menu">
          <DropdownMenuLabel className="quick-access-label">Solicitud de Requerimientos</DropdownMenuLabel>
          <DropdownMenuSeparator className="quick-access-divider" />
          <DropdownMenuItem className="quick-access-item" onSelect={() => setRequestOpen(true)}><FilePlus2 /><span>Nueva solicitud</span><ChevronRight className="ml-auto" /></DropdownMenuItem>
          <DropdownMenuSeparator className="quick-access-divider" />
          <DropdownMenuItem className="quick-access-item"><ClipboardList /><span>Mis solicitudes</span><ChevronRight className="ml-auto" /></DropdownMenuItem>
          <DropdownMenuSeparator className="quick-access-divider" />
          <DropdownMenuItem className="quick-access-item"><MessageSquare /><span>Chat Interno</span><ChevronRight className="ml-auto" /></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RequirementModal open={requestOpen} onOpenChange={setRequestOpen} />
    </div>
  );
}