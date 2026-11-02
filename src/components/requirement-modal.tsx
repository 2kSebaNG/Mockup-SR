import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Wand2, Loader2, Check, FilePlus2, Save, Send, Hourglass, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { aiInputSchema, MAX_REQUEST_ITEMS, type AiItem, type RequirementField } from "@/lib/requirements";
import { ElementInput } from "@/components/requests/element-input";
import { defaultCatalog, diffAgainstCatalog, elementLabelFor, fieldsForCategory, findCategory, findField, hasClassificationChanges, hasOptionChanges, uniqueValues, type Catalog } from "@/lib/catalog";
import { describeRequirement } from "@/lib/requirements-ai.functions";
import { requestInputSchema, requestPackageSchema, responsibleFor, todayIso, type MyRequest } from "@/lib/my-requests";
import { createMyRequests, getCatalog, updateMyRequest } from "@/lib/requests.functions";

const required = <span className="required-mark" aria-hidden="true">*</span>;

function FieldSelect({ field, disabled, onChange, onRemove }: { field: RequirementField; disabled: boolean; onChange: (field: RequirementField) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [option, setOption] = useState("");
  const addOption = () => {
    const value = option.trim();
    if (!value || field.options.length >= 30) return;
    onChange({ ...field, value, options: [...new Set([...field.options, value])] });
    setOption(""); setEditing(false);
  };
  return <div className="requirement-field">
    <div className="field-label-row"><label id={`label-${field.id}`}>{field.label}</label><Button type="button" variant="ghost" size="icon" disabled={disabled} onClick={onRemove} aria-label={`Quitar ${field.label}`} title={`Quitar ${field.label}`} className="field-small-button"><Trash2 /></Button></div>
    <div className="field-control-row"><Select value={field.value} onValueChange={value => onChange({ ...field, value })} disabled={disabled}><SelectTrigger aria-labelledby={`label-${field.id}`} className="requirement-control"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{field.options.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" size="icon" disabled={disabled} className="field-add-button" aria-label={`Añadir opción a ${field.label}`} title="Añadir opción" onClick={() => setEditing(!editing)}><Plus /></Button></div>
    {editing && <div className="option-editor"><Input autoFocus aria-label={`Nueva opción de ${field.label}`} placeholder="Nueva opción" maxLength={100} value={option} onChange={e => setOption(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }} /><Button type="button" size="icon" onClick={addOption} disabled={!option.trim()} aria-label="Confirmar opción"><Check /></Button></div>}
  </div>;
}

/** The request's attributes, with the catalog's options plus any the requester had proposed for each. */
function fieldsFromRequest(request: MyRequest, catalog: Catalog): RequirementField[] {
  const proposed = request.proposal?.fields ?? request.fields.map(field => ({ ...field, options: [] }));
  return proposed.map((field, index) => {
    const pooled = findField(catalog, field.label);
    return { id: pooled?.id ?? `edit-${index}`, label: field.label, value: field.value, options: uniqueValues([...(pooled?.options ?? []), ...field.options, field.value]) };
  });
}

/** Tells the requester what will wait for the contract administrator's approval before entering the catalog. */
function PendingCatalogNotice({ catalog, category, fields, element }: { catalog: Catalog; category: string; fields: RequirementField[]; element: { label: string; value: string; known: boolean | null } }) {
  if (!category.trim()) return null;
  const diff = diffAgainstCatalog(catalog, category, fields);
  const newElement = element.known === false && element.value.trim().length >= 2;
  if (!hasClassificationChanges(diff) && !hasOptionChanges(diff) && !newElement) return null;
  const linkedExisting = diff.newCategory ? [] : diff.links.filter(label => !diff.newFields.some(field => field.label === label));
  const items = [
    diff.newCategory && `categoría nueva «${diff.category}»`,
    newElement && `${element.label.toLowerCase()} nuevo «${element.value.trim()}»`,
    diff.newFields.length > 0 && `${diff.newFields.length === 1 ? "atributo nuevo" : "atributos nuevos"}: ${diff.newFields.map(field => field.label).join(", ")}`,
    linkedExisting.length > 0 && `atributos agregados a ${diff.category}: ${linkedExisting.join(", ")}`,
    ...diff.newOptions.map(change => `${change.options.length === 1 ? "opción nueva" : "opciones nuevas"} en ${change.field}: ${change.options.join(", ")}`),
  ].filter(Boolean);
  return <p role="status" className="catalog-pending-notice"><Hourglass size={16} /><span><strong>Pendiente de aprobación:</strong> {items.join("; ")}. Se envía igual; el Administrador de Contrato decidirá si esta clasificación se agrega al catálogo.</span></p>;
}

/** One item of the request as the form edits it; on save each item becomes its own request. */
type ItemDraft = { id: string; type: string; customType: string; element: string; elementKnown: boolean | null; quantity: string; fields: RequirementField[]; fromAi: boolean };

const newItem = (): ItemDraft => ({ id: crypto.randomUUID(), type: "", customType: "", element: "", elementKnown: null, quantity: "", fields: [], fromAi: false });
const categoryOf = (item: ItemDraft) => item.type === "Personalizada" ? item.customType : item.type;

function draftFromRequest(request: MyRequest, catalog: Catalog): ItemDraft {
  const known = findCategory(catalog, request.category);
  return { id: request.code, type: known ? known.name : "Personalizada", customType: known ? "" : request.category, element: request.element, elementKnown: null, quantity: String(request.quantity), fields: fieldsFromRequest(request, catalog), fromAi: false };
}

/** Merges what the AI read for one item into the draft at the same position, keeping options the requester had added. */
function draftFromAi(result: AiItem, current: ItemDraft | undefined, catalog: Catalog): ItemDraft {
  const base = current ?? newItem();
  const knownCategory = findCategory(catalog, result.category);
  const fields = result.fields.map((f, index) => {
    const existing = base.fields.find(old => old.label.toLowerCase() === f.label.toLowerCase());
    const pooled = findField(catalog, f.label);
    return { ...f, id: existing?.id ?? pooled?.id ?? `ai-${index}-${crypto.randomUUID()}`, options: [...new Set([...(existing?.options ?? []), ...f.options])].slice(0, 30), value: f.value || existing?.value || "" };
  });
  return {
    ...base,
    type: knownCategory ? knownCategory.name : "Personalizada",
    customType: knownCategory ? "" : result.category,
    element: result.element ?? base.element,
    quantity: result.quantity !== null ? String(result.quantity) : base.quantity,
    fields: [...fields, ...base.fields.filter(f => !fields.some(g => g.label.toLowerCase() === f.label.toLowerCase()))].slice(0, 16),
    fromAi: true,
  };
}

/** Category, element, quantity and attributes of one item. */
function ItemEditor({ item, index, count, catalog, busy, onChange, onRemove }: { item: ItemDraft; index: number; count: number; catalog: Catalog; busy: boolean; onChange: (patch: Partial<ItemDraft>) => void; onRemove: () => void }) {
  const [fieldName, setFieldName] = useState("");
  const [fieldOptions, setFieldOptions] = useState("");
  const [addingField, setAddingField] = useState(false);
  const [error, setError] = useState("");
  const categoryName = categoryOf(item);
  const elementLabel = elementLabelFor(catalog, categoryName);
  const prefix = `item-${item.id}`;
  const title = count > 1 ? `Requerimiento ${index + 1}` : "Requerimiento";
  const changeType = (value: string) => onChange({ type: value, fields: fieldsForCategory(catalog, value), element: "", elementKnown: null, fromAi: false });
  const addPoolField = (id: string) => {
    const field = catalog.fields.find(f => f.id === id);
    if (field && !item.fields.some(f => f.label.toLowerCase() === field.label.toLowerCase()) && item.fields.length < 16) onChange({ fields: [...item.fields, { ...field, options: [...field.options], value: "" }] });
  };
  const addCustomField = () => {
    const label = fieldName.trim();
    const options = [...new Set(fieldOptions.split(/[,\n]/).map(v => v.trim().slice(0, 100)).filter(Boolean))].slice(0, 30);
    if (!label || !options.length || item.fields.length >= 16) return;
    if (item.fields.some(f => f.label.toLowerCase() === label.toLowerCase())) { setError("Ya existe un atributo con ese nombre."); return; }
    onChange({ fields: [...item.fields, { id: crypto.randomUUID(), label, options, value: "" }] });
    setFieldName(""); setFieldOptions(""); setAddingField(false); setError("");
  };
  return (
    <section className="request-item-card" aria-label={title}>
      <header className="request-item-header">
        <h3>{title}{item.fromAi && <span className="ai-filled-badge"><Sparkles />Completado con IA</span>}</h3>
        {count > 1 && <Button type="button" variant="ghost" size="sm" className="danger-icon" disabled={busy} onClick={onRemove}><Trash2 />Quitar</Button>}
      </header>
      <div className="requirement-grid">
        <div className="requirement-field"><label id={`${prefix}-type`}>Categoría{required}</label><Select value={item.type} onValueChange={changeType} disabled={busy}><SelectTrigger aria-labelledby={`${prefix}-type`} aria-required="true" className="requirement-control"><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger><SelectContent>{[...catalog.categories.map(category => category.name), "Personalizada"].map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
        {item.type === "Personalizada" && <div className="requirement-field custom-type-field"><label htmlFor={`${prefix}-custom`}>Nombre de la categoría{required}</label><Input id={`${prefix}-custom`} required maxLength={80} placeholder="Ej. Bebestible" value={item.customType} disabled={busy} onChange={e => onChange({ customType: e.target.value })} className="requirement-control" /></div>}
        <div className="requirement-field element-field"><label htmlFor={`${prefix}-element`}>{elementLabel}{required}</label><ElementInput id={`${prefix}-element`} category={categoryName} value={item.element} onChange={element => onChange({ element })} onKnownChange={elementKnown => onChange({ elementKnown })} disabled={busy || !categoryName.trim()} placeholder={categoryName.trim() ? `Escribe para buscar en ${categoryName}` : "Primero elige la categoría"} /></div>
        <div className="requirement-field"><label htmlFor={`${prefix}-quantity`}>Cantidad{required}</label><Input id={`${prefix}-quantity`} required type="number" min="0.01" max="1000000" step="any" placeholder="Ej. 10" value={item.quantity} disabled={busy} onChange={e => onChange({ quantity: e.target.value })} className="requirement-control" /></div>
        {item.fields.map(field => <FieldSelect key={field.id} field={field} disabled={busy} onChange={updated => onChange({ fields: item.fields.map(f => f.id === field.id ? updated : f) })} onRemove={() => onChange({ fields: item.fields.filter(f => f.id !== field.id) })} />)}
      </div>
      {item.type && <section className="field-pool"><div className="pool-heading"><h4>Atributos</h4><span>{item.fields.length} / 16</span></div><div className="pool-options">{catalog.fields.map(field => <Button type="button" key={field.id} variant={item.fields.some(f => f.id === field.id) ? "secondary" : "outline"} size="sm" disabled={busy || item.fields.some(f => f.id === field.id) || item.fields.length >= 16} onClick={() => addPoolField(field.id)}>{item.fields.some(f => f.id === field.id) ? <Check /> : <Plus />}{field.label}</Button>)}<Button type="button" variant="outline" size="sm" disabled={busy || item.fields.length >= 16} onClick={() => setAddingField(!addingField)}><Plus />Atributo personalizado</Button></div>
        {addingField && <div className="custom-field-editor"><div className="requirement-field"><label htmlFor={`${prefix}-field-name`}>Nombre del atributo</label><Input id={`${prefix}-field-name`} placeholder="Ej. Tipo de bebestible" maxLength={80} value={fieldName} onChange={e => setFieldName(e.target.value)} /></div><div className="requirement-field"><label htmlFor={`${prefix}-field-options`}>Opciones, separadas por coma</label><Input id={`${prefix}-field-options`} placeholder="Jugo, Agua, Gaseosa" maxLength={3000} value={fieldOptions} onChange={e => setFieldOptions(e.target.value)} /></div><Button type="button" onClick={addCustomField} disabled={!fieldName.trim() || !fieldOptions.trim()}><Plus />Añadir atributo</Button></div>}
        {error && <p role="alert" className="requirement-error">{error}</p>}
      </section>}
      {item.type && <PendingCatalogNotice catalog={catalog} category={categoryName} fields={item.fields} element={{ label: elementLabel, value: item.element, known: item.elementKnown }} />}
    </section>
  );
}

/** "Requerimiento 2: …" so a validation message says which item it is about. */
function issueMessage(issues: { path: PropertyKey[]; message: string }[], count: number) {
  const issue = issues[0];
  if (!issue) return "Revisa los datos de la solicitud.";
  const index = issue.path[0] === "items" && typeof issue.path[1] === "number" ? issue.path[1] : null;
  return index !== null && count > 1 ? `Requerimiento ${index + 1}: ${issue.message}` : issue.message;
}

/**
 * "Nueva solicitud" (one or several items; several are sent as a package of individual requests) and editing one
 * existing request. The description comes first: the AI fills the items below from it, and every field stays editable.
 */
export function RequirementModal({ open, onOpenChange, request = null, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; request?: MyRequest | null; onSaved?: () => void }) {
  const [items, setItems] = useState<ItemDraft[]>([newItem()]);
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [aiAssisted, setAiAssisted] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>(defaultCatalog);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const loadCatalog = useServerFn(getCatalog);
  const analyze = useServerFn(describeRequirement);
  const createRequests = useServerFn(createMyRequests);
  const updateRequest = useServerFn(updateMyRequest);
  const loaded = useRef<string | null>(null);
  const load = (source: MyRequest | null, from: Catalog = catalog) => {
    loaded.current = source?.code ?? null;
    setItems([source ? draftFromRequest(source, from) : newItem()]);
    setDate(source?.dueDate ?? "");
    setDescription(source?.description ?? "");
    setAiAssisted(source?.aiAssisted ?? false);
    setError(""); setNotice("");
  };
  useEffect(() => {
    // Load the request being edited; going back to a new request starts from a blank form.
    if (open && (request?.code ?? null) !== loaded.current) load(request);
  }, [open, request]);
  useEffect(() => {
    // Only approved categories, attributes and options are offered; refresh them every time the form opens.
    if (!open) return;
    let active = true;
    loadCatalog().then(next => {
      if (!active) return;
      setCatalog(next);
      // A custom category approved since this request was written is now a regular one.
      setItems(current => current.map(item => {
        const approved = item.type === "Personalizada" ? findCategory(next, item.customType) : undefined;
        return approved ? { ...item, type: approved.name, customType: "" } : item;
      }));
    }).catch(() => { /* Keep the built-in catalog if it cannot be loaded. */ });
    return () => { active = false; };
  }, [open]);

  const editing = request !== null;
  const updateItem = (id: string, patch: Partial<ItemDraft>) => setItems(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  const fillWithAi = async () => {
    setError(""); setNotice("");
    const parsed = aiInputSchema.safeParse({ description, items: items.map(item => ({ category: categoryOf(item), fields: item.fields })) });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revisa la descripción."); return; }
    setBusy(true);
    try {
      const response = await analyze({ data: parsed.data });
      if (response.error || !response.result) { setError(response.error ?? "No se recibió una propuesta."); return; }
      const found = response.result.items;
      if (!found.length) { setError("La IA no encontró requerimientos en la descripción. Agrega más detalle o complétalos abajo."); return; }
      // Editing changes a single request, so only the first item applies.
      const usable = editing ? found.slice(0, 1) : found;
      setItems(current => usable.map((result, index) => draftFromAi(result, current[index], catalog)));
      if (response.result.requiredDate) setDate(response.result.requiredDate);
      setAiAssisted(true);
      setNotice(editing && found.length > 1
        ? `La IA encontró ${found.length} requerimientos; al editar se usa solo el primero. Para pedir el resto crea una nueva solicitud.`
        : usable.length > 1 ? `La IA completó ${usable.length} requerimientos. Revísalos abajo; se enviarán como un paquete de solicitudes individuales.` : "Propuesta completada. Puedes ajustar cualquier dato.");
    } catch { setError("No se pudo conectar con la IA. Tu descripción se conserva."); } finally { setBusy(false); }
  };
  const save = async () => {
    setError(""); setNotice("");
    const shared = { dueDate: date, description, aiAssisted };
    const itemInputs = items.map(item => ({ category: categoryOf(item), element: item.element, elementLabel: elementLabelFor(catalog, categoryOf(item)), quantity: item.quantity === "" ? undefined : Number(item.quantity), fields: item.fields.map(f => ({ label: f.label, value: f.value, options: f.options })) }));
    setBusy(true); setSaving(true);
    try {
      if (request) {
        const parsed = requestInputSchema.safeParse({ ...itemInputs[0], ...shared });
        if (!parsed.success) { setError(issueMessage(parsed.error.issues, 1)); return; }
        const response = await updateRequest({ data: { code: request.code, input: parsed.data } });
        if (!response.request) { setError(response.error); return; }
      } else {
        const parsed = requestPackageSchema.safeParse({ ...shared, items: itemInputs });
        if (!parsed.success) { setError(issueMessage(parsed.error.issues, items.length)); return; }
        const response = await createRequests({ data: parsed.data });
        if (!response.requests) { setError(response.error); return; }
        load(null);
      }
      onSaved?.();
      onOpenChange(false);
    } catch { setError("No se pudo guardar la solicitud. Tus datos se conservan; inténtalo de nuevo."); } finally { setBusy(false); setSaving(false); }
  };
  const count = items.length;
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}><DialogContent className="requirement-modal" onInteractOutside={event => event.preventDefault()}>
    <DialogHeader className="requirement-modal-header"><div className="modal-eyebrow"><FilePlus2 size={15} />SOLICITUD DE REQUERIMIENTOS</div><DialogTitle className="requirement-modal-title">{request ? `Editar solicitud ${request.code}` : "Nueva solicitud"}</DialogTitle><DialogDescription>{request?.parentCode ? `Parte del paquete ${request.parentCode}` : "Detalle del requerimiento"}</DialogDescription></DialogHeader>
    <ScrollArea type="auto" className="requirement-modal-scroll"><div className="requirement-modal-body">
      <section className="description-section"><div className="description-heading"><label htmlFor="request-description">Describe lo que necesitas</label><span className="ai-indicator"><Wand2 size={14} />Asistencia IA</span></div>
        <p className="description-hint">{editing ? "La IA completa los campos de abajo a partir de tu descripción." : "La IA completa los requerimientos de abajo. Puedes pedir varias cosas a la vez: cada una se enviará como una solicitud individual."}</p>
        <Textarea id="request-description" maxLength={4000} value={description} disabled={busy} onChange={e => { setDescription(e.target.value); setNotice(""); }} placeholder={editing ? "Ej. Necesito 50 litros de jugo de naranja marca Soprole para el 30 de octubre." : "Ej. Necesito 2 soldadores y una grúa horquilla por un día para el 30 de octubre."} className="requirement-description" />
        <div className="description-actions"><span>{description.length} / 4000</span><Button type="button" variant="outline" onClick={fillWithAi} disabled={busy || !description.trim()}>{busy && !saving ? <Loader2 className="animate-spin" /> : <Wand2 />}{busy && !saving ? "Analizando…" : "Completar con IA"}</Button></div>
      </section>
      {notice && <p role="status" className="requirement-notice"><Check size={16} />{notice}</p>}
      <p className="form-divider"><span>{editing ? "Detalle de la solicitud" : "Requerimientos de la solicitud"}</span></p>
      <div className="requirement-grid shared-fields">
        <div className="requirement-field"><label htmlFor="request-date">Fecha de vencimiento{required}</label><Input id="request-date" type="date" required min={request?.dueDate && request.dueDate < todayIso() ? request.dueDate : todayIso()} value={date} disabled={busy} onChange={e => setDate(e.target.value)} className="requirement-control" /></div>
      </div>
      <div className="request-items">
        {items.map((item, index) => <ItemEditor key={item.id} item={item} index={index} count={count} catalog={catalog} busy={busy} onChange={patch => updateItem(item.id, patch)} onRemove={() => setItems(current => current.filter(entry => entry.id !== item.id))} />)}
      </div>
      {!editing && <div className="add-item-row">
        <Button type="button" variant="outline" disabled={busy || count >= MAX_REQUEST_ITEMS} onClick={() => setItems(current => [...current, newItem()])}><Plus />Agregar otro requerimiento</Button>
        <span>{count} / {MAX_REQUEST_ITEMS}</span>
      </div>}
      {!editing && count > 1 && <p role="status" className="package-notice"><Package size={16} /><span>Se crearán <strong>{count} solicitudes individuales</strong> agrupadas en un paquete. Cada una se autoriza, rechaza o delega por separado, y podrás seguir el paquete completo desde Mis solicitudes.</span></p>}
      {error && <p role="alert" className="requirement-error">{error}</p>}
    </div></ScrollArea>
    <footer className="requirement-modal-footer"><span>{request ? `Responsable: ${responsibleFor(request).name}` : "Los campos con * son obligatorios. Se enviará al Administrador de Contrato para su revisión"}</span><div className="requirement-footer-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cerrar</Button><Button type="button" disabled={busy} onClick={save}>{saving ? <Loader2 className="animate-spin" /> : request ? <Save /> : <Send />}{saving ? "Guardando…" : request ? "Guardar cambios" : count > 1 ? `Enviar ${count} solicitudes` : "Enviar solicitud"}</Button></div></footer>
  </DialogContent></Dialog>;
}
