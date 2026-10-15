import { useEffect, useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { Authorizer } from "@/lib/my-requests";

export type ChatTarget = { person: Authorizer; requestCode: string };

/** Local preview of the internal chat: messages live in memory until the chat backend exists. */
export function InternalChat({ target, onOpenChange }: { target: ChatTarget | null; onOpenChange: (open: boolean) => void }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  useEffect(() => { setMessages([]); setDraft(target ? `Hola, te escribo por la solicitud ${target.requestCode}.` : ""); }, [target]);
  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages([...messages, text]);
    setDraft("");
  };
  return (
    <Sheet open={target !== null} onOpenChange={onOpenChange}>
      <SheetContent className="chat-sheet">
        <SheetHeader className="chat-header">
          <div className="modal-eyebrow"><MessageSquare size={15} />CHAT INTERNO</div>
          <SheetTitle className="chat-title">{target?.person.name}</SheetTitle>
          <SheetDescription>{target?.person.role} · Autoriza {target?.requestCode}</SheetDescription>
        </SheetHeader>
        <div className="chat-messages" aria-live="polite">
          {messages.length === 0 ? <p className="chat-empty">Aún no hay mensajes en esta conversación.</p> : messages.map((message, index) => <p key={index} className="chat-bubble">{message}</p>)}
        </div>
        <form className="chat-composer" onSubmit={event => { event.preventDefault(); send(); }}>
          <Input aria-label="Mensaje" placeholder="Escribe un mensaje" maxLength={1000} value={draft} onChange={event => setDraft(event.target.value)} />
          <Button type="submit" size="icon" aria-label="Enviar mensaje" disabled={!draft.trim()}><Send /></Button>
        </form>
        <p className="chat-note">Vista previa: los mensajes aún no se envían al destinatario.</p>
      </SheetContent>
    </Sheet>
  );
}
