<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the reference welcome screen at the index route and its floating quick-access menu in a separate component; this isolates menu behavior from the presentation-only welcome content.
- People, departments and the category→department rules live in `organization.ts`; requests follow Enviada → (ADC) Autorizado / Rechazado, or Enviada → (ADC delegates) En revisión → the assigned reviewer decides in `/revision-departamento` (who is acting comes from the URL until there is sign-in, and the server checks it is that department's member and the request's assignee). Pages share list state and UI from `components/requests/request-list.tsx` and render inside `AppShell` (sidebar + header).
- Requests go through `requests.functions.ts` → `requests.server.ts` (requester and contract-administrator rules) → `requests-store.server.ts`, which uses Lovable Cloud when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist and otherwise, in development only, `.data/requests.json` seeded with sample requests; this keeps the UI testable locally without changing code for Cloud.
- The requirement catalog (types, selects, options) lives in `catalog-store.server.ts`; requests never write to it. What a request uses that the catalog lacks is stored as `proposal` on the request and reviewed item by item (`catalog.ts` `reviewOf`); only the contract administrator's approvals (`applyItem`, from the request detail or `/catalogo`) change the catalog, and corrected names are kept as aliases so the old names map to the approved ones.
- Keep requirement catalog and validation in a shared browser-safe module, dynamic modal state in its own component, and AI extraction behind a server function using server-only Gateway helpers; this keeps private configuration out of browser bundles and proposals editable without submitting requests.
