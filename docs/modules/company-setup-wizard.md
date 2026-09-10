# Company Setup Wizard

The guided walk-through a brand-new company is taken through **before its dashboard**.
It lives under **Company Setup** at `/setup/wizard` and covers the five things the rest
of the system reads from. Every step can be skipped, and a skip is remembered.

> Status: **Active** · Route prefix: `/setup/wizard`
> Sidebar: Company Setup → Setup Guide (gated by `setup.company.manage`)
> See [ADR 0032](../decisions/0032-guided-company-setup.md).

## Why it exists

Registration provisions a whole tenant and nothing inside it (ADR 0005), and the
configuration-driven modules ship no defaults on purpose (ADR 0029). The owner's first
sign-in therefore landed on a dashboard of zeroes, behind which sat nine Company Setup
screens in no stated order. This walks the five that block day-one work and leaves the
other four to the finish screen.

## Surface

Its own full-screen chrome — no app shell, because a brand-new company has nothing for
the sidebar to link to yet. A deep-navy rail (the same field the sign-in screens and the
workspace picker use) carries the company, the progress bar and the step ladder; the
working pane beside it is the app's own light surface.

| Screen | What it asks |
| --- | --- |
| Welcome | What the five steps are, and that any of them can wait. |
| 1 · Company | Display name (required), legal name, logo, contact details, employer registration numbers (folded away — a company registering today may not have them). |
| 2 · Departments | Tick suggested functions, and type any the company has of its own. Nothing is pre-ticked; a department list is genuinely different at every company. |
| 3 · Leave | Tick kinds of leave and set the days each carries. The statutory PH entitlements are pre-ticked at the number the law sets. |
| 4 · Hiring | Pick one process shape (Standard / Fast Track / Executive Search), optionally rename it. Each card shows its actual stages. |
| 5 · Appraisals | Pick one framework (Balanced / Competency Review / Results & Conduct), optionally rename it. The selected card opens to show its sections and every criterion. |
| Finish | What landed where, with "Do it now" on anything still open, plus the four Company Setup screens the wizard leaves out. |

The step ladder is free to move around — the steps are independent. A step whose module
the signed-in person may not configure is **shown, not hidden**, marked "No access", with
skipping as its forward action.

Each step confirms itself with a toast, saying what it created ("6 leave types added").
The wizard is the app's only surface with a pinned action bar bottom-right, where toasts
land, so it **lifts the toaster clear of its own footer** — see `toast-clearance.tsx` and
the two variables `components/ui/sonner.tsx` reads.

## The redirect

`RequireCompanySetup` (in the `web` group, right after `SetCurrentOrganization`) sends an
owner to the wizard until setup is closed. It is deliberately narrow — it acts only on:

- a **page navigation** — GET/HEAD and not JSON, so a form post, an API call or a CSV
  download is never bounced mid-flight;
- by somebody holding **`setup.company.manage`**, so a Staff member joining a
  half-configured company is not trapped in a wizard they may not use;
- **outside the exempt set** — `setup.wizard.*`, `logout`, `workspaces`,
  `organization.switch`, the person's own account settings (`profile.*`, `security.*`,
  `appearance.*`, `password.*`, `two-factor.*`, `passkey.*`, `verification.*`) and the
  public surfaces (`home`, `careers.*`, `invite.*`).

Finishing the wizard — or "I'll set this up later", which is the same endpoint — clears
it for good.

## Data model

No new table. Two columns on `organizations` (see
[organizations table](../database/organizations-table.md)):

| Column | Notes |
| --- | --- |
| `setup_completed_at` | Null means "still show me the wizard". |
| `setup_steps` | `{step key: "done"｜"skipped"}`; anything absent reads as pending. |

Neither is `$fillable` — they are tenant state written only by `CompanySetup`, the same
reasoning as `join_code`. Organisations that predate the wizard were back-filled as
complete by the migration.

## Backend

- **`Setup\SetupWizardController`** — `show` (renders `setup/wizard` with the blueprints,
  the progress, what the company already has, and a per-step `can` map) plus one action
  per step, `skip` and `finish`.
- **`Support\Setup\CompanySetup`** — the step vocabulary (`STEPS`, `DONE`/`SKIPPED`/
  `PENDING`, `ABILITIES`) and the progress reads/writes. `resumeStep()` answers the first
  step still unanswered.
- **`Support\Setup\SetupBlueprints`** — every starting point the wizard offers:
  departments, leave types, pipelines, the criteria catalogue, and the frameworks that
  draw on it. Blueprints are resolved from here by **key**, never trusted as content.
- **`Support\Setup\BlueprintInstaller`** — writes a chosen blueprint into the current
  tenant. Every method is idempotent against what the company already has, so a double
  submit (or a second owner walking the wizard) cannot produce two "Vacation Leave"s.
  Scales and criteria resolve **by name**, so adopting a blueprint next to existing
  configuration reuses the catalogue rather than splitting it.
- **`Support\Setup\CompanyProfileWriter`** — the shared profile write, called by both
  this wizard and `CompanyProfileController`.
- **FormRequests** in `Http/Requests/Setup/Wizard/` — one per step, plus `WizardSkipRequest`.
  The company step reuses `UpdateCompanyProfileRequest` unchanged.
- Mutations are activity-logged (`logName: 'company-setup'`, and `'recruitment'` for the
  pipeline), described as happening "during company setup".

## Frontend

`resources/js/pages/setup/wizard.tsx` (registered as a layout-less page in `app.tsx`)
over `features/setup-wizard/`:

- `use-setup-wizard.ts` — which screen is on show, the ladder navigation, `skip` and
  `finish`. Advancing is the client's decision, taken once the server confirms the step;
  what is *recorded* stays the server's, re-read from props after every post.
- `components/choice-card.tsx` — the wizard's main control. The real radio/checkbox stays
  in the DOM, visually hidden, so keyboard and screen readers behave natively and the
  card only styles `peer-checked`. A `bare` variant drops the card chrome where the row
  is already the surface (the leave table).
- `components/wizard-rail.tsx`, `step-body.tsx`, `step-footer.tsx`,
  `already-configured.tsx`, `toast-clearance.tsx`, and one component per screen.
- `components/ui/sonner.tsx` takes its bottom offset from
  `--app-toast-offset-bottom` / `--app-toast-offset-bottom-mobile`, defaulting to
  sonner's own values. The app mounts one `<Toaster>` globally, so that pair of
  variables is how a page with a pinned action bar asks it to move; every other page
  is exactly where it was.
- `constants.ts` carries the step copy and the four Company Setup screens the wizard
  leaves out; `routes.ts` mirrors the named routes.

## Permissions

Reaching the wizard is `setup.company.manage`. Each step is gated by the ability of the
module it configures:

| Step | Ability |
| --- | --- |
| Company | `setup.company.manage` |
| Departments | `setup.departments.manage` |
| Leave | `setup.leave-types.manage` |
| Hiring | `recruitment.configure-pipelines` |
| Appraisals | `setup.kpi.manage` |

No new permission was added. Built-in **HR Manager** (the owner) holds all five.

## Integrations

- **Company Profile** — step 1 is the same payload, validation and writer.
- **Departments / Leave Types / Recruitment Pipelines / Performance Framework** — each
  step creates records those screens read back and edit as normal.
- **Seeding** — `OrganizationSeeder` marks a seeded tenant complete, so the demo account
  lands on the dashboard rather than the wizard.
- **Tests** — `OrganizationFactory` defaults to a company already in use;
  `newlyRegistered()` is the state that owes setup.

## Out of scope (this cut)

Work schedules, holidays, onboarding and offboarding programs, and award types — all
named on the finish screen, none of them blocking day-one work. Inviting people is left
to the Employees module, which already has an invitation flow (ADR 0026).
