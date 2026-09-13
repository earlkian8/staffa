# Work Schedule & Holidays

Two related Company-Setup catalogues on one screen (`/setup/schedule`): the **work
schedules** (shift patterns) employees are assigned to, and the organisation's
**holiday calendar**. Data model is ERD §2 (`WORK_SCHEDULE`, `HOLIDAY`); everything is
tenant-scoped (ADR 0005). It follows the two-config-surface shape of
[KPI & Evaluation Criteria](./performance.md) — one index controller plus a resource
controller per catalogue.

> Status: **Active** · Route prefix: `/setup/schedule`
> Sidebar: Company Setup → Work Schedule & Holidays (gated by `setup.schedule.view`)

## Surfaces

A single page with two sections, each a card list with archive / restore /
permanently-delete (mirrors the KPI setup page):

- **Work schedules** — a shift's name, hours (`start_time`–`end_time`, an end before
  the start is an overnight shift), **working days** (a Mon–Sun toggle), lateness
  **grace** and **required hours**. Each row shows how many employees are assigned.
- **Holidays** — a named **date** with a **type** (regular / special non-working /
  special working) and an optional **yearly recurrence** (repeats on the same
  month/day). Recurring entries show a "Yearly" marker; the date renders as
  `Jan 1 · yearly` or `Jan 1, 2026`.

## Data model

- **`work_schedules`** — already created with the org foundation (read by Attendance).
  This module adds **soft deletes** + a hashid so a schedule can be **archived** (assigned
  employees keep it — `Employee::workSchedule` is `withTrashed`) and a UI to manage them;
  permanent deletion is blocked while employees are assigned.
- **`holidays`** *(new)* — `name`, `date`, `type` (`regular` / `special_non_working` /
  `special_working`), `is_recurring`, soft-deletes + hashid. See the
  [schema doc](../database/work-schedule-holidays-tables.md).

## Backend

- Controllers (`app/Http/Controllers/Setup/`): `ScheduleSetupController` (index — renders
  both catalogues + their archived sets), `WorkScheduleController` and `HolidayController`
  (store / update / destroy / restore / forceDelete). Thin, FormRequest-validated,
  activity-logged (`logName: 'company-setup'`). Both are addressed by **hashid**; restore /
  force-delete take the hashid as a string (so trashed rows resolve).
- Requests `WorkScheduleRequest` (times `H:i`, `work_days` constrained to Mon–Sun, grace /
  hours bounds) + `HolidayRequest`. Resources `WorkScheduleResource` (+ `employees_count`,
  trims times to `HH:MM`) + `HolidayResource` (+ derived `month`/`day`).
- `routes/setup.php` under the `schedule/…` prefix; every route gated.

### Integration — holidays make leave holiday-aware

`App\Support\HolidayCalendar::datesInRange()` resolves the **non-working** holiday dates
(`regular` + `special_non_working`) in a range, **expanding yearly-recurring holidays onto
whichever year(s) the range spans** (so one New-Year row is honoured every year).
`App\Support\LeaveCalculator` now takes an optional holiday set, so a leave request is **not
charged on a holiday** (it stays a pure date utility — the DB lookup lives in
`HolidayCalendar`). Wired into `LeaveRequestController` (file / edit) and the assistant's
`LeaveModule`. `special_working` holidays remain ordinary working days.

### Integration — attendance judges by schedule and holiday, frozen per day

[Attendance](./attendance.md) reads both catalogues when a day opens and **freezes them
onto the day** (ADR 0036): the schedule's times become the shift's instants in the
organisation's zone (an end before the start ends the next morning), and its grace,
required hours and working days plus the day's holiday go into the record's `rules`
snapshot. `HolidayCalendar::on()` / `inRange()` return the holiday on a date of **any**
type (a non-working one wins when two share a date). A `regular` or
`special_non_working` holiday nobody worked is recorded as `holiday`; a `special_working`
holiday is an ordinary working day.

> **Editing a schedule or adding a holiday does not change days already recorded.** HR
> re-applies the current schedule from the attendance board when a past day should be
> judged by the change.

## Permissions

`setup.schedule.view` (see the catalogues) and `setup.schedule.manage` (create / edit /
archive), added to `PermissionRegistry` under **Company Setup**. Built-in **HR Manager** gets
both; Super Admin / Administrator via the all-permissions grant. The sidebar item is gated on
`setup.schedule.view`.

## Seeding

`HolidaySeeder` (in `DatabaseSeeder`) seeds the Philippine statutory calendar:
fixed regular and special non-working holidays as recurring entries, plus the movable National
Heroes Day (last Monday of August). Work schedules (Day / Night Shift) are seeded by
`OrganizationSeeder`. Idempotent.

## Out of scope (this cut)

Per-employee schedule overrides, rotating shift patterns, half-day/holiday **pay** rules,
movable-feast auto-calculation (Holy Week), and region-specific local holidays.
