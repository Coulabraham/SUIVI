BEGIN;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO suivi_app;
GRANT SELECT ON public.users,public.departments,public.members,public.member_department_periods,
  public.objectives,public.collection_weeks,public.payments,public.payment_revisions,public.payment_adjustments,
  public.devices,public.sessions,public.refresh_tokens,public.sync_operations,public.sync_scopes,public.sync_changes,
  public.notifications,public.audit_logs,public.payment_balances TO suivi_app;
GRANT INSERT,UPDATE ON public.users,public.departments,public.members,public.member_department_periods,
  public.objectives,public.collection_weeks,public.devices,public.sessions,public.refresh_tokens,public.sync_operations TO suivi_app;
GRANT INSERT ON public.payments,public.payment_revisions,public.audit_logs,public.sync_changes,public.sync_scopes,public.notifications TO suivi_app;
GRANT UPDATE(read_at) ON public.notifications TO suivi_app;
GRANT UPDATE(generation,min_available_sequence) ON public.sync_scopes TO suivi_app;

-- Pas d'accès direct à la table de suivi des migrations, pas de DELETE/TRUNCATE métier,
-- pas d'UPDATE du paiement d'origine ni d'INSERT manuel d'un ajustement.
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT p.oid::regprocedure AS signature FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'suivi_%'
  LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',item.signature); END LOOP;
END $$;
COMMIT;
