# SYNAPSE — Step-by-Step Testing Guide

A walkthrough for testing every feature in the system by hand, written in plain
language with ready-to-type sample data.

You do **not** need to know Laravel, React, or machine learning to follow this.
Just start the programs in Part 0, then work down the list.

---

## Table of contents

- [Part 0 — Starting everything up](#part-0--starting-everything-up)
- [Part 1 — Signing in and your account](#part-1--signing-in-and-your-account)
- [Part 2 — Company Setup](#part-2--company-setup)
- [Part 3 — Hiring (Recruitment)](#part-3--hiring-recruitment)
- [Part 4 — The public careers page](#part-4--the-public-careers-page)
- [Part 5 — Onboarding a new hire](#part-5--onboarding-a-new-hire)
- [Part 6 — Employees](#part-6--employees)
- [Part 7 — Attendance](#part-7--attendance)
- [Part 8 — Leave](#part-8--leave)
- [Part 9 — Performance](#part-9--performance)
- [Part 10 — Training](#part-10--training)
- [Part 11 — Awards](#part-11--awards)
- [Part 12 — Events & Meetings](#part-12--events--meetings)
- [Part 13 — Offboarding (staff leaving)](#part-13--offboarding-staff-leaving)
- [Part 14 — Analytics & AI](#part-14--analytics--ai)
- [Part 15 — Reports](#part-15--reports)
- [Part 16 — The AI Assistant](#part-16--the-ai-assistant)
- [Part 17 — System administration](#part-17--system-administration)
- [Part 18 — The mobile app](#part-18--the-mobile-app)
- [Part 19 — Multiple companies (workspace switching)](#part-19--multiple-companies-workspace-switching)
- [Appendix A — Things that are known not to work](#appendix-a--things-that-are-known-not-to-work)
- [Appendix B — Resetting back to a clean demo](#appendix-b--resetting-back-to-a-clean-demo)
- [Appendix C — Full checklist](#appendix-c--full-checklist)

---

## Part 0 — Starting everything up

### What the system is made of

| Piece | Folder | What it is | Needed? |
| --- | --- | --- | --- |
| Web app | `server/` | The HR system itself, opened in a browser | **Yes** |
| Database | PostgreSQL | Where all the data lives | **Yes** |
| Prediction service | `model/` | A small Python program that produces the promotion & performance predictions | Only for Part 14 |
| Mobile app | `mobile/` | Phone app for staff to clock in and file leave | Only for Part 18 |

### 0.1 — Make sure the database is running

The system uses PostgreSQL. The database it expects is named **`staffa`** (this is
set in `server/.env`).

```bash
# check Postgres is up
pg_isready
```

If it isn't running, start it however you normally do (e.g. `sudo systemctl start postgresql`).

### 0.2 — Load the demo data

Do this **once** before you start testing. It wipes the database and fills it with
a realistic sample company.

```bash
cd server
php artisan migrate:fresh --seed
```

This takes 30–60 seconds. When it finishes you will have:

- 2 companies — **SYNAPSE Demo Co** (the main one) and **SYNAPSE Labs** (a small second one)
- 50 employees across the two companies
- 5 job postings, applicants, interviews
- About 6 weeks of clock-in/clock-out history
- Leave requests, performance reviews, trainings, awards, events, and exits
- **One login account** (see below)

### 0.3 — Start the web app

```bash
cd server
composer dev
```

This one command starts three things at once: the web server, a background job
runner, and the page builder. Leave this terminal open.

Then open **http://localhost:8000** in your browser.

> If `composer dev` fails, you can run the three parts in separate terminals
> instead: `php artisan serve`, `php artisan queue:listen --tries=1`, and `npm run dev`.

### 0.4 — Your login

There is **one** account. Everything else in the system is data, not a login.

| | |
| --- | --- |
| **Email** | `earlkian.dev@gmail.com` |
| **Password** | `password` |

This account is an **HR Manager**, which is the highest level of access — it can
see and do everything. That is what you want for testing.

### 0.5 — (Optional) Start the prediction service

Only needed for **Performance Forecast** and **Promotion Readiness** in Part 14.

```bash
cd model
python -m api
```

It runs at `http://127.0.0.1:8001`. Check it is alive by opening
`http://127.0.0.1:8001/health` in a browser — you should see a short "ok"-style response.

If you skip this, those two pages still open and still show past results, but a
yellow warning appears and the "Run" button is disabled. That is correct behaviour,
not a bug.

---

## Part 1 — Signing in and your account

### 1.1 — Log in

1. Go to **http://localhost:8000**.
2. You land on a welcome page. Click **Log in** (or go straight to `/login`).
3. Enter the email and password from step 0.4.
4. You land on **Dashboard**.

**What to check:** the left sidebar shows groups — Main, Talent Acquisition,
Workforce, Offboarding, Analytics & AI, Company Setup, System. The dashboard
shows number cards, charts, a to-do queue, and a recent-activity feed.

### 1.2 — Test a wrong password

1. Log out (click your name at the bottom-right / top-right menu → Log out).
2. Try logging in with password `wrongpassword`.
3. **Expect:** a clear error message, and you stay on the login page.
4. Log back in properly.

### 1.3 — Edit your profile

Go to **/settings/profile** (or the user menu → Settings).

Try changing:

| Field | Sample value |
| --- | --- |
| First name | `Earl Kian` |
| Last name | `Bancayrin` |
| Profile photo | any JPG or PNG under 2 MB |

Save. **Expect:** a green success message, and your photo appears in the top bar.

### 1.4 — Change appearance

Go to **/settings/appearance**. Switch between **Light**, **Dark** and **System**.

**Expect:** the whole app changes colour immediately and the choice sticks after
a page refresh.

### 1.5 — Security settings

Go to **/settings/security**. You will be asked to confirm your password first —
type `password`.

Here you can:
- **Change your password.** Try a new one, then change it back to `password` so the
  rest of this guide still works.
- **Turn on two-factor authentication.** You will be shown a QR code to scan with
  an authenticator app (Google Authenticator, Authy, etc.) plus recovery codes.
  If you turn this on, you will need a code every time you log in — so only test
  this if you have an authenticator app ready, and turn it off afterwards.
- **Add a passkey** (fingerprint / face / device PIN login), if your device supports it.

---

## Part 2 — Company Setup

This is where you define the shape of the company before using the day-to-day
modules. Everything is in the **Company Setup** group in the sidebar.

### 2.1 — Company Profile → `/setup/company`

The demo already filled this in. Try editing it:

| Field | Sample value |
| --- | --- |
| Company name | `SYNAPSE Demo Co` |
| Legal name | `Synapse Demo Company, Inc.` |
| Email | `hello@synapse.example` |
| Phone | `+63 2 8123 4567` |
| Address | `12F Cyber One Tower, 11th Avenue, Bonifacio Global City, Taguig, Metro Manila, 1634` |
| TIN | `009-123-456-000` |
| SSS employer no. | `03-9123456-7` |
| PhilHealth employer no. | `00-012345678-9` |
| Pag-IBIG employer no. | `1234-5678-9012` |
| Logo | upload any PNG |

Save. **Expect:** the logo you uploaded now appears at the top of the sidebar.

**Also test the join code.** On this page there is a **join code** — a short code
(the demo one is `YE2XPAX`) that a new person can type to ask to join this company.
Click **rotate/regenerate** and check the code changes. Write down the new code —
you will use it in Part 17.6.

### 2.2 — Departments → `/setup/departments`

The demo ships with: Human Resources, Information Technology, Finance, Operations,
Sales & Marketing, plus two sub-departments (IT Support, Recruitment).

**Add a new department:**

| Field | Sample value |
| --- | --- |
| Name | `Customer Support` |
| Code | `CS` |
| Parent department | *(leave blank for a top-level one)* |
| Head | pick any employee from the list |

Save. **Expect:** it appears in the list/tree.

**Add a job position inside it.** Click into `Customer Support`, then add a position:

| Field | Sample value |
| --- | --- |
| Title | `Support Specialist` |
| Minimum salary | `22000` |
| Maximum salary | `35000` |

**Also test:**
- Making a sub-department: add `Tier 2 Support`, code `CS2`, parent `Customer Support`.
- Deleting `Customer Support` — it goes to the Trash Bin, not gone forever (see Part 17.5).

### 2.3 — Work Schedule & Holidays → `/setup/schedule`

Two tabs on one page.

**Add a work schedule:**

| Field | Sample value |
| --- | --- |
| Name | `Mid Shift` |
| Start time | `14:00` |
| End time | `23:00` |
| Work days | Mon, Tue, Wed, Thu, Fri |
| Grace period (minutes) | `15` |
| Required hours | `8` |

**Add a holiday:**

| Field | Sample value |
| --- | --- |
| Name | `Company Foundation Day` |
| Date | pick a weekday next month |
| Type | Special / Regular (either) |

**Why it matters:** holidays are *not* deducted from anyone's leave. You can prove
this later in Part 8 by filing leave across the holiday date and seeing the day
count come out lower than the plain calendar count.

### 2.4 — Leave Types → `/setup/leave-types`

The demo has: Vacation Leave, Sick Leave, Emergency Leave, Bereavement Leave,
Maternity Leave, Paternity Leave, Unpaid Leave.

**Add one:**

| Field | Sample value |
| --- | --- |
| Name | `Study Leave` |
| Code | `STL` |
| Paid? | Yes |
| Default days per year | `5` |
| Active | Yes |

**Also test:** switch `Unpaid Leave` to inactive and confirm it disappears from the
dropdown when filing leave in Part 8. Then switch it back on.

### 2.5 — Award Types → `/setup/award-types`

**Add one:**

| Field | Sample value |
| --- | --- |
| Name | `Customer Hero` |
| Description | `Went out of their way for a customer.` |
| Colour | pick any |

### 2.6 — Performance Framework → `/setup/kpi`

This page has four things on it. Test each.

**a) Rating scale** — how scores are expressed.

| Field | Sample value |
| --- | --- |
| Name | `5-Point Scale` |
| Levels | `1 = Needs Improvement`, `2 = Below Expectations`, `3 = Meets Expectations`, `4 = Exceeds Expectations`, `5 = Outstanding` |

**b) Criteria** — the things people are scored on.

| Field | Sample value |
| --- | --- |
| Name | `Customer Communication` |
| Description | `Clarity, tone and responsiveness with customers.` |
| Weight | `20` |

> Weights across the criteria in one framework should add up to 100.

**c) Framework (appraisal template)** — a named bundle of criteria.

| Field | Sample value |
| --- | --- |
| Name | `Support Team Appraisal` |
| Rating scale | `5-Point Scale` |
| Criteria | tick 3–4 of the criteria, with weights totalling 100 |

**d) Review period** — the window being reviewed.

| Field | Sample value |
| --- | --- |
| Name | `H2 2026 Review` |
| Start date | `2026-07-01` |
| End date | `2026-12-31` |
| Status | `open` |

### 2.7 — Recruitment Pipelines → `/setup/recruitment-pipelines`

A pipeline is the list of stages a job applicant moves through. The demo has one
called **Standard Hiring**.

**Create your own:**

| Field | Sample value |
| --- | --- |
| Name | `Fast-Track Hiring` |
| Stages (in order) | `Applied` → `Phone Screen` → `Final Interview` → `Offer` → `Hired` |

Try reordering the stages by dragging, and renaming one.

### 2.8 — Onboarding Programs → `/setup/onboarding`

A reusable checklist for new hires.

| Field | Sample value |
| --- | --- |
| Name | `Support Team Onboarding` |
| Description | `First two weeks for a new support hire.` |
| Tasks | `Sign employment contract` (due day 1) · `Set up laptop and accounts` (day 1) · `Read the support handbook` (day 2) · `Shadow a senior agent` (day 3) · `Handle first 5 live tickets` (day 10) |

### 2.9 — Offboarding Programs → `/setup/offboarding`

A reusable clearance checklist for people leaving.

| Field | Sample value |
| --- | --- |
| Name | `Standard Clearance` |
| Items (grouped by department) | IT: `Return laptop`, `Revoke system accounts` · HR: `Exit interview`, `Return company ID` · Finance: `Settle cash advances`, `Final pay computation` |

---

## Part 3 — Hiring (Recruitment)

Go to **Recruitment** in the sidebar (`/recruitment`).

You should see 5 postings already: Software Engineer (open), Accountant (open),
Operations Associate (open), Recruiter (filled), Marketing Specialist (draft).

### 3.1 — Create a job posting

Click **New posting**. Fill in:

| Field | Sample value |
| --- | --- |
| Job title | `Customer Support Specialist` |
| Pipeline | `Standard Hiring` (or `Fast-Track Hiring` from 2.7) |
| Department | `Customer Support` |
| Position | `Support Specialist` |
| Employment type | `regular` |
| Number of openings | `2` |
| Closing date | any date next month |
| Status | `open` |
| Description | `We are looking for a support specialist to handle customer questions over email and chat.` |
| Requirements | `At least 1 year in a customer-facing role. Good written English. Comfortable with a ticketing system.` |
| Minimum years of experience | `1` |
| Skills | `Customer Service`, `Email Support`, `Zendesk`, `English Writing` |
| Require a CV? | Yes |
| Use fit scoring? | Yes |
| Screening questions | `Are you willing to work on a shifting schedule?` · `Can you start within 30 days?` |

Save.

> **Status meanings:** `draft` = not visible to the public. `open` = live on the
> careers page and accepting applications. `closed` = no longer accepting.
> `filled` = the role has been taken.

**Check:** a `draft` posting must NOT appear on the public careers page (Part 4).
Change one posting to draft, check the careers page, then change it back.

### 3.2 — Add a candidate by hand

From the posting, or from the candidate pool, click **Add applicant**:

| Field | Sample value |
| --- | --- |
| First name | `Andrea` |
| Last name | `Villanueva` |
| Email | `andrea.villanueva@example.com` |
| Phone | `+63 917 555 0142` |
| Current location | `Quezon City, Metro Manila` |
| Headline | `Support Specialist with 3 years in SaaS` |
| LinkedIn URL | `https://www.linkedin.com/in/andrea-villanueva-demo` |
| Portfolio URL | `https://andreavillanueva.example.com` |
| Years of experience | `3` |
| Source | `referral` |
| CV | any PDF or DOCX under 10 MB |
| Notes | `Referred by Maria Santos. Available immediately.` |

Then attach a supporting document — type `cover_letter`, and upload any PDF.

> Allowed file types everywhere in Recruitment: **PDF, DOC, DOCX, JPG, JPEG, PNG**,
> max **10 MB** each.
>
> Allowed sources: `website`, `referral`, `linkedin`, `agency`, `walk_in`, `other`.

### 3.3 — The hiring board

Open the `Customer Support Specialist` posting. You get a **board view** (columns
per stage) and a **table view** — try both using the toggle.

Test these:

1. **Drag a candidate** from `Applied` to `Phone Screen`. The card should move and stay
   there after you refresh the page.
2. **Open a candidate** by clicking their card. You see their details, CV, documents,
   fit score, interviews and a notes area.
3. **Reject a candidate.** Give a reason like `Not enough support experience for the role.`
   They should move out of the active columns.

### 3.4 — Fit score and AI insights

On a candidate's detail view, look for the **fit score** — a percentage showing how
well they match the posting's required skills and years of experience.

Then click **AI insights** (or similar). This asks Google Gemini to summarise the
candidate against the role.

**Expect:** a short written summary of strengths, gaps, and things to ask about.
It takes a few seconds. If you have no internet or the Gemini key is not working,
you get a friendly error instead of a crash.

### 3.5 — Schedule an interview

On a candidate, click **Schedule interview**:

| Field | Sample value |
| --- | --- |
| Interviewer | `Earl Kian Bancayrin` |
| Date & time | any weekday next week, `10:00 AM` |
| Mode | `online` (options: `onsite`, `online`, `phone`) |
| Location / link | `https://meet.google.com/demo-abc-xyz` |
| Notes | `30-minute screening call. Focus on ticket-handling experience.` |
| Move to stage | `Phone Screen` |

Save. **Expect:** the interview appears on the candidate, and the candidate moves
to the stage you picked.

Then **edit** the interview (move it an hour later) and **delete** a different one.

### 3.6 — Hire a candidate

Take a candidate to the last stage, then click **Hire**. Fill in:

| Field | Sample value |
| --- | --- |
| Employee number | `EMP-2001` |
| Date hired | today's date |
| Employment type | `probationary` |
| Department | `Customer Support` |
| Position | `Support Specialist` |
| Work schedule | `Day Shift` |
| Basic salary | `28000` |

**Expect — this is the important bit:**
1. The candidate becomes a real **employee** — check `/employees` and search for
   `Andrea Villanueva`.
2. The posting's open count goes down by one.
3. An **onboarding case** may be created for them (see Part 5).

### 3.7 — Export

Click **Export** on the recruitment list, and on a single posting's pipeline.
**Expect:** a CSV file downloads and opens in a spreadsheet with readable columns.

---

## Part 4 — The public careers page

This part is what an outsider sees. **Log out first**, or use a private/incognito
browser window, so you can prove it works without an account.

### 4.1 — The job board

1. Go to **http://localhost:8000/careers** — a list of companies hiring.
2. Go to **http://localhost:8000/careers/synapse-demo-co** — SYNAPSE Demo Co's board.

**Expect:** only postings with status `open` appear. Draft, closed and filled ones
must not be listed.

### 4.2 — Apply for a job

Click a job, then apply. Fill in:

| Field | Sample value |
| --- | --- |
| First name | `Miguel` |
| Last name | `Ramos` |
| Email | `miguel.ramos@example.com` |
| Phone | `+63 918 222 3344` |
| Current location | `Cebu City` |
| Years of experience | `2` |
| LinkedIn | `https://www.linkedin.com/in/miguel-ramos-demo` |
| CV | any PDF |
| Screening question 1 | Yes |
| Screening question 2 | Yes |

Submit. **Expect:** a thank-you / confirmation screen.

### 4.3 — Confirm the application arrived

Log back in, go to **Recruitment → the posting you applied to**.

**Expect:** `Miguel Ramos` is sitting in the first stage of the pipeline, with the
CV attached and the screening answers recorded.

### 4.4 — Test the spam limits

Submit the same application 6 times quickly. **Expect:** after 5 attempts within a
minute you get blocked with a "too many requests" message. This is intentional.

---

## Part 5 — Onboarding a new hire

Go to **Onboarding** (`/onboarding`).

### 5.1 — Look at the existing cases

The demo has a few in-flight cases. Open one. **Expect:** the new hire's name, their
start date, a progress bar, and a checklist of tasks.

### 5.2 — Start onboarding for your new hire

Click **Start onboarding**:

| Field | Sample value |
| --- | --- |
| Employee | `Andrea Villanueva` (from Part 3.6) |
| Program | `Support Team Onboarding` (from Part 2.8) |

**Expect:** a case is created and all the tasks from that program are copied in as
a fresh checklist.

### 5.3 — Work through the checklist

1. **Tick a task** as done. The progress bar goes up.
2. **Untick it.** The progress bar goes back down.
3. **Add a one-off task** not in the template:
   - Task: `Order a headset`
   - Assigned to: `IT`
   - Due: 3 days from today
4. **Edit** a task's name or due date.
5. **Delete** a task.
6. Tick **every** task. **Expect:** the case status flips to complete on its own.

### 5.4 — Change case status by hand

Try setting a case to `on hold` and back to `in progress`. Then delete a case
you don't need.

---

## Part 6 — Employees

Go to **Employees** (`/employees`). This is the main staff directory.

### 6.1 — Browse and filter

Test each of these:

- **Search** for `Santos`
- **Filter by department** — `Information Technology`
- **Filter by employment status** — `active`
- **Filter by employment type** — `regular`
- **Sort** by name and by date hired
- **Page** through the results

### 6.2 — Add an employee by hand

Click **Add employee**:

| Field | Sample value |
| --- | --- |
| Employee number | `EMP-3001` |
| First name | `Joshua` |
| Middle name | `Reyes` |
| Last name | `Mendoza` |
| Suffix | `Jr.` |
| Birth date | `1996-04-18` |
| Gender | `male` (options: `male`, `female`, `other`) |
| Civil status | `single` (options: `single`, `married`, `widowed`, `separated`, `divorced`) |
| Email | `joshua.mendoza@example.com` |
| Phone | `+63 919 444 8877` |
| Address | `45 Mabini Street, Barangay San Antonio, Pasig City, Metro Manila` |
| Photo | any JPG/PNG under 2 MB |
| Department | `Information Technology` |
| Position | `Software Engineer` |
| Manager | pick any employee |
| Work schedule | `Day Shift` |
| Employment type | `probationary` |
| Employment status | `active` |
| Date hired | today |
| Basic salary | `45000` |
| Bank name | `BDO Unibank` |
| Bank account no. | `001234567890` |
| TIN | `123-456-789-000` |
| SSS no. | `34-1234567-8` |
| PhilHealth no. | `12-345678901-2` |
| Pag-IBIG no. | `1234-5678-9012` |

Save.

**Rules worth testing on purpose:**
- Leave **first name** blank → should refuse to save with a clear message.
- Set **birth date** to tomorrow → should refuse ("must be before today").
- Set **date regularized** to before **date hired** → should refuse.
- Reuse employee number `EMP-3001` on a second employee → should refuse (must be unique).

### 6.3 — The 201 file (employee detail)

Open `Joshua Mendoza`. Go through each tab:

- **Overview** — personal details, job details, contact
- **Documents** — upload a PDF (name it something like `Employment Contract`)
- **Certifications** — add one:
  | Field | Sample value |
  | --- | --- |
  | Name | `AWS Certified Cloud Practitioner` |
  | Issuer | `Amazon Web Services` |
  | Issued on | `2025-03-14` |
  | Expires on | `2028-03-14` |
- **Career history** — promotions and movements
- **Attendance**, **Leave**, **Performance**, **Training**, **Awards** — his records
  from those modules should show here

Then delete the document and certification you added.

### 6.4 — Change employment status

Use the status control to set someone to `on_leave`, then back to `active`.
Available: `active`, `on_leave`, `suspended`, `resigned`, `terminated`.

### 6.5 — Bulk actions

Tick several employees using the checkboxes, then use the bulk menu to archive them.

**Expect:** they disappear from the list and turn up in the **Trash Bin** (Part 17.5),
where you can restore them.

### 6.6 — App Access → `/employees/access`

This page shows which staff can actually log in.

Three groups: people **with a login**, people **invited but not yet joined**, and
people **nobody has invited yet**.

1. Pick someone with no login and click **Invite**. Use a real email address you can
   check, e.g. your own with a plus tag: `earlkian.dev+test1@gmail.com`.
2. **Expect:** an invitation email is sent, and they move to the "invited" group.
3. Copy the invite link from the email and open it in a private browser window.
   **Expect:** a page showing who invited you and the code to type — it should
   *not* log you in by itself.
4. Back in the app, **revoke** the invitation. They should move back to "not invited".

### 6.7 — Export

Click **Export**. **Expect:** a CSV of the roster downloads.

---

## Part 7 — Attendance

Go to **Attendance** (`/attendance`).

### 7.1 — Clock in and out (your own record)

Go to **/attendance/me**.

1. Click **Time In**. **Expect:** the current time is recorded and the button changes.
2. Click **Break Start**, then **Break End**.
3. Click **Time Out**. **Expect:** total hours worked is computed for you.
4. Refresh the page — the record must still be there.

> You are testing this as Maria Santos, the employee record linked to your login.

### 7.2 — The company-wide view

Back on `/attendance`, test:

- **Change the date** to a day within the last 6 weeks — you should see many records.
- **Filter by department** and **by status** (present, late, absent, etc.)
- **Search** for an employee by name

### 7.3 — Add a record by hand

Click **Add record**:

| Field | Sample value |
| --- | --- |
| Employee | `Joshua Mendoza` |
| Date | yesterday |
| Time in | `08:12` |
| Time out | `17:30` |
| Break start | `12:00` |
| Break end | `13:00` |
| Remarks | `Forgot to clock in — verified with supervisor.` |

**Expect:** hours worked is calculated, and because the shift starts at 08:00 with a
15-minute grace period, `08:12` should NOT be counted as late. Try `08:31` on another
record and confirm it *is* flagged late.

### 7.4 — Edit, approve, delete

1. **Open** an existing record and edit the times.
2. **Approve** a single record.
3. Use **Approve all** to approve every pending record for the selected day.
4. **Delete** a record.

### 7.5 — Export

Click **Export**. **Expect:** a CSV of the attendance for your current filters.

---

## Part 8 — Leave

Go to **Leave Management** (`/leave`). There are two tabs: **Requests** and **Balances**.

### 8.1 — File a leave request

Click **File leave**:

| Field | Sample value |
| --- | --- |
| Employee | `Maria Santos` |
| Leave type | `Vacation Leave` |
| Start date | next Monday |
| End date | next Wednesday |
| Half day? | No |
| Reason | `Family trip to Baguio.` |

Save. **Expect:** it shows as `pending`, with **3 days** counted (Mon–Wed).

### 8.2 — Prove that weekends and holidays are not charged

File another one:

| Field | Sample value |
| --- | --- |
| Employee | `Maria Santos` |
| Leave type | `Sick Leave` |
| Start date | next Friday |
| End date | the Monday after |

**Expect:** the day count is **2**, not 4 — Saturday and Sunday are skipped.

Now file one that covers the holiday you created in Part 2.3.
**Expect:** the holiday is skipped too.

### 8.3 — Half-day leave

| Field | Sample value |
| --- | --- |
| Employee | `Joshua Mendoza` |
| Leave type | `Emergency Leave` |
| Start date | tomorrow |
| End date | tomorrow |
| Half day? | Yes |
| Period | `morning` (or `afternoon`) |
| Reason | `Medical appointment.` |

**Expect:** it counts as **0.5** days.

### 8.4 — Approve and reject

1. Open a `pending` request → **Approve**. Add a note: `Approved. Coordinate handover with your team.`
2. Open another → **Reject**. Reason: `Two people from the same team are already out that week.`
3. **Expect:** approved leave reduces the employee's remaining balance; rejected leave does not.

### 8.5 — Cancel

Open a request you filed and **cancel** it. **Expect:** if it was already approved,
the days come back to the balance.

### 8.6 — Balances tab

Go to **Balances**. Set the entitlement for someone:

| Field | Sample value |
| --- | --- |
| Employee | `Joshua Mendoza` |
| Year | `2026` |
| Vacation Leave | `15` |
| Sick Leave | `15` |
| Emergency Leave | `3` |
| Study Leave | `5` |

Save, then check that "used" and "remaining" update correctly as you approve his leave.

### 8.7 — Things that should be refused

- End date **before** start date → refused.
- A leave type you set to inactive in Part 2.4 → should not even appear in the dropdown.

---

## Part 9 — Performance

Go to **Performance Management** (`/performance`).

### 9.1 — Launch a review cycle

This creates evaluation forms for many people at once. Click **Launch cycle**:

| Field | Sample value |
| --- | --- |
| Review period | `H1 2026 Review` |
| Framework | `Support Team Appraisal` (or the default) |
| Scope | `departments` |
| Departments | `Customer Support`, `Information Technology` |

**Expect:** one blank evaluation is created for every active employee in those
departments.

Try again with scope `all` on a different period — that creates one for everybody.

### 9.2 — Create a single evaluation

| Field | Sample value |
| --- | --- |
| Employee | `Joshua Mendoza` |
| Review period | `H1 2026 Review` |
| Framework | `Support Team Appraisal` |

### 9.3 — Score an evaluation

Open it. For each criterion, give a score and a comment:

| Criterion | Score | Comment |
| --- | --- | --- |
| Customer Communication | `4` | `Clear and calm with difficult customers. Escalates at the right time.` |
| Quality of Work | `4` | `Very few reopened tickets this period.` |
| Reliability | `5` | `Never missed a shift. Covers for teammates without being asked.` |
| Initiative | `3` | `Does the job well but rarely suggests improvements.` |

Add an overall comment:
`Strong, dependable performer. Next step is taking more ownership beyond the ticket queue.`

**Expect:** an **overall score** is calculated automatically, weighted by each
criterion's weight. Check the arithmetic against the weights you set in Part 2.6.

### 9.4 — Submit and acknowledge

1. Click **Submit**. **Expect:** the evaluation locks — scores can no longer be edited.
2. Click **Acknowledge** (this is the employee confirming they've seen it).
3. **Expect:** the status moves through draft → submitted → acknowledged.

### 9.5 — AI insights

On a completed evaluation, click **AI insights**. **Expect:** a written summary of
the person's strengths, weaknesses, and suggested development actions, generated
from the scores and comments.

### 9.6 — Export

Click **Export** for a CSV of evaluations.

---

## Part 10 — Training

Go to **Training & Development** (`/training`).

### 10.1 — Create a program

| Field | Sample value |
| --- | --- |
| Name | `De-escalation Skills Workshop` |
| Description | `A two-day workshop on handling angry customers and defusing tense conversations.` |
| Provider | `Ateneo Center for Continuing Education` |
| Start date | first Monday of next month |
| End date | the day after |
| Capacity | `20` |

Save.

**Expect:** the status is worked out automatically from the dates — `upcoming` if
it hasn't started, `ongoing` if today falls inside it, `completed` if it's over.
Try creating one with dates in the past to see `completed`.

### 10.2 — Enrol people

Open the program → **Enrol employees** → tick 5–6 employees → save.

**Expect:** the roster fills, and the remaining seats count drops (20 → 14).

**Test the capacity limit:** set a program's capacity to `2`, then try to enrol 5
people. It should stop you or warn you.

### 10.3 — Update enrolment results

For each enrolled person set:

| Field | Sample value |
| --- | --- |
| Status | `completed` (options also include enrolled, in progress, dropped) |
| Score | `88` |
| Remarks | `Participated actively in the roleplay exercises.` |

Then use **bulk update** to mark several people `completed` at once.

### 10.4 — AI insights and exports

- Click **AI insights** on a program → a summary of how the cohort did.
- **Export** the program roster and the full training list as CSV.

### 10.5 — Delete and restore

Delete a program. **Expect:** it goes to the Trash Bin and can be restored (Part 17.5).

---

## Part 11 — Awards

Go to **Awards & Recognition** (`/awards`).

### 11.1 — Give an award

Click **Give award**:

| Field | Sample value |
| --- | --- |
| Employee | `Maria Santos` |
| Award type | `Customer Hero` (from Part 2.5) |
| Date awarded | today (must not be in the future) |
| Reason | `Stayed two hours past her shift to resolve a client's payroll issue before the cutoff.` |

**Expect:** it appears at the top of the recognition feed, colour-coded by award type.

### 11.2 — Nominations → `/awards/nominations`

This page suggests who deserves recognition, based on their actual records
(performance scores, attendance, training).

**Expect:** a ranked list of employees with a short reason for each.

### 11.3 — AI citation writer

On the nominations page (or when giving an award), click the **write citation**
option. **Expect:** Gemini writes a short, formal award citation you could read out
at a ceremony, based on the employee's record.

### 11.4 — Edit, delete, export

- Edit an award's reason.
- Delete an award.
- Export the award list as CSV.

---

## Part 12 — Events & Meetings

Go to **Events & Meetings** (`/events`).

### 12.1 — Create an event

| Field | Sample value |
| --- | --- |
| Title | `Q3 All-Hands Meeting` |
| Type | `meeting` (options: `event`, `meeting`) |
| Description | `Quarterly business update, followed by department breakouts.` |
| Starts at | next Friday, `09:00` |
| Ends at | next Friday, `11:00` |
| Location | `Main Conference Room, 12F` |

Create a second one to test the other type:

| Field | Sample value |
| --- | --- |
| Title | `Company Christmas Party` |
| Type | `event` |
| Starts at | `2026-12-18 18:00` |
| Ends at | `2026-12-18 23:00` |
| Location | `Grand Ballroom, Shangri-La The Fort` |

**Expect:** status is derived from the dates — `upcoming`, `ongoing`, or `past`.
Make one with a date last month to see `past`.

### 12.2 — Invite people

Open the event → **Add attendees** → pick 8–10 employees.

Then set someone's response: `accepted`, `declined`, `tentative`.

### 12.3 — Send reminders

Click **Remind**. **Expect:** attendees receive a notification (check the bell icon
and, if email is working, their inbox).

### 12.4 — Calendar file

Click the **calendar / .ics** option. **Expect:** a `.ics` file downloads that opens
in Google Calendar or Outlook with the right title, time and location.

### 12.5 — Duplicate

Click **Duplicate** on the all-hands meeting. **Expect:** a copy is created with the
same details, ready to be moved to a new date. This is how you'd make a recurring meeting.

### 12.6 — Export and delete

Export the event list and one event's attendee roster. Then delete an event
(it goes to the Trash Bin).

---

## Part 13 — Offboarding (staff leaving)

Go to **Offboarding** (`/offboarding`).

### 13.1 — Start an exit

Click **Start offboarding**:

| Field | Sample value |
| --- | --- |
| Employee | pick any active employee |
| Type | `resignation` (options: `resignation`, `termination`, `retirement`, `end_of_contract`) |
| Clearance program | `Standard Clearance` (from Part 2.9) |
| Notice date | today |
| Last working day | 30 days from today |
| Reason | `Accepted an offer with better career growth. Gave the full 30-day notice.` |

**Expect:** a case is created with a clearance checklist grouped by department
(IT items together, HR items together, Finance items together).

### 13.2 — Work the clearance checklist

1. **Tick** an item as cleared. Add a note: `Laptop returned in good condition, serial SN-44821.`
2. **Untick** it.
3. **Add** a one-off item: `Return parking pass` under `Admin`.
4. Use **bulk clear** to tick everything in one department at once.
5. Use **apply program** to load a *different* clearance template onto the case.

### 13.3 — Finalise the exit

Once everything is cleared, set the case status to complete.

**Expect — the important bit:** the employee's employment status changes
automatically to match the exit type. A `resignation` makes them `resigned`;
a `termination` makes them `terminated`. Go to `/employees` and confirm.

### 13.4 — Export

Export the offboarding list, and one case's clearance sheet.

---

## Part 14 — Analytics & AI

Three prediction screens plus Reports. Find them under **Analytics & AI** in the sidebar.

> **Before you start:** Promotion Readiness and Performance Forecast need the
> prediction service running (Part 0.5). Attrition Risk does not.

### 14.1 — Attrition Risk → `/analytics/attrition`

This one is a **demonstration**. It makes up its own roster and its own scores
entirely inside your browser. There is no real model behind it, and it says so on
the page in a banner. It's here to show what a flight-risk screen would look like.

Test:

1. **Read the banner** at the top — it should plainly say the data is simulated.
2. Look at the number cards: how many assessed, how many high risk, how many at
   watch, average risk score.
3. Look at the **risk distribution bar** — the split between Stable / At watch / High risk.
4. **Search** for an employee in the ranked list.
5. **Filter by tier** — show only "High risk".
6. **Click an employee** → a dialog opens with their score, tier, and the signals
   behind it (overtime, time since last promotion, performance, training, tenure, pay).
7. Click **Run assessment**. **Expect:** a brief "assessing" spinner, then new scores
   that are slightly different from the last run.
8. Use the **history selector** to look at a previous run.
9. **Delete** a run.
10. **Refresh the page.** The runs are still there — they're saved in your browser.

> Because it saves to your browser, opening this page in a different browser or an
> incognito window gives you a fresh set. That's expected.

### 14.2 — Performance Forecast → `/analytics/performance-forecast`

This one is real. It predicts each employee's next performance rating.

1. **With the prediction service off:** you see a yellow banner saying assessments
   are temporarily unavailable, and the Run button is disabled. Past results still show.
2. **Start the service** (Part 0.5), then reload. The banner disappears.
3. Click **Run assessment**. **Expect:** after a few seconds, every active employee
   gets a forecast, sorted into bands: **Exceeds**, **On track**, **Below**.
4. Look at the number cards and the distribution.
5. **Click an employee** → a dialog with their predicted score, band, confidence,
   and a small trajectory chart of their history.
6. **Search** and **filter by band**.
7. Use the **history** selector to compare runs.
8. **Delete** a run.

### 14.3 — Promotion Readiness → `/analytics/promotion-readiness`

Same idea, different question: who is ready for a promotion.

1. Click **Run assessment**.
2. **Expect:** employees sorted into **Ready**, **Developing**, and **Not yet**.
3. **Click an employee** → their readiness score plus the **factors** behind it —
   the things pushing them up and the things holding them back.
4. Test search, tier filter, run history and delete, same as above.

### 14.4 — "Where these scores come from" (Model Graduation)

All three analytics pages have a panel underneath the header explaining where the
numbers come from. This is worth testing on its own because it's the honesty layer.

On each page:

1. **Read the provenance line.** It should say plainly whether the scores come from
   a general dataset or from this company's own history.
2. Look at the **three-stage rail**: `Provisional` → `Collecting` → `Graduated`.
   A surface starts on a borrowed model, spends time collecting local history, and
   only then trains on this company's data.
3. Look at the **requirement list**, grouped under three headings:
   - **Enough history** — do we have enough records yet?
   - **History that means the same thing** — is the data consistent?
   - **System readiness** — is the plumbing in place?
   Each requirement is `Met` (green), `In progress` (amber), or `Not started` (grey).
4. **Click a requirement.** A dialog explains what it means and what would satisfy it.
5. Look at the **field coverage** section — which pieces of information are:
   - **Used now** — already feeding the prediction
   - **Recorded, not used** — the data exists but isn't wired in yet
   - **Not recorded anywhere** — the system doesn't capture it at all

**Expect:** a locked gate reads as the system working correctly, not as an error.
Nothing here should be red or alarming.

---

## Part 15 — Reports

Go to **Reports** (`/reports`). One page: a list of reports on the left, the chosen
report on the right.

There are seven reports:

| Report | What it answers |
| --- | --- |
| **Employee Masterlist** | The full roster with department, position and standing |
| **Headcount Summary** | Active headcount per department, split by employment type |
| **Workforce Movement** | Hires and separations in a period — turnover and net growth |
| **Attendance Summary** | Per-employee attendance for a month: present days, lates, absences, hours |
| **Leave Ledger** | Leave requests in a period, by type and approval status |
| **Recruitment Pipeline** | Applications received in a period, by posting and stage |
| **Audit Trail** | A dated record of changes across the system |

For **each** report, do this:

1. **Click it in the left rail.** The report loads on the right without the whole
   page reloading.
2. **Change the filters** and watch the table, totals and charts update.
   Sample filters to try:
   - Attendance Summary → month: last month; department: `Information Technology`
   - Leave Ledger → from `2026-01-01` to `2026-12-31`; type: `Vacation Leave`
   - Workforce Movement → from `2026-01-01` to today
   - Recruitment Pipeline → from `2026-01-01` to today
3. **Check the charts** — donut and bar charts should match the table figures.
4. **Copy the URL** and open it in a new tab. **Expect:** the exact same report with
   the exact same filters — the URL is a shareable snapshot.
5. Click **Export**. **Expect:** a CSV whose numbers match what's on screen.
6. Click **AI insights**. **Expect:** a written narrative explaining what the numbers
   mean and what to do about them.

**Also check:** on Employee Masterlist, Headcount and Workforce Movement, look for
**prediction signals** pulled in from Part 14 — e.g. how many people are "Ready" for
promotion. These only appear if you've actually run an assessment first.

---

## Part 16 — The AI Assistant

There's a floating assistant button on every page inside the app. It can actually
*do* things, not just chat.

### 16.1 — Ask it questions

Open it and try these, one at a time:

```
How many employees do we have?
```
```
Who is on leave next week?
```
```
Show me the open job postings.
```
```
Which departments have the most people?
```
```
Who has a pending leave request?
```
```
Summarise our hiring pipeline for the Software Engineer role.
```
```
Which employees haven't had a performance review this period?
```

**Expect:** it looks up real data from the system and answers with real numbers.
You should see it working — a short activity indicator showing which module it's
reading from.

### 16.2 — Test the conversation features

1. **Streaming** — the answer should appear word by word, not all at once.
2. **Formatting** — ask for something list-like and check you get proper bullets,
   bold text and tables, not raw markdown symbols.
3. **Regenerate** — click regenerate on an answer and get a different phrasing.
4. **New conversation** — start a fresh one; the old one stays in the list.
5. **Rename** a conversation to `Headcount questions`.
6. **Delete** a single conversation.
7. **Clear all** conversations.
8. **Refresh the page** mid-conversation. **Expect:** your history is still there.

### 16.3 — Test that it respects permissions

The assistant is only supposed to reach modules the signed-in person is allowed to
use. Since you're an HR Manager you can see everything, so to test this properly
you'd need a second account with fewer permissions — see Part 17.2.

### 16.4 — Test the rate limit

Send messages rapidly, one after another. **Expect:** after a number of turns you
get a "slow down" message. This is deliberate — each turn costs Gemini quota.

---

## Part 17 — System administration

The **System** group in the sidebar.

### 17.1 — User Management → `/system/users`

Only one account exists after seeding, so start by making more.

**Create a user:**

| Field | Sample value |
| --- | --- |
| First name | `Patricia` |
| Last name | `Lim` |
| Email | `earlkian.dev+patricia@gmail.com` |
| Role | `Department Head` |
| Status | `active` |

> Tip: using `+something` in your own Gmail address means the verification email
> actually reaches you, so you can test the whole flow.

**Then test each of these:**

1. **Edit** the user — change their name or role.
2. **Deactivate** them, then reactivate.
3. **Reset their password** to `password123`.
4. **Resend the verification email.**
5. **Archive** them → they land in the Trash Bin → **restore** them.
6. **Permanently delete** a user you don't need.
7. **Try to deactivate or delete yourself.** **Expect:** the system refuses with a
   clear message. You cannot lock yourself out.

**Bulk actions:** tick several users and archive them all at once.

**Import from CSV:**
1. Click **Download template**. You get `users-import-template.csv` with the right
   column headings and one example row.
2. Open it and add rows like this:

   ```csv
   first_name,middle_name,last_name,suffix,email,phone,employee_no,status,role
   Jane,Q,Dela Cruz,,jane.delacruz@example.com,+63 917 000 0000,EMP-1001,active,staff
   Carlo,,Aquino,,carlo.aquino@example.com,+63 917 111 2222,EMP-1002,active,staff
   Bea,M,Fernandez,,bea.fernandez@example.com,+63 917 333 4444,EMP-1003,active,department-head
   ```

3. Upload it. **Expect:** a summary saying how many were created, how many skipped,
   and why any failed.
4. **Upload the same file again.** **Expect:** it reports duplicates rather than
   creating them twice.
5. **Upload a broken file** (delete an email address from one row). **Expect:** a
   clear error naming the row.

**Export:** click Export for a CSV of all users.

### 17.2 — Roles & Permissions → `/system/roles`

Three built-in roles ship with every company:

| Role | What they can do |
| --- | --- |
| **HR Manager** | Everything. This is the owner role — your account has it. |
| **Department Head** | Approves leave, runs performance reviews, views their team's records and prediction signals. Can't touch setup or admin. |
| **Staff** | Self-service only — clock in/out and file their own leave. |

**Test:**

1. **Open a role** and look at the permission matrix — a grid of every module against
   every action (view / create / update / delete / etc.).
2. **Create a custom role:**
   | Field | Sample value |
   | --- | --- |
   | Name | `Recruiter` |
   | Description | `Handles job postings and candidates only.` |
   | Permissions | tick everything under Recruitment, plus `employees.view` |
3. **Assign it** to Patricia Lim from 17.1.
4. **Log in as Patricia** in a private browser window (you'll need to set her
   password first via "reset password" in 17.1).
   **Expect:** her sidebar shows only Recruitment and Employees. Everything else is
   hidden. Typing `/system/users` directly into the address bar should be refused.
5. **Try to delete a built-in role.** **Expect:** refused — system roles are protected.
6. **Bulk delete** a couple of custom roles.
7. **Export** the roles list.

This is the single most important test of the whole permission system. Do it properly.

### 17.3 — Notifications → `/system/notifications`

**Test the bell:**
1. Do something that generates a notification — approve a leave request (Part 8.4)
   or send an event reminder (Part 12.3).
2. Click the **bell** in the top bar. **Expect:** an unread count and the new notification.
3. **Mark one as read.** The count drops.
4. **Mark all as read.**
5. **Delete** a notification.
6. **Clear all.**

**Send a broadcast:**

| Field | Sample value |
| --- | --- |
| Title | `System maintenance this Saturday` |
| Message | `The HR system will be unavailable from 10 PM to 12 AM on Saturday for scheduled maintenance. Please file any urgent leave requests before then.` |
| Recipients | everyone / a department / specific people |

**Test preferences:** turn email notifications off for one category, trigger that
event, and confirm no email arrives while the in-app one still does.

**Test browser push:** enable push when the browser asks for permission. Then
trigger a notification and check a desktop pop-up appears. Then disable it again.

### 17.4 — Activity Logs → `/system/activity-logs`

A read-only trail of who changed what.

1. **Look for your own actions** from earlier in this guide — the employee you
   created, the leave you approved.
2. **Filter by user**, by **module**, and by **date range**.
3. **Search** for `Joshua Mendoza`.
4. **Open a log entry** — you should see the before and after values.
5. **Export** to CSV.
6. **Delete** a single entry, then use **bulk delete**.
7. **Clear all** logs (do this last — it's destructive).

### 17.5 — Trash Bin → `/system/trash`

Everything you deleted earlier should be here.

1. **Check the tabs / type filter** — Users, Employees, Departments, Leave Types,
   Training Programs, Events, Work Schedules, and so on.
2. **Restore** an item. **Expect:** it reappears in its own module, intact.
3. **Permanently delete** one item. **Expect:** a confirmation prompt, then it's gone
   for good.
4. **Bulk restore** several items.
5. **Empty the bin.** **Expect:** a serious confirmation prompt first.

### 17.6 — Someone joining the company on their own

This tests the self-service route in. Use a private browser window.

1. Go to `/register` and create a brand new account:
   | Field | Sample value |
   | --- | --- |
   | First name | `Nathan` |
   | Last name | `Cruz` |
   | Email | `earlkian.dev+nathan@gmail.com` |
   | Password | `password123` |
2. **Expect:** a verification email. Click the link in it.
3. After verifying, **expect:** you land on a "pick your workspace" screen — Nathan
   belongs to no company yet.
4. **Enter the join code** for SYNAPSE Demo Co (from Part 2.1, e.g. `YE2XPAX`).
5. **Expect:** a request to join is submitted, and Nathan waits.
6. **Back in your HR Manager window**, go to `/employees/access`. **Expect:** Nathan
   appears as a pending join request.
7. **Approve** it — and link him to an employee record on the roster.
8. **Back in Nathan's window**, refresh. **Expect:** he's now inside SYNAPSE Demo Co
   with Staff-level access — he can clock in and file leave, and nothing else.
9. Repeat with **Decline** on a second test account to check the rejection path.

---

## Part 18 — The mobile app

The employee-facing phone app. You need a phone on the **same Wi-Fi** as your computer,
with **Expo Go** installed from the App Store / Play Store.

### 18.1 — Set it up

1. **Find your computer's IP address:**
   ```bash
   hostname -I | awk '{print $1}'
   ```
   You'll get something like `192.168.1.23`.

2. **Restart the web server so the phone can reach it:**
   ```bash
   cd server
   php artisan serve --host 0.0.0.0
   ```

3. **Point the app at your computer.** Either edit `mobile/app.json`:
   ```json
   "extra": { "apiUrl": "http://192.168.1.23:8000/api" }
   ```
   Or set it when starting:
   ```bash
   cd mobile
   npm install
   EXPO_PUBLIC_API_URL=http://192.168.1.23:8000/api npx expo start
   ```

4. **Scan the QR code** with Expo Go.

### 18.2 — Test the app

Sign in with the same account: `earlkian.dev@gmail.com` / `password`.

Go through each screen:

**Home**
- Today's clock status, quick action buttons, leave balances, your latest award.

**Clock (DTR)**
- A live clock and today's shift.
- Tap **Time In**. It asks for **location permission** — allow it. It may also offer
  a **selfie** — try both taking one and skipping it.
- Tap **Break Start**, **Break End**, then **Time Out**.
- Watch the worked-hours counter tick up live.
- **Then check on the web:** go to `/attendance` on your computer and confirm the
  punches you just made on the phone are there.

**Attendance**
- A month calendar with a coloured dot per day.
- A summary card with the month's totals.
- Tap a day → the punch timeline for that day.
- Switch to the list view.

**Leave**
- View your balances.
- **File a leave request:**
  | Field | Sample value |
  | --- | --- |
  | Type | `Vacation Leave` |
  | Start | next Tuesday |
  | End | next Thursday |
  | Reason | `Filed from the mobile app for testing.` |
- **Expect:** the app computes the number of days for you.
- **Then check on the web:** it should be sitting in the approval inbox at `/leave`.
- **Cancel** the request from the phone.

**Profile & Awards**
- Your 201 profile, with ID numbers partly hidden.
- Your recognitions.

**Polish to check throughout:** pull down to refresh on each screen, loading
skeletons while data arrives, empty states when there's nothing, toast messages
after actions, and switching your phone between light and dark mode.

### 18.3 — Multiple companies on mobile

Since your account belongs to both SYNAPSE Demo Co and SYNAPSE Labs, look for a
workspace switcher in the app. Switch to SYNAPSE Labs. **Expect:** completely
different attendance and leave data.

---

## Part 19 — Multiple companies (workspace switching)

Your login belongs to two companies. This tests that data from one never leaks
into the other.

1. **Look at the top of the sidebar** — there's a company switcher because you
   belong to more than one.
2. **Note some figures** in SYNAPSE Demo Co: number of employees, number of job
   postings, a few employee names.
3. **Switch to SYNAPSE Labs.**
4. **Expect:**
   - Different employees, different departments.
   - No job postings, no leave requests from the first company.
   - The company name and logo at the top change.
5. **Go through several modules** in SYNAPSE Labs and confirm nothing from Demo Co
   appears anywhere.
6. **Switch back.** Everything should be as you left it.
7. **Log out and back in.** **Expect:** you land in your default company, or on the
   workspace picker at `/workspaces`.

---

## Appendix A — Things that are known not to work

Two links exist in the sidebar but have no page behind them yet. Clicking them will
give you an error, and that is a known gap, not something you broke:

- **Company Setup → Email & Notifications** (`/setup/notifications`)
- **System → Data Backup & Export** (`/system/backup`)

Also worth knowing:

- **Attrition Risk** is a demonstration only. Its data is invented in your browser
  and there is no model behind it. The page says so itself.
- **Promotion Readiness** and **Performance Forecast** are real, but they are trained
  on a general workforce dataset, not on this company's own history. The "Where these
  scores come from" panel on each page explains exactly that.
- **AI features** (assistant, insights, citations) need a working internet connection
  and a valid Gemini API key. Without one you should get a graceful error, not a crash.
- **Emails** go through Brevo. If the SMTP credentials in `server/.env` have expired,
  verification and invitation emails won't arrive. You can switch to
  `MAIL_MAILER=log` in `server/.env` and read the emails in
  `server/storage/logs/laravel.log` instead.

---

## Appendix B — Resetting back to a clean demo

If you break something or want to start over:

```bash
cd server
php artisan migrate:fresh --seed
```

This wipes everything and rebuilds the demo company from scratch. Your login stays
the same: `earlkian.dev@gmail.com` / `password`.

**Note:** Attrition Risk runs are stored in your *browser*, not the database, so
re-seeding won't clear them. To clear those, open your browser's developer tools →
Application → Local Storage → delete `synapse:attrition-risk:runs`.

---

## Appendix C — Full checklist

Tick these off as you go.

**Account**
- [ ] Log in / log out
- [ ] Wrong password is refused
- [ ] Edit profile, upload photo
- [ ] Switch light / dark theme
- [ ] Change password
- [ ] Two-factor authentication
- [ ] Passkey

**Company Setup**
- [ ] Company profile + logo
- [ ] Rotate the join code
- [ ] Departments — add, nest, assign a head, delete
- [ ] Positions
- [ ] Work schedules
- [ ] Holidays
- [ ] Leave types — add, deactivate
- [ ] Award types
- [ ] Rating scale, criteria, framework, review period
- [ ] Recruitment pipeline — create, reorder stages
- [ ] Onboarding program
- [ ] Offboarding program

**Hiring**
- [ ] Create a job posting
- [ ] Draft postings stay off the public page
- [ ] Add an applicant with a CV and documents
- [ ] Drag a candidate across the board
- [ ] Table view
- [ ] Fit score
- [ ] AI candidate insights
- [ ] Schedule / edit / delete an interview
- [ ] Reject a candidate
- [ ] Hire → becomes an employee
- [ ] Export

**Public careers**
- [ ] Careers landing page
- [ ] A company's job board
- [ ] Apply with a CV, without logging in
- [ ] Application shows up in the pipeline
- [ ] Rate limit blocks repeat submissions

**Onboarding**
- [ ] Start a case from a program
- [ ] Tick / untick tasks
- [ ] Add, edit, delete a task
- [ ] Auto-complete when all tasks are done

**Employees**
- [ ] Search, filter, sort, page
- [ ] Create an employee
- [ ] Validation refuses bad data
- [ ] 201 file tabs
- [ ] Upload a document and a certification
- [ ] Change employment status
- [ ] Bulk archive
- [ ] Invite someone to get a login
- [ ] Revoke an invitation
- [ ] Export

**Attendance**
- [ ] Clock in, break, clock out
- [ ] Grace period — 08:12 is not late, 08:31 is
- [ ] Add a record by hand
- [ ] Edit, approve, approve all, delete
- [ ] Export

**Leave**
- [ ] File a request
- [ ] Weekends are not charged
- [ ] Holidays are not charged
- [ ] Half-day counts as 0.5
- [ ] Approve, reject, cancel
- [ ] Balances go down on approval and back up on cancel
- [ ] Set entitlements
- [ ] Bad date ranges are refused

**Performance**
- [ ] Launch a review cycle for departments
- [ ] Launch one for everyone
- [ ] Create a single evaluation
- [ ] Score it — overall is weighted correctly
- [ ] Submit locks it
- [ ] Acknowledge
- [ ] AI insights
- [ ] Export

**Training**
- [ ] Create a program
- [ ] Status derives from the dates
- [ ] Enrol people
- [ ] Capacity limit works
- [ ] Update results, bulk update
- [ ] AI insights
- [ ] Export roster
- [ ] Delete and restore

**Awards**
- [ ] Give an award
- [ ] Future dates are refused
- [ ] Nominations page
- [ ] AI citation
- [ ] Edit, delete, export

**Events**
- [ ] Create an event and a meeting
- [ ] Status derives from the dates
- [ ] Add attendees, set responses
- [ ] Send reminders
- [ ] Download the calendar file
- [ ] Duplicate
- [ ] Export, delete

**Offboarding**
- [ ] Start an exit
- [ ] Clearance checklist is grouped by department
- [ ] Tick items, add notes, add an item
- [ ] Bulk clear
- [ ] Apply a different program
- [ ] Finalising updates the employee's status
- [ ] Export

**Analytics**
- [ ] Attrition Risk — banner, run, history, detail, delete, survives refresh
- [ ] Performance Forecast — warning when the service is off
- [ ] Performance Forecast — run, bands, detail, trajectory, history
- [ ] Promotion Readiness — run, tiers, factors, history
- [ ] Model graduation panel — stages, requirements, requirement dialog, field coverage

**Reports**
- [ ] All seven reports load
- [ ] Filters change the results
- [ ] Charts match the table
- [ ] The URL is shareable and reproducible
- [ ] CSV export matches the screen
- [ ] AI insights
- [ ] Prediction signals appear after running an assessment

**Assistant**
- [ ] Answers with real data
- [ ] Answer streams in
- [ ] Markdown renders properly
- [ ] Regenerate
- [ ] New / rename / delete / clear conversations
- [ ] History survives a refresh
- [ ] Rate limit kicks in

**System**
- [ ] Create, edit, deactivate, reset password, archive, restore, delete a user
- [ ] You cannot delete or deactivate yourself
- [ ] Bulk user actions
- [ ] CSV import — template, good file, duplicate file, broken file
- [ ] Permission matrix
- [ ] Create a custom role and log in as it
- [ ] Built-in roles cannot be deleted
- [ ] Notifications — bell, read, delete, clear
- [ ] Broadcast a notification
- [ ] Notification preferences
- [ ] Browser push
- [ ] Activity logs — filter, search, detail, export, delete, clear
- [ ] Trash — restore, permanently delete, bulk restore, empty

**Self-service join**
- [ ] Register a new account
- [ ] Verify the email
- [ ] Enter a join code
- [ ] Approve the request as HR
- [ ] Decline a request

**Mobile**
- [ ] Log in
- [ ] Home screen
- [ ] Clock in / break / clock out with GPS and selfie
- [ ] Punches appear on the web
- [ ] Attendance calendar, summary, day timeline
- [ ] File leave, see it on the web, cancel it
- [ ] Profile and awards
- [ ] Pull to refresh, light / dark mode
- [ ] Switch companies

**Multiple companies**
- [ ] Switch between the two companies
- [ ] No data leaks between them
- [ ] Log out and back in lands correctly
