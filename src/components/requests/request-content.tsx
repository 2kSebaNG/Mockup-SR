import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { NoveltyTag } from "@/components/requests/classification-review";
import { formatDate } from "@/components/requests/request-list";
import { itemKey, type ProposalReview } from "@/lib/catalog";
import type { MyRequest } from "@/lib/my-requests";

type Box = { label: string; value: string; tags?: ReactNode };

/** Tags for what in this box is new to the catalog: the type, the select itself, or the option chosen in it. */
function noveltyTags(review: ProposalReview | undefined, field: { label: string; value: string } | "type" | "element"): ReactNode {
  if (!review) return null;
  const find = (key: string) => review.items.find(item => item.key === key);
  if (field === "element") {
    const element = find(itemKey.element());
    return element && <NoveltyTag status={element.status} pendingLabel="Elemento nuevo" as={element.as} />;
  }
  if (field === "type") {
    const type = find(itemKey.type());
    return type && <NoveltyTag status={type.status} pendingLabel="Categoría nueva" as={type.as} />;
  }
  const select = find(itemKey.field(field.label));
  const link = find(itemKey.link(field.label));
  const option = find(itemKey.option(field.label, field.value));
  if (!select && !link && !option) return null;
  return <>
    {select && <NoveltyTag status={select.status} pendingLabel="Select nuevo" as={select.as} />}
    {link && <NoveltyTag status={link.status} pendingLabel="Por asociar a la categoría" />}
    {option && <NoveltyTag status={option.status} pendingLabel="Opción nueva" as={option.as} />}
  </>;
}

function FieldGrid({ request, review }: { request: MyRequest; review?: ProposalReview | undefined }) {
  const unit = request.fields.find(field => field.label.toLowerCase() === "unidad");
  const boxes: Box[] = [
    { label: "Categoría", value: request.category, tags: noveltyTags(review, "type") },
    ...(request.element ? [{ label: request.elementLabel, value: request.element, tags: noveltyTags(review, "element") }] : []),
    { label: "Cantidad", value: String(request.quantity) },
    { label: "Unidad", value: request.unit, tags: unit && noveltyTags(review, unit) },
    { label: "Fecha límite", value: formatDate(request.dueDate) },
    ...request.fields.filter(field => field.label.toLowerCase() !== "unidad").map(field => ({ ...field, tags: noveltyTags(review, field) })),
  ];
  return (
    <dl className="request-fields">
      {boxes.map(box => <div key={box.label} className={box.tags ? "has-novelty" : undefined}><dt>{box.label}</dt><dd>{box.value}</dd>{box.tags && <div className="novelty-tags">{box.tags}</div>}</div>)}
    </dl>
  );
}

/**
 * What was asked, shown the way it was written: either the fields chosen in "Nueva solicitud",
 * or the free-text description followed by the fields the AI interpreted from it.
 * With `review` (contract administrator), anything new to the catalog is tagged where it appears.
 */
export function RequestContent({ request, review }: { request: MyRequest; review?: ProposalReview | null }) {
  const novelties = review ?? undefined;
  if (request.aiAssisted && request.description) {
    return (
      <div className="request-content">
        <h3 className="request-content-heading">Requerimiento escrito</h3>
        <blockquote className="request-quote">{request.description}</blockquote>
        <h3 className="request-content-heading ai-heading">Interpretación de IA <Sparkles aria-hidden="true" /></h3>
        <FieldGrid request={request} review={novelties} />
      </div>
    );
  }
  return (
    <div className="request-content">
      <h3 className="request-content-heading">Detalle del requerimiento</h3>
      <FieldGrid request={request} review={novelties} />
      {request.description && <><h3 className="request-content-heading">Comentario</h3><blockquote className="request-quote">{request.description}</blockquote></>}
    </div>
  );
}
