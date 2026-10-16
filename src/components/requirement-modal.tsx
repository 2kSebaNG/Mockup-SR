import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Wand2, Loader2, Check, FilePlus2, Save, Send, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { aiInputSchema, type RequirementField } from "@/lib/requirements";
import { ElementInput } from "@/components/requests/element-input";
import { defaultCatalog, diffAgainstCatalog, elementLabelFor, fieldsForCategory, findCategory, findField, hasClassificationChanges, hasOptionChanges, uniqueValues, type Catalog } from "@/lib/catalog";
import { describeRequirement } from "@/lib/requirements-ai.functions";
import { requestInputSchema, responsibleFor, type MyRequest } from "@/lib/my-requests";
import { createMyRequest, getCatalog, updateMyRequest } from "@/lib/requests.functions";

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

/** The request's selects, with the catalog's options plus any the requester had proposed for that select. */
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
  return <p role="status" className="catalog-pending-notice"><Hourglass size={16} /><span><strong>Pendiente de aprobación:</strong> {items.join("; ")}. Tu solicitud se envía igual; el Administrador de Contrato decidirá si esta clasificación se agrega al catálogo.</span></p>;
}

export function RequirementModal({ open, onOpenChange, request = null, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; request?: MyRequest | null; onSaved?: (request: MyRequest) => void }) {
  const [type, setType] = useState("");
  const [customType, setCustomType] = useState("");
  const [fields, setFields] = useState<RequirementField[]>([]);
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [element, setElement] = useState("");
  const [elementKnown, setElementKnown] = useState<boolean | null>(null);
  const [aiAssisted, setAiAssisted] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>(defaultCatalog);
  const loadCatalog = useServerFn(getCatalog);
  const loaded = useRef<string | null>(null);
  const load = (source: MyRequest | null, from: Catalog = catalog) => {
    loaded.current = source?.code ?? null;
    const known = source ? findCategory(from, source.category) : undefined;
    setType(source ? (known ? known.name : "Personalizada") : "");
    setCustomType(source && !known ? source.category : "");
    setFields(source ? fieldsFromRequest(source, from) : []);
    setQuantity(source ? String(source.quantity) : "");
    setDate(source?.dueDate ?? "");
    setDescription(source?.description ?? "");
    setElement(source?.element ?? "");
    setAiAssisted(source?.aiAssisted ?? false);
    setError(""); setNotice("");
  };
  useEffect(() => {
    // Load the request being edited; going back to a new request starts from a blank form.
    if (open && (request?.code ?? null) !== loaded.current) load(request);
  }, [open, request]);
  const customTypeRef = useRef(customType);
  customTypeRef.current = customType;
  useEffect(() => {
    // Only approved types, attributes and options are offered; refresh them every time the form opens.
    if (!open) return;
    let active = true;
    loadCatalog().then(next => {
      if (!active) return;
      setCatalog(next);
      // A custom type approved since this request was written is now a regular type.
      const approved = findCategory(next, customTypeRef.current);
      if (approved) setType(current => current === "Personalizada" ? approved.name : current);
    }).catch(() => { /* Keep the built-in catalog if it cannot be loaded. */ });
    return () => { active = false; };
  }, [open]);
  const [fieldName, setFieldName] = useState("");
  const [fieldOptions, setFieldOptions] = useState("");
  const [addingField, setAddingField] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const analyze = useServerFn(describeRequirement);
  const createRequest = useServerFn(createMyRequest);
  const updateRequest = useServerFn(updateMyRequest);
  const categoryNames = catalog.categories.map(category => category.name);
  const changeType = (value: string) => { setType(value); setFields(fieldsForCategory(catalog, value)); setElement(""); setNotice(""); setError(""); };
  const categoryName = type === "Personalizada" ? customType : type;
  const elementLabel = elementLabelFor(catalog, categoryName);
  const addPoolField = (id: string) => {
    const field = catalog.fields.find(f => f.id === id);
    if (field && !fields.some(f => f.label.toLowerCase() === field.label.toLowerCase()) && fields.length < 16) setFields([...fields, { ...field, options: [...field.options], value: "" }]);
  };
  const addCustomField = () => {
    const label = fieldName.trim();
    const options = [...new Set(fieldOptions.split(/[,\n]/).map(v => v.trim().slice(0, 100)).filter(Boolean))].slice(0,30);
    if (!label || !options.length || fields.length >= 16) return;
    if (fields.some(f => f.label.toLowerCase() === label.toLowerCase())) { setError("Ya existe un campo con ese nombre."); return; }
    setFields([...fields, { id: crypto.randomUUID(), label, options, value: "" }]);
    setFieldName(""); setFieldOptions(""); setAddingField(false); setError("");
  };
  const fillWithAi = async () => {
    setError(""); setNotice("");
    const parsed = aiInputSchema.safeParse({ description, category: type === "Personalizada" ? customType : type, fields });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revisa la descripción."); return; }
    setBusy(true);
    try {
      const response = await analyze({ data: parsed.data });
      if (response.error || !response.result) { setError(response.error ?? "No se recibió una propuesta."); return; }
      const result = response.result;
      const knownCategory = findCategory(catalog, result.category);
      if (knownCategory) { setType(knownCategory.name); } else { setType("Personalizada"); setCustomType(result.category); }
      if (result.element) setElement(result.element);
      const generatedFields = result.fields.map((f, index) => {
        const existing = fields.find(old => old.label.toLowerCase() === f.label.toLowerCase());
        const pooled = findField(catalog, f.label);
        return { ...f, id: existing?.id ?? pooled?.id ?? `ai-${index}-${crypto.randomUUID()}`, options: [...new Set([...(existing?.options ?? []), ...f.options])].slice(0, 30), value: f.value || existing?.value || "" };
      });
      setFields([...generatedFields, ...fields.filter(f => !generatedFields.some(g => g.label.toLowerCase() === f.label.toLowerCase()))].slice(0,16));
      if (result.quantity !== null) setQuantity(String(result.quantity));
      if (result.requiredDate) setDate(result.requiredDate);
      setAiAssisted(true);
      setNotice("Propuesta completada. Puedes ajustar cualquier dato.");
    } catch { setError("No se pudo conectar con la IA. Tu descripción se conserva."); } finally { setBusy(false); }
  };
  const save = async () => {
    setError(""); setNotice("");
    const parsed = requestInputSchema.safeParse({ category: categoryName, element, elementLabel, quantity: quantity === "" ? undefined : Number(quantity), dueDate: date, description, fields: fields.map(f => ({ label: f.label, value: f.value, options: f.options })), aiAssisted });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revisa los datos de la solicitud."); return; }
    setBusy(true); setSaving(true);
    try {
      const response = request ? await updateRequest({ data: { code: request.code, input: parsed.data } }) : await createRequest({ data: parsed.data });
      if (!response.request) { setError(response.error); return; }
      if (!request) load(null);
      onSaved?.(response.request);
      onOpenChange(false);
    } catch { setError("No se pudo guardar la solicitud. Tus datos se conservan; inténtalo de nuevo."); } finally { setBusy(false); setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}><DialogContent className="requirement-modal" onInteractOutside={event => event.preventDefault()}>
    <DialogHeader className="requirement-modal-header"><div className="modal-eyebrow"><FilePlus2 size={15} />SOLICITUD DE REQUERIMIENTOS</div><DialogTitle className="requirement-modal-title">{request ? `Editar solicitud ${request.code}` : "Nueva solicitud"}</DialogTitle><DialogDescription>Detalle del requerimiento</DialogDescription></DialogHeader>
    <div className="requirement-modal-body">
      <div className="requirement-grid">
        <div className="requirement-field"><label id="requirement-type-label">Categoría</label><Select value={type} onValueChange={changeType} disabled={busy}><SelectTrigger aria-labelledby="requirement-type-label" className="requirement-control"><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger><SelectContent>{[...categoryNames,"Personalizada"].map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></div>
        {type === "Personalizada" && <div className="requirement-field custom-type-field"><label htmlFor="custom-type">Nombre de la categoría</label><Input id="custom-type" maxLength={80} placeholder="Ej. Bebestible" value={customType} disabled={busy} onChange={e => setCustomType(e.target.value)} className="requirement-control" /></div>}
        <div className="requirement-field element-field"><label htmlFor="request-element">{elementLabel}</label><ElementInput id="request-element" category={categoryName} value={element} onChange={setElement} onKnownChange={setElementKnown} disabled={busy || !categoryName.trim()} placeholder={categoryName.trim() ? `Escribe para buscar en ${categoryName}` : "Primero elige la categoría"} /></div>
        <div className="requirement-field"><label htmlFor="request-quantity">Cantidad</label><Input id="request-quantity" type="number" min="0.01" max="1000000" step="any" placeholder="Ej. 10" value={quantity} disabled={busy} onChange={e => setQuantity(e.target.value)} className="requirement-control" /></div>
        <div className="requirement-field"><label htmlFor="request-date">Fecha requerida</label><Input id="request-date" type="date" value={date} disabled={busy} onChange={e => setDate(e.target.value)} className="requirement-control" /></div>
        {fields.map(field => <FieldSelect key={field.id} field={field} disabled={busy} onChange={updated => setFields(fields.map(f => f.id === field.id ? updated : f))} onRemove={() => setFields(fields.filter(f => f.id !== field.id))} />)}
      </div>
      {type && <section className="field-pool"><div className="pool-heading"><h3>Campos del requerimiento</h3><span>{fields.length} / 16</span></div><div className="pool-options">{catalog.fields.map(field => <Button type="button" key={field.id} variant={fields.some(f => f.id === field.id) ? "secondary" : "outline"} size="sm" disabled={busy || fields.some(f => f.id === field.id) || fields.length >= 16} onClick={() => addPoolField(field.id)}>{fields.some(f => f.id === field.id) ? <Check /> : <Plus />}{field.label}</Button>)}<Button type="button" variant="outline" size="sm" disabled={busy || fields.length >= 16} onClick={() => setAddingField(!addingField)}><Plus />Campo personalizado</Button></div>
      {addingField && <div className="custom-field-editor"><div className="requirement-field"><label htmlFor="field-name">Nombre del campo</label><Input id="field-name" placeholder="Ej. Tipo de bebestible" maxLength={80} value={fieldName} onChange={e => setFieldName(e.target.value)} /></div><div className="requirement-field"><label htmlFor="field-options">Opciones, separadas por coma</label><Input id="field-options" placeholder="Jugo, Agua, Gaseosa" maxLength={3000} value={fieldOptions} onChange={e => setFieldOptions(e.target.value)} /></div><Button type="button" onClick={addCustomField} disabled={!fieldName.trim() || !fieldOptions.trim()}><Plus />Añadir campo</Button></div>}
      </section>}
      <section className="description-section"><div className="description-heading"><label htmlFor="request-description">¿No es lo que buscabas? Escríbelo</label><span className="ai-indicator"><Wand2 size={14} />Asistencia IA</span></div><Textarea id="request-description" maxLength={4000} value={description} disabled={busy} onChange={e => { setDescription(e.target.value); setNotice(""); }} placeholder="Ej. Necesito 50 litros de jugo de naranja marca Soprole para el 30 de octubre." className="requirement-description" /><div className="description-actions"><span>{description.length} / 4000</span><Button type="button" variant="outline" onClick={fillWithAi} disabled={busy || !description.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Wand2 />}{busy ? "Analizando…" : "Completar con IA"}</Button></div></section>
      {type && <PendingCatalogNotice catalog={catalog} category={categoryName} fields={fields} element={{ label: elementLabel, value: element, known: elementKnown }} />}
      {error && <p role="alert" className="requirement-error">{error}</p>}{notice && <p role="status" className="requirement-notice"><Check size={16} />{notice}</p>}
    </div>
    <footer className="requirement-modal-footer"><span>{request ? `Responsable: ${responsibleFor(request).name}` : "Se enviará al Administrador de Contrato para su revisión"}</span><div className="requirement-footer-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cerrar</Button><Button type="button" disabled={busy} onClick={save}>{saving ? <Loader2 className="animate-spin" /> : request ? <Save /> : <Send />}{saving ? "Guardando…" : request ? "Guardar cambios" : "Enviar solicitud"}</Button></div></footer>
  </DialogContent></Dialog>;
}