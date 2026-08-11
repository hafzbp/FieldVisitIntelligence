# Security

## Public frontend values
Allowed in GitHub:
- Supabase Project URL
- Supabase Publishable Key

Not allowed in GitHub/frontend:
- Supabase Secret key
- legacy service_role key
- database password
- user password

## RLS
RLS is enabled on application tables.
JOVIS row access is constrained by authenticated user ownership.
Admin access is enforced server-side using an admin profile check.

## First Admin bootstrap
The first Admin role is promoted through the Supabase Dashboard after the migration creates the profile.
Normal users cannot promote themselves through the app.

## Audit
Call updates write old/new JSON into `call_edit_history` with changer identity and timestamp.

## Validation
Free text is escaped before UI rendering.
Database CHECK constraints validate result/reason/omzet requirements.
