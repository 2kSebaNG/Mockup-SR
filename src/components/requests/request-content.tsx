import { Sparkles } from "lucide-react";
import { formatDate } from "@/components/requests/request-list";
import type { MyRequest } from "@/lib/my-requests";

function FieldGrid({ request }: { request: MyRequest }) {
  const fields = [
    { label: "Categoría", value: request.category },
    { label: "Cantidad", value: String(request.quantity) },
    { label: "Unidad", value: request.unit },
    { label: "Fecha límite", value: formatDate(request.dueDate) },
    ...request.fields.filter(field => field.label.toLowerCase() !== "unidad"),
  ];
  return (
    <dl className="request-fields">
      {fields.map(field => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}
    </dl>
  );
}

/**
 * What was asked, shown the way it was written: either the fields chosen in "Nueva solicitud",
 * or the free-text description followed by the fields the AI interpreted from it.
 */
export function RequestContent({ request }: { request: MyRequest }) {
  if (request.aiAssisted && request.description) {
    return (
      <div className="request-content">
        <h3 className="request-content-heading">Requerimiento escrito</h3>
        <blockquote className="request-quote">{request.description}</blockquote>
        <h3 className="request-content-heading ai-heading">Interpretación de IA <Sparkles aria-hidden="true" /></h3>
        <FieldGrid request={request} />
      </div>
    );
  }
  return (
    <div className="request-content">
      <h3 className="request-content-heading">Detalle del requerimiento</h3>
      <FieldGrid request={request} />
      {request.description && <><h3 className="request-content-heading">Comentario</h3><blockquote className="request-quote">{request.description}</blockquote></>}
    </div>
  );
}
