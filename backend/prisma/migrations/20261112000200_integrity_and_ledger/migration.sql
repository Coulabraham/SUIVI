BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_department CHECK (
    (role = 'SUPER_ADMIN' AND department_id IS NULL) OR
    (role = 'MANAGER' AND department_id IS NOT NULL)),
  ADD CONSTRAINT users_login_nonblank CHECK (length(btrim(login_identifier)) > 0 AND length(btrim(login_normalized)) > 0),
  ADD CONSTRAINT users_versions_positive CHECK (version > 0 AND credential_version > 0 AND authz_version > 0),
  ADD CONSTRAINT users_password_argon2id CHECK (password_hash ~ '^\$argon2id\$v=19\$m=[0-9]+,t=[0-9]+,p=[0-9]+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$');
CREATE UNIQUE INDEX users_one_active_manager ON public.users(department_id)
  WHERE role = 'MANAGER' AND status = 'ACTIVE';

ALTER TABLE public.departments ADD CONSTRAINT departments_valid CHECK (version > 0 AND length(btrim(name)) > 0);
ALTER TABLE public.members ADD CONSTRAINT members_valid CHECK (
  version > 0 AND length(btrim(member_number)) > 0 AND length(btrim(first_name)) > 0 AND length(btrim(last_name)) > 0);
ALTER TABLE public.member_department_periods
  ADD CONSTRAINT member_period_dates CHECK (ends_at IS NULL OR ends_at > starts_at),
  ADD CONSTRAINT member_period_no_overlap EXCLUDE USING gist
    (member_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&);
CREATE UNIQUE INDEX member_period_one_open ON public.member_department_periods(member_id) WHERE ends_at IS NULL;

ALTER TABLE public.objectives ADD CONSTRAINT objectives_valid CHECK (
  target_amount > 0 AND ends_on >= starts_on AND version > 0 AND length(btrim(name)) > 0),
  ADD CONSTRAINT objectives_closed_at CHECK ((status = 'CLOSED') = (closed_at IS NOT NULL));
CREATE UNIQUE INDEX objectives_one_current ON public.objectives((true)) WHERE status IN ('ACTIVE', 'SUSPENDED');
ALTER TABLE public.collection_weeks
  ADD CONSTRAINT collection_weeks_valid CHECK (
    number > 0 AND ends_on >= starts_on AND ends_on - starts_on <= 6 AND
    (collection_on IS NULL OR (collection_on BETWEEN starts_on AND ends_on AND extract(dow FROM collection_on) = 0))),
  ADD CONSTRAINT collection_weeks_no_overlap EXCLUDE USING gist
    (objective_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&);

ALTER TABLE public.payments ADD CONSTRAINT payments_valid CHECK (
  original_amount > 0 AND version > 0 AND length(btrim(method)) > 0 AND length(btrim(member_label_snapshot)) > 0);
ALTER TABLE public.payment_revisions ADD CONSTRAINT payment_revisions_valid CHECK (
  revision_number > 0 AND length(btrim(reason)) > 0 AND previous_amount > 0 AND
  length(btrim(previous_method)) > 0 AND length(btrim(new_method)) > 0 AND
  jsonb_typeof(before_value) = 'object' AND jsonb_typeof(after_value) = 'object' AND
  ((kind = 'CORRECTION' AND new_amount > 0) OR (kind = 'CANCELLATION' AND new_amount = 0)));
ALTER TABLE public.payment_adjustments ADD CONSTRAINT payment_adjustments_nonzero CHECK (delta_amount <> 0);
ALTER TABLE public.devices ADD CONSTRAINT devices_revocation CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL));
ALTER TABLE public.sessions ADD CONSTRAINT sessions_valid CHECK (
  expires_at > created_at AND credential_version > 0 AND authz_version > 0);
ALTER TABLE public.refresh_tokens ADD CONSTRAINT refresh_tokens_valid CHECK (
  token_hash ~ '^[0-9a-f]{64}$' AND expires_at > created_at AND (consumed_at IS NULL OR consumed_at >= created_at));
ALTER TABLE public.sync_operations ADD CONSTRAINT sync_operations_valid CHECK (
  request_hash ~ '^[0-9a-f]{64}$' AND contract_version > 0 AND scope_generation > 0 AND authz_version > 0 AND
  (base_version IS NULL OR base_version > 0) AND jsonb_typeof(payload) = 'object' AND
  ((status = 'PROCESSING' AND completed_at IS NULL) OR (status <> 'PROCESSING' AND completed_at IS NOT NULL)));
ALTER TABLE public.sync_scopes ADD CONSTRAINT sync_scopes_valid CHECK (
  sequence >= 0 AND generation > 0 AND min_available_sequence BETWEEN 0 AND sequence AND
  ((department_id IS NULL AND key = 'GLOBAL') OR
   (department_id IS NOT NULL AND key = 'DEPARTMENT:' || department_id::text)));
ALTER TABLE public.sync_changes ADD CONSTRAINT sync_changes_valid CHECK (sequence > 0 AND entity_version > 0);
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_actor_consistent CHECK ((actor_id IS NULL) = (actor_role IS NULL)),
  ADD CONSTRAINT audit_logs_no_secret_fields CHECK (
    coalesce(before_value, '{}'::jsonb)::text !~* '"(password|password_hash|passwordHash|refresh_token|refreshToken|token_hash|tokenHash|access_token|accessToken)"[[:space:]]*:' AND
    coalesce(after_value, '{}'::jsonb)::text !~* '"(password|password_hash|passwordHash|refresh_token|refreshToken|token_hash|tokenHash|access_token|accessToken)"[[:space:]]*:');
CREATE UNIQUE INDEX audit_financial_event_unique ON public.audit_logs(action, entity_type, entity_id)
  WHERE outcome = 'SUCCESS' AND action IN ('PAYMENT_CREATED', 'PAYMENT_CORRECTED', 'PAYMENT_CANCELLED');

CREATE FUNCTION public.suivi_reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Immutable history: %.%', TG_TABLE_NAME, TG_OP USING ERRCODE = '23514';
END $$;

CREATE FUNCTION public.suivi_increment_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'Expected next entity version' USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := transaction_timestamp();
  RETURN NEW;
END $$;

DO $$ DECLARE item text; BEGIN
  FOREACH item IN ARRAY ARRAY['users','departments','members','objectives'] LOOP
    EXECUTE format('CREATE TRIGGER enforce_version BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.suivi_increment_version()', item);
  END LOOP;
  FOREACH item IN ARRAY ARRAY['users','departments','members','member_department_periods','objectives','collection_weeks','payments'] LOOP
    EXECUTE format('CREATE TRIGGER preserve_history BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.suivi_reject_change()', item);
  END LOOP;
  FOREACH item IN ARRAY ARRAY['payment_revisions','payment_adjustments','audit_logs','sync_changes'] LOOP
    EXECUTE format('CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.suivi_reject_change()', item);
  END LOOP;
END $$;

CREATE FUNCTION public.suivi_member_period_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM public.members WHERE id = NEW.member_id FOR UPDATE;
  IF TG_OP = 'UPDATE' AND (NEW.id <> OLD.id OR NEW.member_id <> OLD.member_id OR
    NEW.department_id <> OLD.department_id OR NEW.starts_at <> OLD.starts_at OR OLD.ends_at IS NOT NULL) THEN
    RAISE EXCEPTION 'An affiliation can only be closed once' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER member_period_guard BEFORE INSERT OR UPDATE ON public.member_department_periods
  FOR EACH ROW EXECUTE FUNCTION public.suivi_member_period_guard();

CREATE FUNCTION public.suivi_check_current_affiliation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE member_uuid uuid; current_department uuid; open_count integer;
BEGIN
  IF TG_TABLE_NAME = 'members' THEN member_uuid := NEW.id; ELSE member_uuid := NEW.member_id; END IF;
  SELECT department_id INTO current_department FROM public.members WHERE id = member_uuid FOR UPDATE;
  SELECT count(*) INTO open_count FROM public.member_department_periods
    WHERE member_id = member_uuid AND ends_at IS NULL AND department_id = current_department;
  IF open_count <> 1 THEN
    RAISE EXCEPTION 'Member must have exactly one matching current affiliation' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER member_current_affiliation AFTER INSERT OR UPDATE ON public.members
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.suivi_check_current_affiliation();
CREATE CONSTRAINT TRIGGER period_current_affiliation AFTER INSERT OR UPDATE ON public.member_department_periods
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.suivi_check_current_affiliation();

CREATE FUNCTION public.suivi_objective_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'Unknown campaign timezone' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.collection_weeks WHERE objective_id = NEW.id AND
    (starts_on < NEW.starts_on OR ends_on > NEW.ends_on)) THEN
    RAISE EXCEPTION 'Campaign boundaries exclude existing collection weeks' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER objective_guard BEFORE INSERT OR UPDATE ON public.objectives
  FOR EACH ROW EXECUTE FUNCTION public.suivi_objective_guard();

CREATE FUNCTION public.suivi_week_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE campaign public.objectives%ROWTYPE;
BEGIN
  SELECT * INTO campaign FROM public.objectives WHERE id = NEW.objective_id FOR SHARE;
  IF NOT FOUND OR NEW.starts_on < campaign.starts_on OR NEW.ends_on > campaign.ends_on THEN
    RAISE EXCEPTION 'Collection week is outside its campaign' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
    RAISE EXCEPTION 'Existing collection week boundaries are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER week_guard BEFORE INSERT OR UPDATE ON public.collection_weeks
  FOR EACH ROW EXECUTE FUNCTION public.suivi_week_guard();

CREATE FUNCTION public.suivi_payment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE member_row public.members%ROWTYPE; actor_row public.users%ROWTYPE;
  campaign public.objectives%ROWTYPE; week_row public.collection_weeks%ROWTYPE;
  period_row public.member_department_periods%ROWTYPE; local_date date;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - ARRAY['status','version']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','version'])
      OR NEW.version <> OLD.version + 1 THEN
      RAISE EXCEPTION 'Payment origin is immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO actor_row FROM public.users WHERE id = NEW.collected_by_id FOR SHARE;
  IF NOT FOUND OR actor_row.status <> 'ACTIVE' OR
    (actor_row.role = 'MANAGER' AND actor_row.department_id IS DISTINCT FROM NEW.department_id) THEN
    RAISE EXCEPTION 'Invalid collector scope' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.departments WHERE id = NEW.department_id AND status = 'ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inactive department' USING ERRCODE = '23514'; END IF;
  SELECT * INTO member_row FROM public.members WHERE id = NEW.member_id FOR UPDATE;
  IF NOT FOUND OR member_row.status <> 'ACTIVE' OR member_row.department_id <> NEW.department_id THEN
    RAISE EXCEPTION 'Inactive or out-of-scope member' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO period_row FROM public.member_department_periods WHERE id = NEW.affiliation_id;
  IF NOT FOUND OR period_row.ends_at IS NOT NULL OR NEW.collected_at < period_row.starts_at THEN
    RAISE EXCEPTION 'Invalid current affiliation' USING ERRCODE = '23514';
  END IF;
  SELECT * INTO campaign FROM public.objectives WHERE id = NEW.objective_id FOR SHARE;
  SELECT * INTO week_row FROM public.collection_weeks WHERE id = NEW.collection_week_id FOR SHARE;
  IF campaign.id IS NULL OR week_row.id IS NULL OR campaign.status <> 'ACTIVE' OR week_row.status <> 'OPEN' THEN
    RAISE EXCEPTION 'Campaign or collection week is not open' USING ERRCODE = '23514';
  END IF;
  local_date := (NEW.collected_at AT TIME ZONE campaign.timezone)::date;
  IF local_date NOT BETWEEN week_row.starts_on AND week_row.ends_on OR NEW.status <> 'VALIDATED' OR NEW.version <> 1 THEN
    RAISE EXCEPTION 'Invalid payment date or initial state' USING ERRCODE = '23514';
  END IF;
  PERFORM 1 FROM public.devices WHERE id = NEW.origin_device_id AND user_id = NEW.collected_by_id AND status = 'ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid origin device' USING ERRCODE = '23514'; END IF;
  NEW.received_at := transaction_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER payment_guard BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.suivi_payment_guard();

CREATE FUNCTION public.suivi_revision_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public AS $$
DECLARE payment_row public.payments%ROWTYPE; balance numeric; effective_method text;
BEGIN
  PERFORM 1 FROM public.users WHERE id = NEW.actor_id AND role = 'SUPER_ADMIN' AND status = 'ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'An active Super Administrator is required' USING ERRCODE = '23514'; END IF;
  SELECT * INTO payment_row FROM public.payments WHERE id = NEW.payment_id FOR UPDATE;
  IF NOT FOUND OR payment_row.status <> 'VALIDATED' OR payment_row.version <> NEW.revision_number THEN
    RAISE EXCEPTION 'Payment revision conflict' USING ERRCODE = '40001';
  END IF;
  SELECT payment_row.original_amount::numeric + coalesce(sum(delta_amount),0)
    INTO balance FROM public.payment_adjustments WHERE payment_id = NEW.payment_id;
  SELECT new_method INTO effective_method FROM public.payment_revisions WHERE payment_id = NEW.payment_id ORDER BY revision_number DESC LIMIT 1;
  IF NEW.previous_amount <> balance OR NEW.previous_method <> coalesce(effective_method, payment_row.method) THEN
    RAISE EXCEPTION 'Revision does not match the current payment balance' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER revision_guard BEFORE INSERT ON public.payment_revisions FOR EACH ROW EXECUTE FUNCTION public.suivi_revision_guard();

-- Seul ce trigger détenu par le rôle de migration écrit les ajustements et la projection.
CREATE FUNCTION public.suivi_apply_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.new_amount <> NEW.previous_amount THEN
    INSERT INTO public.payment_adjustments(id,payment_id,revision_id,delta_amount)
      VALUES (gen_random_uuid(),NEW.payment_id,NEW.id,NEW.new_amount - NEW.previous_amount);
  END IF;
  UPDATE public.payments SET version = version + 1,
    status = CASE WHEN NEW.kind = 'CANCELLATION' THEN 'CANCELLED'::public."PaymentStatus" ELSE 'VALIDATED'::public."PaymentStatus" END
    WHERE id = NEW.payment_id;
  RETURN NULL;
END $$;
CREATE TRIGGER apply_revision AFTER INSERT ON public.payment_revisions FOR EACH ROW EXECUTE FUNCTION public.suivi_apply_revision();

CREATE FUNCTION public.suivi_financial_audit_required() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event_action text; event_type text; event_actor uuid; event_department uuid;
BEGIN
  IF TG_TABLE_NAME = 'payments' THEN
    event_action := 'PAYMENT_CREATED'; event_type := 'Payment'; event_actor := NEW.collected_by_id; event_department := NEW.department_id;
  ELSE
    event_action := CASE WHEN NEW.kind = 'CANCELLATION' THEN 'PAYMENT_CANCELLED' ELSE 'PAYMENT_CORRECTED' END;
    event_type := 'PaymentRevision'; event_actor := NEW.actor_id;
    SELECT department_id INTO event_department FROM public.payments WHERE id = NEW.payment_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE entity_id = NEW.id AND entity_type = event_type
    AND action = event_action AND actor_id = event_actor AND department_id = event_department AND outcome = 'SUCCESS') THEN
    RAISE EXCEPTION 'Financial mutation requires an audit in the same transaction' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER payment_audit_required AFTER INSERT ON public.payments
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.suivi_financial_audit_required();
CREATE CONSTRAINT TRIGGER revision_audit_required AFTER INSERT ON public.payment_revisions
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.suivi_financial_audit_required();

CREATE FUNCTION public.suivi_allocate_sync_sequence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public AS $$
BEGIN
  UPDATE public.sync_scopes SET sequence = sequence + 1 WHERE id = NEW.scope_id RETURNING sequence INTO NEW.sequence;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown synchronization scope' USING ERRCODE = '23503'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER allocate_sync_sequence BEFORE INSERT ON public.sync_changes
  FOR EACH ROW EXECUTE FUNCTION public.suivi_allocate_sync_sequence();

CREATE FUNCTION public.suivi_device_owner_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Device ownership is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER device_owner_immutable BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.suivi_device_owner_immutable();

CREATE FUNCTION public.suivi_audit_actor_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor_role_value public."UserRole";
BEGIN
  IF NEW.actor_id IS NOT NULL THEN
    SELECT role INTO actor_role_value FROM public.users WHERE id=NEW.actor_id FOR SHARE;
    IF actor_role_value IS DISTINCT FROM NEW.actor_role THEN
      RAISE EXCEPTION 'Audit actor role does not match the current actor' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER audit_actor_guard BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.suivi_audit_actor_guard();

CREATE FUNCTION public.suivi_sync_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'PROCESSING' OR (to_jsonb(NEW) - ARRAY['status','result_code','result_data','completed_at'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','result_code','result_data','completed_at']) THEN
    RAISE EXCEPTION 'Synchronization request and terminal receipt are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_receipt_guard BEFORE UPDATE ON public.sync_operations FOR EACH ROW EXECUTE FUNCTION public.suivi_sync_receipt_guard();

CREATE VIEW public.payment_balances WITH (security_barrier = true) AS
  SELECT p.id, p.member_id, p.department_id, p.objective_id, p.collection_week_id, p.collected_at, p.status,
    p.original_amount::numeric + coalesce(a.total,0) AS effective_amount,
    coalesce((SELECT r.new_method FROM public.payment_revisions r WHERE r.payment_id=p.id ORDER BY r.revision_number DESC LIMIT 1),p.method) AS effective_method
  FROM public.payments p LEFT JOIN (SELECT payment_id,sum(delta_amount) AS total FROM public.payment_adjustments GROUP BY payment_id) a ON a.payment_id=p.id;

COMMIT;
