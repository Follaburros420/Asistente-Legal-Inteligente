-- Harden wompi_webhook_events with explicit deny policies for non-service roles.
-- Service role bypasses RLS and keeps access for webhook processing.

drop policy if exists "wompi_webhook_events_no_access_authenticated"
  on public.wompi_webhook_events;

drop policy if exists "wompi_webhook_events_no_access_anon"
  on public.wompi_webhook_events;

create policy "wompi_webhook_events_no_access_authenticated"
  on public.wompi_webhook_events
  as restrictive
  for all
  to authenticated
  using (false)
  with check (false);

create policy "wompi_webhook_events_no_access_anon"
  on public.wompi_webhook_events
  as restrictive
  for all
  to anon
  using (false)
  with check (false);

