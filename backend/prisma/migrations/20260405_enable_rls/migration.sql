-- Enable Row Level Security on ALL tables
-- The backend connects via service_role or direct connection (bypasses RLS),
-- so this only blocks unauthorized access through Supabase's public REST/GraphQL API.

-- Auth & Users
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "backup_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webauthn_credentials" ENABLE ROW LEVEL SECURITY;

-- Organization
ALTER TABLE "companies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hr_managers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recruiter_manager_assignments" ENABLE ROW LEVEL SECURITY;

-- Candidate Reports
ALTER TABLE "candidate_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "candidate_report_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "candidate_stage_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;

-- Duplicates
ALTER TABLE "duplicate_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "duplicate_group_members" ENABLE ROW LEVEL SECURITY;

-- Notifications
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;

-- Reports & Analytics
ALTER TABLE "generated_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_report_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scheduled_report_recipients" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "report_delivery_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "analytics_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_health_logs" ENABLE ROW LEVEL SECURITY;

-- Attendance & Leave
ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "holidays" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_balance_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_policy_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "leave_records" ENABLE ROW LEVEL SECURITY;

-- Documents
ALTER TABLE "document_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "employee_document_history" ENABLE ROW LEVEL SECURITY;

-- HR
ALTER TABLE "offer_letters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "recruiter_targets" ENABLE ROW LEVEL SECURITY;

-- Audit & Admin
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "archived_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dropdown_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_endpoints" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Policy: Allow the postgres role (used by backend) full access
-- ============================================================
-- The backend connects as the "postgres" role which has superuser
-- privileges, so it bypasses RLS automatically. No explicit policy
-- needed for the backend.
--
-- If you later use Supabase Auth + client-side access, add
-- granular policies per table as needed.
-- ============================================================
