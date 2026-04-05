"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Edit3, Save, X, Clock, ChevronRight, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Tabs,
  FormField,
  Input,
  Select,
  DatePicker,
  Textarea,
  Spinner,
  ConfirmDialog,
} from "@/components/ui";
import type { SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { updateCandidate } from "@/services/candidate.service";

// ──────────────────────────────────────────────
//  Admin — Candidate Detail / Edit Page
//  Gap #2: /admin/reports/[id]
//  4-tab interface with zone-aware fields
// ──────────────────────────────────────────────

// ── Types ────────────────────────────────────

const CANDIDATE_STAGES = [
  "SOURCED",
  "SCREENED",
  "CV_SHARED",
  "INTERVIEW_SCHEDULED",
  "SELECTED",
  "JOINED",
  "INVOICED",
  "CLOSED",
] as const;

const STAGE_BADGE_VARIANT: Record<
  string,
  "default" | "primary" | "success" | "warning" | "danger" | "info"
> = {
  SOURCED: "default",
  SCREENED: "info",
  CV_SHARED: "primary",
  INTERVIEW_SCHEDULED: "warning",
  SELECTED: "success",
  JOINED: "success",
  INVOICED: "info",
  CLOSED: "danger",
};

const PAYMENT_STATUSES = ["PENDING", "PARTIAL", "RECEIVED", "OVERDUE"] as const;

const HR_FEEDBACK_OPTIONS = ["REJECTED", "HOLD", "PROFILE_CLOSED"] as const;

const STATUS_OPTIONS = ["PENDING", "COMPLETE"] as const;

const ZONE_A_ZONES = ["WEST", "CENTRAL"];

interface StageHistoryEntry {
  id: string;
  fromStage: string | null;
  toStage: string;
  changedAt: string;
  changedBy: { name: string } | null;
  notes: string | null;
}

interface LookupItem {
  id: string;
  name: string;
}

interface CandidateDetail {
  id: string;
  globalSerialNumber: number;
  zone: string;

  // Candidate Info
  candidateName: string | null;
  contactNo: string | null;
  emailId: string | null;
  dateOfBirth: string | null;
  state: string | null;
  location: string | null;
  profile: string | null;
  yearsOfExperience: number | null;
  currentCtc: string | null;
  expectedCtc: string | null;
  currentDesignation: string | null;
  currentOrganization: string | null;
  higherQualification: string | null;
  diplomaPartFull: string | null;
  graduationPercent: string | null;
  graduationYear: string | null;
  twelfthPassingYear: string | null;
  twelfthPercent: string | null;
  tenthPassingYear: string | null;
  tenthPercent: string | null;
  noticePeriod: string | null;
  remarks: string | null;

  // Zone A only fields
  isCtcInformed: boolean | null;
  isOffRollOkay: boolean | null;
  isOnRollExplained: boolean | null;
  hasTwoWheeler: boolean | null;
  communicationSkill: string | null;

  // Recruitment
  candidateStage: string;
  dateSourced: string | null;
  cvSharedOnDate: string | null;
  dateOfJoining: string | null;
  hrFeedback: string | null;
  adminLocation: string | null;
  adminState: string | null;

  // Relations
  companyId: string | null;
  serviceProviderId: string | null;
  hrManagerId: string | null;
  company: LookupItem | null;
  serviceProvider: LookupItem | null;
  hrManager: LookupItem | null;

  // MIS / Invoice
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceAmountTotal: number | null;
  gstAmount: number | null;
  amountReceived: number | null;
  tdsAmount: number | null;
  paymentStatus: string | null;
  paymentDate: string | null;

  // Meta
  status: string | null;
  createdAt: string;
  updatedAt: string;
  recruiter: { id: string; firstName: string; lastName: string; employeeId: string | null };
}

type FormData = Record<string, unknown>;

// ── Helpers ──────────────────────────────────

function flattenToForm(c: CandidateDetail): FormData {
  return {
    candidateName: c.candidateName ?? "",
    contactNo: c.contactNo ?? "",
    emailId: c.emailId ?? "",
    dateOfBirth: c.dateOfBirth ?? "",
    state: c.state ?? "",
    location: c.location ?? "",
    profile: c.profile ?? "",
    yearsOfExperience: c.yearsOfExperience ?? "",
    currentCtc: c.currentCtc ?? "",
    expectedCtc: c.expectedCtc ?? "",
    currentDesignation: c.currentDesignation ?? "",
    currentOrganization: c.currentOrganization ?? "",
    higherQualification: c.higherQualification ?? "",
    diplomaPartFull: c.diplomaPartFull ?? "",
    graduationPercent: c.graduationPercent ?? "",
    graduationYear: c.graduationYear ?? "",
    twelfthPassingYear: c.twelfthPassingYear ?? "",
    twelfthPercent: c.twelfthPercent ?? "",
    tenthPassingYear: c.tenthPassingYear ?? "",
    tenthPercent: c.tenthPercent ?? "",
    noticePeriod: c.noticePeriod ?? "",
    remarks: c.remarks ?? "",
    isCtcInformed: c.isCtcInformed ?? false,
    isOffRollOkay: c.isOffRollOkay ?? false,
    isOnRollExplained: c.isOnRollExplained ?? false,
    hasTwoWheeler: c.hasTwoWheeler ?? false,
    communicationSkill: c.communicationSkill ?? "",
    candidateStage: c.candidateStage,
    dateSourced: c.dateSourced ?? "",
    cvSharedOnDate: c.cvSharedOnDate ?? "",
    dateOfJoining: c.dateOfJoining ?? "",
    hrFeedback: c.hrFeedback ?? "",
    adminLocation: c.adminLocation ?? "",
    adminState: c.adminState ?? "",
    companyId: c.companyId ?? "",
    serviceProviderId: c.serviceProviderId ?? "",
    hrManagerId: c.hrManagerId ?? "",
    invoiceNumber: c.invoiceNumber ?? "",
    invoiceDate: c.invoiceDate ?? "",
    invoiceAmountTotal: c.invoiceAmountTotal ?? "",
    gstAmount: c.gstAmount ?? "",
    amountReceived: c.amountReceived ?? "",
    tdsAmount: c.tdsAmount ?? "",
    paymentStatus: c.paymentStatus ?? "",
    paymentDate: c.paymentDate ?? "",
  };
}

function deepEqual(a: FormData, b: FormData): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => {
    const vA = a[key];
    const vB = b[key];
    if (vA === vB) return true;
    if (String(vA) === String(vB)) return true;
    return false;
  });
}

function formatStageLabel(stage: string): string {
  return stage
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Component ────────────────────────────────

const TABS = [
  { id: "all", label: "All Fields" },
  { id: "candidate", label: "Candidate Info" },
  { id: "recruitment", label: "Recruitment" },
  { id: "mis", label: "MIS / Invoice" },
];

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  // ── State ──
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "all");
  const [formData, setFormData] = useState<FormData>({});
  const [originalData, setOriginalData] = useState<FormData>({});
  const [stageHistory, setStageHistory] = useState<StageHistoryEntry[]>([]);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  // §9 — Inline create for relational dropdowns
  const [inlineCreate, setInlineCreate] = useState<{
    type: "company" | "sp" | "hr";
  } | null>(null);

  // §9 — Relational dropdown data
  interface CompanyWithRelations extends LookupItem {
    serviceProviders?: LookupItem[];
    hrManagers?: LookupItem[];
  }
  const [allCompanies, setAllCompanies] = useState<CompanyWithRelations[]>([]);
  const companies = allCompanies; // alias for options
  const selectedCompanyId = formData.companyId as string | undefined;

  // §9 — SP/HR filtered by selected company
  const serviceProviders = useMemo(() => {
    if (!selectedCompanyId) return allCompanies.flatMap((c) => c.serviceProviders ?? []);
    const company = allCompanies.find((c) => c.id === selectedCompanyId);
    return company?.serviceProviders ?? [];
  }, [allCompanies, selectedCompanyId]);

  const hrManagers = useMemo(() => {
    if (!selectedCompanyId) return allCompanies.flatMap((c) => c.hrManagers ?? []);
    const company = allCompanies.find((c) => c.id === selectedCompanyId);
    return company?.hrManagers ?? [];
  }, [allCompanies, selectedCompanyId]);

  const isZoneA = candidate ? ZONE_A_ZONES.includes(candidate.zone) : false;
  const hasChanges = useMemo(() => !deepEqual(formData, originalData), [formData, originalData]);

  // §5.2 #23 — Age auto-calculated from DOB
  const computedAge = useMemo(() => {
    const dob = formData.dateOfBirth as string | undefined;
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  }, [formData.dateOfBirth]);
  const hasChangesRef = useRef(hasChanges);
  hasChangesRef.current = hasChanges;

  // §6.1.1 — Tab URL state persistence
  const switchTab = useCallback((tab: string) => {
    if (hasChangesRef.current) {
      setPendingTab(tab);
      return;
    }
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const confirmTabSwitch = () => {
    if (pendingTab) {
      setFormData({ ...originalData });
      setActiveTab(pendingTab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", pendingTab);
      window.history.replaceState(null, "", url.toString());
      setPendingTab(null);
    }
  };

  // §6.1.1 — Ctrl+S / Cmd+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasChangesRef.current) {
          document.getElementById("admin-candidate-save-btn")?.click();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // §6.1.1 — Unsaved changes warning on navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChangesRef.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ── Data fetching ──

  const fetchCandidate = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ report: CandidateDetail }>(`/candidates/${id}`);
      const c = res.data.report;
      setCandidate(c);
      const flat = flattenToForm(c);
      setFormData(flat);
      setOriginalData(flat);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load candidate";
      toast.error(message);
      router.push("/admin/reports");
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  const fetchStageHistory = useCallback(async () => {
    try {
      const res = await api.get<{ history: StageHistoryEntry[] }>(
        `/candidates/${id}/stage-history`,
      );
      setStageHistory(res.data.history);
    } catch {
      // Stage history is non-critical; silently fail
    }
  }, [id]);

  // §9 — Fetch companies with nested SPs and HRs in one call
  const fetchLookups = useCallback(async () => {
    try {
      const res = await api.get<{ companies: CompanyWithRelations[] }>("/companies");
      setAllCompanies(res.data.companies ?? []);
    } catch {
      // Non-critical; selects will be empty
    }
  }, []);

  useEffect(() => {
    void fetchCandidate();
    void fetchStageHistory();
    void fetchLookups();
  }, [fetchCandidate, fetchStageHistory, fetchLookups]);

  // ── Form helpers ──

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      // §9 — When company changes, clear SP/HR selections (they belong to the old company)
      if (field === "companyId") {
        next.serviceProviderId = "";
        next.hrManagerId = "";
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!hasChanges || !candidate) return;
    setIsSaving(true);
    try {
      // Build a diff payload — only send changed fields
      const payload: Record<string, unknown> = {};
      for (const key of Object.keys(formData)) {
        if (String(formData[key]) !== String(originalData[key])) {
          let val = formData[key];
          // Convert numeric strings back to numbers for numeric fields
          if (
            [
              "invoiceAmountTotal",
              "gstAmount",
              "amountReceived",
              "tdsAmount",
              "yearsOfExperience",
            ].includes(key)
          ) {
            val = val === "" ? null : Number(val);
          }
          // Convert empty strings to null
          if (val === "") val = null;
          payload[key] = val;
        }
      }
      await updateCandidate(id, payload);
      // Re-fetch to get fresh data with populated relations
      await fetchCandidate();
      await fetchStageHistory();
      setIsEditing(false);
      // §6.1.1 — Brief "Saved ✓" success state for 2 seconds
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      toast.success("Candidate updated successfully");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update candidate";
      toast.error(message);
      // §6.1.1 — Save failed visual state: button remains active so admin can retry
      setSaveFailed(true);
      setTimeout(() => setSaveFailed(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({ ...originalData });
    setIsEditing(false);
  };

  // ── Select options ──

  const companyOptions: SelectOption[] = useMemo(
    () => [
      { value: "", label: "Select company" },
      { value: "__create__", label: "+ Create New Company" },
      ...companies.map((c) => ({ value: c.id, label: c.name })),
    ],
    [companies],
  );

  const spOptions: SelectOption[] = useMemo(
    () => [
      {
        value: "",
        label: selectedCompanyId ? "Select service provider" : "Select a company first",
      },
      ...(selectedCompanyId ? [{ value: "__create__", label: "+ Create New SP" }] : []),
      ...serviceProviders.map((s) => ({ value: s.id, label: s.name })),
    ],
    [serviceProviders, selectedCompanyId],
  );

  const hrOptions: SelectOption[] = useMemo(
    () => [
      { value: "", label: selectedCompanyId ? "Select HR manager" : "Select a company first" },
      ...(selectedCompanyId ? [{ value: "__create__", label: "+ Create New HR" }] : []),
      ...hrManagers.map((h) => ({ value: h.id, label: h.name })),
    ],
    [hrManagers, selectedCompanyId],
  );

  const stageOptions: SelectOption[] = CANDIDATE_STAGES.map((s) => ({
    value: s,
    label: formatStageLabel(s),
  }));

  const paymentStatusOptions: SelectOption[] = [
    { value: "", label: "Select status" },
    ...PAYMENT_STATUSES.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })),
  ];

  const hrFeedbackOptions: SelectOption[] = [
    { value: "", label: "Select feedback" },
    ...HR_FEEDBACK_OPTIONS.map((s) => ({
      value: s,
      label: formatStageLabel(s),
    })),
  ];

  const statusOptions: SelectOption[] = [
    { value: "", label: "Select status" },
    ...STATUS_OPTIONS.map((s) => ({ value: s, label: s.charAt(0) + s.slice(1).toLowerCase() })),
  ];

  const yesNoOptions: SelectOption[] = [
    { value: "", label: "Select" },
    { value: "true", label: "Yes" },
    { value: "false", label: "No" },
  ];

  // ── Field rendering helpers ──

  const renderInput = (
    field: string,
    label: string,
    opts?: { type?: string; required?: boolean; disabled?: boolean },
  ) => (
    <FormField label={label} htmlFor={field} required={opts?.required}>
      <Input
        id={field}
        type={opts?.type ?? "text"}
        value={String(formData[field] ?? "")}
        onChange={(e) => updateField(field, e.target.value)}
        disabled={!isEditing || opts?.disabled}
      />
    </FormField>
  );

  const renderSelect = (
    field: string,
    label: string,
    options: SelectOption[],
    opts?: { required?: boolean },
  ) => (
    <FormField label={label} htmlFor={field} required={opts?.required}>
      <Select
        id={field}
        options={options}
        value={String(formData[field] ?? "")}
        onChange={(e) => {
          const val = e.target.value;
          // §9 — Intercept "Create New" selection
          if (val === "__create__") {
            if (field === "companyId") setInlineCreate({ type: "company" });
            else if (field === "serviceProviderId") setInlineCreate({ type: "sp" });
            else if (field === "hrManagerId") setInlineCreate({ type: "hr" });
            return;
          }
          updateField(field, val);
        }}
        disabled={!isEditing}
      />
    </FormField>
  );

  const renderDatePicker = (field: string, label: string) => (
    <FormField label={label} htmlFor={field}>
      <DatePicker
        id={field}
        value={formData[field] ? String(formData[field]).slice(0, 10) : ""}
        onChange={(val) => updateField(field, val)}
        disabled={!isEditing}
      />
    </FormField>
  );

  const renderBooleanSelect = (field: string, label: string) => (
    <FormField label={label} htmlFor={field}>
      <Select
        id={field}
        options={yesNoOptions}
        value={
          formData[field] === true || formData[field] === "true"
            ? "true"
            : formData[field] === false || formData[field] === "false"
              ? "false"
              : ""
        }
        onChange={(e) => updateField(field, e.target.value === "true")}
        disabled={!isEditing}
      />
    </FormField>
  );

  const renderTextarea = (field: string, label: string) => (
    <FormField label={label} htmlFor={field}>
      <Textarea
        id={field}
        value={String(formData[field] ?? "")}
        onChange={(e) => updateField(field, e.target.value)}
        disabled={!isEditing}
        rows={3}
      />
    </FormField>
  );

  // ── Tab sections ──

  // §6.1.1 Tab 2 — Candidate (Personal & Qualification Details)
  // Fields: #2,3,4,5,6,12,22,23,13,15,16,17,18,19,20,21,25
  const candidateInfoSection = (
    <div className="space-y-6">
      <div>
        <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
          Personal & Contact Details
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderDatePicker("dateSourced", "Date Sourced / Profile Received")}
          {renderInput("candidateName", "Candidate Name", { required: true })}
          {renderInput("contactNo", "Contact No", { required: true })}
          {renderInput("emailId", "Email ID", { type: "email" })}
          {renderInput("state", "State")}
          {renderInput("location", "Location")}
          {renderDatePicker("dateOfBirth", "Date of Birth")}
          {/* §5.2 #23 — Age auto-calculated from DOB (read-only) */}
          <FormField label="Age" htmlFor="age-display">
            <Input
              id="age-display"
              value={computedAge !== null ? String(computedAge) : ""}
              disabled
              placeholder="Auto-calculated from DOB"
            />
          </FormField>
        </div>
      </div>

      <div>
        <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
          Education
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderInput("higherQualification", "Higher Qualification")}
          {renderInput("diplomaPartFull", "Diploma (Part/Full)")}
          {renderInput("graduationPercent", "Graduation %")}
          {renderInput("graduationYear", "Graduation Year")}
          {renderInput("twelfthPassingYear", "12th Passing Year")}
          {renderInput("twelfthPercent", "12th %")}
          {renderInput("tenthPassingYear", "10th Passing Year")}
          {renderInput("tenthPercent", "10th %")}
        </div>
      </div>

      <div>
        <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
          Remarks
        </h3>
        <div className="grid grid-cols-1 gap-4">{renderTextarea("remarks", "Remarks")}</div>
      </div>
    </div>
  );

  // §6.1.1 Tab 3 — Recruitment (Screening, Employment & HR Feedback)
  // Fields: #7-11,14,24,26-30,31,32,33,pipeline,34-39,47,48
  const recruitmentSection = (
    <div className="space-y-6">
      <div>
        <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
          Employment Details
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderInput("profile", "Profile")}
          {renderInput("yearsOfExperience", "Years of Experience", { type: "number" })}
          {renderInput("currentCtc", "Current CTC")}
          {renderInput("expectedCtc", "Expected CTC")}
          {renderInput("currentDesignation", "Current Designation")}
          {renderInput("currentOrganization", "Current Organization")}
          {renderInput("noticePeriod", "Notice Period")}
        </div>
      </div>

      {isZoneA ? (
        <div>
          <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
            Screening / Assessment (Set A — West/Central)
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {renderBooleanSelect("isCtcInformed", "Is CTC Informed?")}
            {renderBooleanSelect("isOffRollOkay", "Is Off-Roll Okay?")}
            {renderBooleanSelect("isOnRollExplained", "On-Roll 18 Months Explained?")}
            {renderBooleanSelect("hasTwoWheeler", "Two Wheeler + Licence?")}
            {renderInput("communicationSkill", "Communication Skills (1–10)", {
              type: "number",
            })}
          </div>
        </div>
      ) : (
        <div>
          <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
            Screening / Assessment
          </h3>
          {/* §8 — Set B zones: screening fields show as N/A */}
          <p className="text-text-muted text-sm">
            N/A — Screening fields are not applicable for {candidate?.zone} zone (Set B).
          </p>
        </div>
      )}

      <div>
        <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
          Recruiter & Status
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* §5.2 #31 — Recruiter Name (read-only) */}
          <FormField label="Recruiter Name" htmlFor="recruiterName">
            <Input
              id="recruiterName"
              value={
                candidate ? `${candidate.recruiter.firstName} ${candidate.recruiter.lastName}` : ""
              }
              disabled
            />
          </FormField>
          {/* §5.2 #32 — Reporting Manager (read-only — derived from assignment) */}
          <FormField label="Reporting Manager" htmlFor="reportingManager">
            <Input id="reportingManager" value="See user assignment" disabled />
          </FormField>
          {renderSelect("status", "Status (Complete/Pending)", statusOptions)}
          {renderSelect("candidateStage", "Candidate Stage", stageOptions, { required: true })}
        </div>
      </div>

      <div>
        <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
          Company & Assignment (Admin)
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderSelect("companyId", "Company", companyOptions)}
          {renderSelect("serviceProviderId", "Service Provider", spOptions)}
          {renderSelect("hrManagerId", "HR Manager", hrOptions)}
          {renderInput("adminLocation", "Admin Location")}
          {renderInput("adminState", "Admin State")}
        </div>
      </div>

      <div>
        <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
          Dates & Feedback
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderDatePicker("dateOfJoining", "Date of Joining")}
          {renderDatePicker("cvSharedOnDate", "CV Shared On")}
          {/* §6.1 #48 — HR Feedback as dropdown, not textarea */}
          {renderSelect("hrFeedback", "Feedback from HR", hrFeedbackOptions)}
        </div>
      </div>
    </div>
  );

  // §6.1.1 Tab 4 — MIS (Invoice, Payment & Financial Data)
  // Fields: #3(ro),34(ro),35(ro),36(ro),39,40,41,42,43,44,45,46 + computed
  const invoiceTotal = Number(formData.invoiceAmountTotal) || 0;
  const amtReceived = Number(formData.amountReceived) || 0;
  const tds = Number(formData.tdsAmount) || 0;
  const gst = Number(formData.gstAmount) || 0;
  const outstandingAmount = invoiceTotal - amtReceived;
  const netReceivable = invoiceTotal - tds - gst;

  const misInvoiceSection = (
    <div className="space-y-6">
      <div>
        <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
          Context
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Read-only context fields so admin knows which candidate */}
          {renderInput("candidateName", "Candidate Name", { disabled: true })}
          <FormField label="Company" htmlFor="mis-company">
            <Input id="mis-company" value={candidate?.company?.name ?? "Not assigned"} disabled />
          </FormField>
          <FormField label="Service Provider" htmlFor="mis-sp">
            <Input
              id="mis-sp"
              value={candidate?.serviceProvider?.name ?? "Not assigned"}
              disabled
            />
          </FormField>
          <FormField label="HR Manager" htmlFor="mis-hr">
            <Input id="mis-hr" value={candidate?.hrManager?.name ?? "Not assigned"} disabled />
          </FormField>
          {renderDatePicker("dateOfJoining", "Date of Joining")}
        </div>
      </div>

      <div>
        <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
          Invoice Details
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* §14 — Invoice number with auto-generate */}
          <FormField label="Invoice Number" htmlFor="invoiceNumber">
            <div className="flex gap-2">
              <Input
                id="invoiceNumber"
                value={String(formData.invoiceNumber ?? "")}
                onChange={(e) => updateField("invoiceNumber", e.target.value)}
                disabled={!isEditing}
                className="flex-1"
              />
              {isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await api.get<{ invoiceNumber: string }>(
                        "/candidates/next-invoice",
                      );
                      updateField("invoiceNumber", res.data.invoiceNumber);
                    } catch {
                      toast.error("Failed to generate invoice number");
                    }
                  }}
                >
                  Auto
                </Button>
              )}
            </div>
          </FormField>
          {renderDatePicker("invoiceDate", "Invoice Date")}
          {renderInput("invoiceAmountTotal", "Invoice Amount (Total)", { type: "number" })}
          {renderInput("gstAmount", "GST Amount", { type: "number" })}
        </div>
      </div>

      <div>
        <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
          Payment
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderInput("amountReceived", "Amount Received", { type: "number" })}
          {renderInput("tdsAmount", "TDS Amount", { type: "number" })}
          {renderSelect("paymentStatus", "Payment Status", paymentStatusOptions)}
          {renderDatePicker("paymentDate", "Payment Date")}
        </div>
      </div>

      <div>
        <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
          Computed Totals
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Outstanding Amount" htmlFor="outstandingAmount">
            <Input
              id="outstandingAmount"
              value={invoiceTotal > 0 ? `₹${outstandingAmount.toLocaleString("en-IN")}` : "—"}
              disabled
            />
          </FormField>
          <FormField label="Net Receivable" htmlFor="netReceivable">
            <Input
              id="netReceivable"
              value={invoiceTotal > 0 ? `₹${netReceivable.toLocaleString("en-IN")}` : "—"}
              disabled
            />
          </FormField>
        </div>
      </div>
    </div>
  );

  // ── Stage history timeline ──

  const stageTimeline = (
    <div className="mt-8">
      <h3 className="text-text-muted mb-4 text-sm font-semibold tracking-wider uppercase">
        Stage History
      </h3>
      {stageHistory.length === 0 ? (
        <p className="text-text-muted text-sm">No stage transitions recorded.</p>
      ) : (
        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="bg-border-default absolute top-2 bottom-2 left-3 w-px" />
          {stageHistory.map((entry, idx) => (
            <div key={entry.id} className="relative flex items-start gap-4 pb-4">
              {/* Dot */}
              <div
                className={cn(
                  "ring-bg-surface relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2",
                  idx === 0 ? "bg-primary-500" : "bg-border-default",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {entry.fromStage && (
                    <>
                      <Badge variant={STAGE_BADGE_VARIANT[entry.fromStage] ?? "default"} size="sm">
                        {formatStageLabel(entry.fromStage)}
                      </Badge>
                      <ChevronRight size={12} className="text-text-muted" />
                    </>
                  )}
                  <Badge variant={STAGE_BADGE_VARIANT[entry.toStage] ?? "default"} size="sm">
                    {formatStageLabel(entry.toStage)}
                  </Badge>
                </div>
                <div className="text-text-muted mt-1 flex items-center gap-2 text-xs">
                  <Clock size={11} />
                  <span>{formatDate(entry.changedAt)}</span>
                  {entry.changedBy && <span>by {entry.changedBy.name}</span>}
                </div>
                {entry.notes && <p className="text-text-secondary mt-1 text-xs">{entry.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Loading ──

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!candidate) {
    return null;
  }

  // ── Breadcrumbs ──

  const breadcrumbs = [
    { label: "Reports", href: "/admin/reports" },
    { label: "Candidate", href: "/admin/reports" },
    { label: candidate.candidateName ?? `#${candidate.globalSerialNumber}` },
  ];

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={candidate.candidateName ?? `Candidate #${candidate.globalSerialNumber}`}
        breadcrumbs={breadcrumbs}
        description={`Zone: ${candidate.zone} · Recruiter: ${candidate.recruiter.firstName} ${candidate.recruiter.lastName} · GSN: ${candidate.globalSerialNumber}`}
        actions={
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button onClick={handleCancel} className="flex items-center gap-1.5">
                  <X size={14} />
                  Cancel
                </Button>
                <Button
                  id="admin-candidate-save-btn"
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className={cn(
                    "flex items-center gap-1.5",
                    saveFailed
                      ? "bg-error-500 hover:bg-error-700 text-white"
                      : hasChanges
                        ? "bg-primary-500 hover:bg-primary-600 text-white"
                        : "cursor-not-allowed opacity-50",
                  )}
                >
                  {isSaving ? <Spinner /> : <Save size={14} />}
                  {isSaving ? "Saving..." : saveFailed ? "Retry Save" : "Save Changes"}
                </Button>
              </>
            ) : saveSuccess ? (
              <Button disabled className="flex items-center gap-1.5 bg-green-500 text-white">
                Saved ✓
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => window.print()}
                  data-print="show"
                  className="flex items-center gap-1.5"
                >
                  <Printer size={14} />
                  Print
                </Button>
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-primary-500 hover:bg-primary-600 flex items-center gap-1.5 text-white"
                >
                  <Edit3 size={14} />
                  Edit
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Stage badge */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-text-secondary text-sm font-medium">Current Stage:</span>
            <Badge variant={STAGE_BADGE_VARIANT[candidate.candidateStage] ?? "default"} size="md">
              {formatStageLabel(candidate.candidateStage)}
            </Badge>
          </div>
          {isEditing && (
            <div className="flex items-center gap-2">
              <span className="text-text-muted text-sm">Change to:</span>
              <Select
                options={stageOptions}
                value={String(formData.candidateStage ?? "")}
                onChange={(e) => updateField("candidateStage", e.target.value)}
                size="sm"
              />
            </div>
          )}
          <div className="text-text-muted ml-auto flex items-center gap-2 text-xs">
            <span>Created: {formatDate(candidate.createdAt)}</span>
            <span>·</span>
            <span>Updated: {formatDate(candidate.updatedAt)}</span>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={switchTab} variant="underline" />

      {/* Tab content */}
      <Card className="p-6">
        {activeTab === "all" && (
          <div className="space-y-10">
            <div>
              <h2 className="text-text-primary mb-6 text-lg font-semibold">Candidate Info</h2>
              {candidateInfoSection}
            </div>
            <hr className="border-border-default" />
            <div>
              <h2 className="text-text-primary mb-6 text-lg font-semibold">Recruitment</h2>
              {recruitmentSection}
            </div>
            <hr className="border-border-default" />
            <div>
              <h2 className="text-text-primary mb-6 text-lg font-semibold">MIS / Invoice</h2>
              {misInvoiceSection}
            </div>
          </div>
        )}
        {activeTab === "candidate" && candidateInfoSection}
        {activeTab === "recruitment" && recruitmentSection}
        {activeTab === "mis" && misInvoiceSection}
      </Card>

      {/* Stage History Timeline */}
      <Card className="p-6">{stageTimeline}</Card>

      {/* Back link */}
      <button
        onClick={() => router.push("/admin/reports")}
        className="text-text-muted hover:text-text-secondary flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Reports
      </button>

      {/* §6.1.1 — Unsaved changes confirmation dialog */}
      <ConfirmDialog
        open={!!pendingTab}
        onClose={() => setPendingTab(null)}
        onConfirm={confirmTabSwitch}
        title="Unsaved Changes"
        description="You have unsaved changes. Switching tabs will discard them. Continue?"
        confirmLabel="Discard & Switch"
        variant="danger"
      />

      {/* §9 — Inline create modal for Company / SP / HR */}
      {inlineCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-bg-surface w-full max-w-sm rounded-lg p-6 shadow-lg">
            <h3 className="text-text-primary mb-4 text-lg font-semibold">
              {inlineCreate.type === "company"
                ? "Create New Company"
                : inlineCreate.type === "sp"
                  ? "Create New Service Provider"
                  : "Create New HR Manager"}
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const name = (
                  form.elements.namedItem("entityName") as HTMLInputElement
                ).value.trim();
                if (!name) return;
                try {
                  if (inlineCreate.type === "company") {
                    const res = await api.post<{ company: { id: string; name: string } }>(
                      "/companies",
                      { name },
                    );
                    await fetchLookups();
                    updateField("companyId", res.data.company.id);
                  } else if (inlineCreate.type === "sp" && selectedCompanyId) {
                    const res = await api.post<{ serviceProvider: { id: string; name: string } }>(
                      "/companies/service-providers",
                      { name, companyId: selectedCompanyId },
                    );
                    await fetchLookups();
                    updateField("serviceProviderId", res.data.serviceProvider.id);
                  } else if (inlineCreate.type === "hr" && selectedCompanyId) {
                    const res = await api.post<{ hrManager: { id: string; name: string } }>(
                      "/companies/hr-managers",
                      { name, companyId: selectedCompanyId },
                    );
                    await fetchLookups();
                    updateField("hrManagerId", res.data.hrManager.id);
                  }
                  toast.success(`${name} created`);
                } catch {
                  toast.error("Failed to create");
                }
                setInlineCreate(null);
              }}
            >
              <FormField label="Name" htmlFor="entityName" required>
                <Input
                  id="entityName"
                  name="entityName"
                  placeholder="Enter name..."
                  autoFocus
                  required
                />
              </FormField>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setInlineCreate(null)}>
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
