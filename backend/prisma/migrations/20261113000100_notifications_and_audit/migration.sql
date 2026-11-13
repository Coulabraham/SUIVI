BEGIN;
CREATE INDEX notifications_feed_idx ON public.notifications(recipient_id,created_at DESC,id DESC);
CREATE INDEX audit_logs_timeline_idx ON public.audit_logs(occurred_at DESC,id DESC);
ALTER TABLE public.notifications ADD CONSTRAINT notifications_valid_content CHECK (
  length(btrim(title)) > 0 AND length(btrim(message)) > 0 AND length(btrim(event_key)) > 0
  AND (read_at IS NULL OR read_at >= created_at));

CREATE FUNCTION public.suivi_notification_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'read_at') IS DISTINCT FROM (to_jsonb(OLD) - 'read_at')
    OR (OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at) THEN
    RAISE EXCEPTION 'Notification content and existing receipt are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER notification_receipt_guard BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.suivi_notification_receipt_guard();
CREATE TRIGGER notification_preserve_history BEFORE DELETE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.suivi_reject_change();
REVOKE ALL ON FUNCTION public.suivi_notification_receipt_guard() FROM PUBLIC;
COMMIT;
