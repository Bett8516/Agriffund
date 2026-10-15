# AgriFund

An early-stage, responsive AgriFund web app for farmers to request an explainable agricultural finance readiness assessment. The prototype has one shared Supabase Auth sign-up/sign-in flow with role-specific profile fields for farmers, extension officers, banks and administrators.

## Run the app

Open `index.html` in a browser, or serve this folder from a local static server. The assessment calls the NASA POWER daily point endpoint directly from the browser, so network access is needed for live climate data. Without Supabase credentials, sign-up and score history use local browser storage as a demo. The demo password is not retained or checked; it is not an authentication system.

## Connect Supabase

1. Create a Supabase project.
2. Run [`supabase-schema.sql`](supabase-schema.sql) in the Supabase SQL editor.
3. In Supabase Auth settings, enable email/password sign-in and configure the site URL and email confirmation redirect URLs.
4. Set the project URL and **public anon key** in `config.js`. Never put the service-role key in browser code.
5. Serve the app over HTTPS in production.

The SQL trigger creates one profile row per Auth user. Role is a profile attribute; all people use the same Auth system. Bank and administrator registrations remain `pending` until an existing active administrator approves them. Approval must be performed through a trusted administrator workflow or SQL editor. The provided policies prevent users from changing their own role or access status. Assessment rows are private to the farmer unless a farmer creates an explicit assessment share to an active bank.

## Profile fields

- **Farmer:** full name, national ID, phone, county, preferred payment method and M-Pesa number when relevant.
- **Administrator:** full name, official email, phone, employee ID and department.
- **Extension officer:** full name, phone, email, staff/employer ID, organization/institution, county, verification status and specialization.
- **Bank:** bank name, registration, head office address, official email and phone, partnership status.

These fields contain sensitive personal and organizational information. A production deployment should add consent and retention rules, encryption and backups, independent security review, strong administrator MFA, verification processes, audit logging, and a trusted service-side flow for role approvals. The demo form deliberately does not collect ID uploads or bank credentials.

## AgriScore and evidence report

AgriScore is an **indicative readiness score out of 100**, not a credit approval or an estimated probability that a farmer will repay. The climate section is exactly 20 points: rainfall suitability (7), temperature suitability (5), drought/extreme-weather exposure (5) and environmental resilience (3). The other 80 points cover farm plan/production (25), market/income outlook (15), repayment capacity (20), financial track record (10) and risk buffers (10). See the in-app rubric for criteria.

The prototype requests NASA POWER daily Agroclimatology (`AG`) values for `PRECTOTCORR`, `T2M`, `T2M_MAX` and `T2M_MIN` at the farm coordinates. It sums the selected calendar months across the last three complete calendar years, uses precipitation and temperature as climate proxies, and lists the request period, observations, calculations and limitations in the printable report. Kenya long-rains and short-rains options select Mar–May and Oct–Dec respectively. Climate defaults for common crops are indicative and should be replaced with locally validated extension guidance. NASA POWER is gridded historical analysis data; it is not plot-level monitoring or a seasonal forecast.

The report cannot prove that a farmer **cannot default**. No processed dataset can guarantee future repayment. AgriFund instead reports the stated seasonal surplus, outstanding obligations, repayment coverage proxy, data source, assumptions, missing evidence and uncertainty. The score is deterministic and uncalibrated; it must not be presented as a default probability. Farmer-entered inputs are unverified. A real lender should independently verify material evidence, explain adverse factors, provide an appeal path, monitor disparate impacts, and keep credit decisions with accountable human reviewers.

### Production hardening before financial use

- Recalculate and validate assessments server-side (for example, a Supabase Edge Function). The browser prototype currently calculates scores and submits the report, so a determined client could alter the values sent to the database.
- Add a verified invitation or approval workflow for privileged roles; never promote accounts based only on their requested role.
- Add farmer-controlled bank sharing UI around `assessment_shares`, revocation and expiry; table policies establish the intended boundary but this UI is not part of the prototype yet.
- Replace the generic crop defaults and simple heuristics with agronomist-reviewed, locally grounded rules and historical validation data.
- Do not claim this score can establish that a borrower cannot default.

## Data sources

- [Supabase Auth documentation](https://supabase.com/docs/guides/auth)
- [NASA POWER API documentation](https://power.larc.nasa.gov/api/pages/)
- [NASA POWER daily API OpenAPI specification](https://power.larc.nasa.gov/api/temporal/daily/openapi.json)
