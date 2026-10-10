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

- Data access uses the browser client with RLS; permissions live in SQL helpers (has_role, can_view_client, can_edit_client). Why: one source of truth for role rules.
- Public client reports go through the security-definer RPC get_shared_report(share_token). Why: no anon table access.
- First admin is assigned by bootstrap_user() RPC called after sign-in (no triggers on auth schema).
- Social leads live on campaign entries and use shared metrics helpers for eligibility and cost; total cost per lead uses only social spend so Google spend cannot inflate it.
- Mobile navigation reuses the role-filtered desktop links in an accessible Sheet; daily entry uses mobile platform forms and a desktop table so narrow screens remain editable.
