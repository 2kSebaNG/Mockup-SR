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
- Requests go through `requests.functions.ts` → `requests.server.ts` (edit/cancel rules) → `requests-store.server.ts`, which uses Lovable Cloud when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist and otherwise, in development only, `.data/requests.json` seeded with sample requests; this keeps the UI testable locally without changing code for Cloud.
- Keep requirement catalog and validation in a shared browser-safe module, dynamic modal state in its own component, and AI extraction behind a server function using server-only Gateway helpers; this keeps private configuration out of browser bundles and proposals editable without submitting requests.
