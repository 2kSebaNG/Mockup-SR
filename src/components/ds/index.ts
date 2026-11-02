/**
 * Ecosistema X design system. Build new views from these pieces (and the shadcn primitives in components/ui) and
 * move older views onto them when you touch them; docs/design-system.md has the rules and the live reference is
 * the /sistema-diseno page.
 */
export { toneClass, requestStatusTone, type Tone } from "./tone";
export { Page, PageHeader, BackLink } from "./page";
export { Panel, Stack, Split } from "./panel";
export { Badge, Tag, Tags } from "./badge";
export { Callout, type CalloutVariant } from "./callout";
export { EmptyState } from "./empty-state";
export { DescriptionList, type Description } from "./description-list";
export { FilterBar, FilterField, SearchInput } from "./filter-bar";
export { DataList, type DataColumn } from "./data-list";
export { Pagination, paginate } from "./pagination";
export { IconAction, Actions } from "./icon-action";
export { ChoiceGrid, ChoiceCard } from "./choice";
export { FormRow, FormActions, Optional } from "./form";
export { Stat, StatRow } from "./stat";
export { PageTabs, PageTab } from "./page-tabs";
export { SegmentedFilter, type SegmentedOption } from "./segmented-filter";
export { Stepper, stepOf } from "./stepper";
export { MasterDetail } from "./master-detail";
export { MoneyInput, formatMoney } from "./money-input";
export { RutInput, rutProblem } from "./rut-input";
export { Combobox, type ComboboxOption } from "./combobox";
export { DataListSkeleton } from "./data-list-skeleton";
