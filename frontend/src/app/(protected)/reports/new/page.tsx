"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth";
import { createCandidate, checkDuplicates } from "@/services/candidate.service";
import { saveDraft, getDraft, deleteDraft } from "@/services/draft.service";
import { getDropdownOptions, type DropdownOption } from "@/services/dropdown.service";
import {
  PageHeader,
  Card,
  FormField,
  Input,
  Select,
  Textarea,
  Button,
  Alert,
} from "@/components/ui";
import { OnboardingTour, REPORT_TOUR_STEPS } from "@/components/onboarding-tour";
import { ZONE_OPTIONS, isSetA } from "@/constants/zones";
import type { Zone } from "@/constants/zones";
import { candidateReportSchema } from "@/validators/candidate";
import { CalendarDatePicker } from "@/components/ui/calendar-date-picker";
import { useFormDrafts } from "@/store/form-drafts";

// ──────────────────────────────────────────────
//  Utility: calculate age from DOB (§5.2 field #23)
// ──────────────────────────────────────────────
function calculateAge(dob: string | undefined | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

interface DuplicateMatch {
  id: string;
  candidateName: string | null;
  contactNo: string | null;
  emailId: string | null;
  matchType: string;
  recruiterName: string;
  createdAt: string;
}

export default function AddReportPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // §5.3 — Warn on in-app navigation when form has data
  useUnsavedChanges(!!selectedZone && !isSubmitting);
  const formDrafts = useFormDrafts();
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // §23.19 — Admin-configurable dropdown options
  const [stateOptions, setStateOptions] = useState<DropdownOption[]>([]);
  const [locationOptions, setLocationOptions] = useState<DropdownOption[]>([]);
  const [profileOptions, setProfileOptions] = useState<DropdownOption[]>([]);
  const [qualificationOptions, setQualificationOptions] = useState<DropdownOption[]>([]);
  const [noticePeriodOptions, setNoticePeriodOptions] = useState<DropdownOption[]>([]);
  const [diplomaOptions, setDiplomaOptions] = useState<DropdownOption[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(candidateReportSchema),
  });
  const dobValue = watch("dateOfBirth");

  // §5.2 field #23 — Auto-calculated age
  const calculatedAge = useMemo(() => calculateAge(dobValue as string), [dobValue]);

  // §5.2 field #32 — Reporting Manager from user assignment
  const reportingManagerName = useMemo(() => {
    if (!user?.assignedManagers?.length) return "Not assigned";
    return user.assignedManagers
      .map((a) => `${a.manager.firstName} ${a.manager.lastName}`)
      .join(", ");
  }, [user]);

  // Load draft on mount
  useEffect(() => {
    void getDraft().then((draft) => {
      if (draft) {
        if (confirm("You have an unsaved draft. Resume?")) {
          setSelectedZone(draft.zone as Zone | null);
          reset(draft.formData);
        } else {
          void deleteDraft();
        }
      }
    });
  }, [reset]);

  // §23.19 — Load dropdown options when zone is selected
  useEffect(() => {
    if (!selectedZone) return;
    const zoneSet = isSetA(selectedZone) ? "SET_A" : "SET_B";
    void Promise.all([
      getDropdownOptions("STATE", zoneSet)
        .then(setStateOptions)
        .catch(() => {}),
      getDropdownOptions("LOCATION", zoneSet)
        .then(setLocationOptions)
        .catch(() => {}),
      getDropdownOptions("PROFILE", zoneSet)
        .then(setProfileOptions)
        .catch(() => {}),
      getDropdownOptions("QUALIFICATION", zoneSet)
        .then(setQualificationOptions)
        .catch(() => {}),
      getDropdownOptions("NOTICE_PERIOD", zoneSet)
        .then(setNoticePeriodOptions)
        .catch(() => {}),
      getDropdownOptions("DIPLOMA", zoneSet)
        .then(setDiplomaOptions)
        .catch(() => {}),
    ]);
  }, [selectedZone]);

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!selectedZone) return;
    autoSaveTimer.current = setInterval(() => {
      const values = getValues();
      void saveDraft(selectedZone, values);
      formDrafts.saveDraft("candidate-report", values as unknown as Record<string, unknown>);
    }, 30000);
    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    };
  }, [selectedZone, getValues, formDrafts]);

  // §5.3 — Save draft on beforeunload + show unsaved changes warning
  useEffect(() => {
    if (!selectedZone) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const values = getValues();
      void saveDraft(selectedZone, values);
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [selectedZone, getValues]);

  // Save draft on blur-sm
  const handleFieldBlur = useCallback(() => {
    if (selectedZone) {
      void saveDraft(selectedZone, getValues());
    }
  }, [selectedZone, getValues]);

  // Helper: convert dropdown options to Select format
  const toSelectOptions = (opts: DropdownOption[]) =>
    opts.map((o) => ({ value: o.value, label: o.label }));

  const onSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      if (!selectedZone) return;
      setIsSubmitting(true);

      // §5.2 #26-30 — Convert Set A screening "Yes"/"No" strings to booleans
      for (const key of ["isCtcInformed", "isOffRollOkay", "isOnRollExplained", "hasTwoWheeler"]) {
        if (data[key] === "Yes") data[key] = true;
        else if (data[key] === "No") data[key] = false;
      }

      try {
        // §5.4 — Duplicate check with details display
        const contactNo = data["contactNo"] as string | undefined;
        const emailId = data["emailId"] as string | undefined;
        if (contactNo || emailId) {
          const dupResult = (await checkDuplicates({ contactNo, emailId })) as {
            duplicates: DuplicateMatch[];
            hasDuplicates: boolean;
          };
          if (dupResult.hasDuplicates) {
            const details = dupResult.duplicates
              .map(
                (d) =>
                  `• ${d.candidateName ?? "Unknown"} (${d.matchType} match) — submitted by ${d.recruiterName} on ${new Date(d.createdAt).toLocaleDateString()}`,
              )
              .join("\n");
            const proceed = confirm(`Potential duplicate found!\n\n${details}\n\nProceed anyway?`);
            if (!proceed) {
              setIsSubmitting(false);
              return;
            }
          }
        }

        await createCandidate({ ...data, zone: selectedZone });
        await deleteDraft();
        toast.success("Report submitted successfully");
        router.push("/reports");
      } catch {
        toast.error("Failed to submit report");
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedZone, router],
  );

  const handleSaveDraft = useCallback(() => {
    if (selectedZone) {
      void saveDraft(selectedZone, getValues()).then(() => {
        toast.success("Draft saved");
      });
    }
  }, [selectedZone, getValues]);

  // Validation error summary
  const errorKeys = Object.keys(errors);

  // Zone selection step
  if (!selectedZone) {
    return (
      <div className="mx-auto max-w-md space-y-6">
        <PageHeader title="Add Report" description="Select the zone for this candidate report" />
        <div data-tour="zone-fields" className="grid grid-cols-1 gap-3">
          {ZONE_OPTIONS.map((z) => (
            <Card key={z.value} hover onClick={() => setSelectedZone(z.value)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-text-primary font-medium">{z.label}</p>
                  <p className="text-text-muted text-xs">
                    Set {z.set} &mdash;{" "}
                    {z.set === "A" ? "All 33 fields" : "28 fields (screening hidden)"}
                  </p>
                </div>
                <span className="bg-bg-muted text-text-secondary rounded-sm px-2 py-1 text-xs">
                  Set {z.set}
                </span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const showSetA = isSetA(selectedZone);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Add Report"
        description={
          <>
            Zone: {selectedZone} (Set {showSetA ? "A" : "B"})
            <button onClick={() => setSelectedZone(null)} className="text-text-link ml-2 underline">
              Change
            </button>
          </>
        }
        actions={
          <Button data-tour="save-draft" variant="outline" onClick={handleSaveDraft}>
            Save Draft
          </Button>
        }
      />

      {/* Validation summary */}
      {errorKeys.length > 0 && (
        <Alert variant="error" title="Please fix the following errors">
          <ul className="list-disc pl-4">
            {errorKeys.map((key) => (
              <li key={key}>
                {(errors[key as keyof typeof errors]?.message as string) || `${key} is invalid`}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Form */}
      <form data-tour="report-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Candidate Info */}
        <Card>
          <Card.Header>
            <h3 className="text-text-secondary text-sm font-medium">Candidate Information</h3>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Date Sourced" htmlFor="dateSourced">
                <CalendarDatePicker
                  value={(watch("dateSourced") as string) ?? ""}
                  onChange={(val) => {
                    setValue("dateSourced", val, { shouldValidate: true, shouldDirty: true });
                    handleFieldBlur();
                  }}
                />
              </FormField>
              <FormField label="Candidate Name" htmlFor="candidateName">
                <Input {...register("candidateName")} onBlur={handleFieldBlur} />
              </FormField>
              <FormField label="Contact No" htmlFor="contactNo">
                <Input type="tel" {...register("contactNo")} onBlur={handleFieldBlur} />
              </FormField>
              <FormField label="Email ID" htmlFor="emailId">
                <Input type="email" {...register("emailId")} onBlur={handleFieldBlur} />
              </FormField>
              {/* §23.19 — State from dropdown service */}
              <FormField label="State" htmlFor="state">
                {stateOptions.length > 0 ? (
                  <Select
                    {...register("state")}
                    onBlur={handleFieldBlur}
                    placeholder="Select state..."
                    options={toSelectOptions(stateOptions)}
                  />
                ) : (
                  <Input
                    {...register("state")}
                    onBlur={handleFieldBlur}
                    placeholder="Type or loading..."
                  />
                )}
              </FormField>
              {/* §23.19 — Location from dropdown service */}
              <FormField label="Location" htmlFor="location">
                {locationOptions.length > 0 ? (
                  <Select
                    {...register("location")}
                    onBlur={handleFieldBlur}
                    placeholder="Select location..."
                    options={toSelectOptions(locationOptions)}
                  />
                ) : (
                  <Input
                    {...register("location")}
                    onBlur={handleFieldBlur}
                    placeholder="Type or loading..."
                  />
                )}
              </FormField>
              <FormField label="Date of Birth" htmlFor="dateOfBirth">
                <CalendarDatePicker
                  value={(watch("dateOfBirth") as string) ?? ""}
                  onChange={(val) => {
                    setValue("dateOfBirth", val, { shouldValidate: true, shouldDirty: true });
                    handleFieldBlur();
                  }}
                />
              </FormField>
              {/* §5.2 field #23 — Age auto-calculated from DOB */}
              <FormField label="Age" htmlFor="age">
                <Input
                  value={calculatedAge !== null ? String(calculatedAge) : ""}
                  readOnly
                  disabled
                  placeholder="Auto-calculated from DOB"
                />
              </FormField>
            </div>
          </Card.Body>
        </Card>

        {/* Education */}
        <Card>
          <Card.Header>
            <h3 className="text-text-secondary text-sm font-medium">Education</h3>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* §23.19 — Qualification from dropdown service */}
              <FormField label="Higher Qualification" htmlFor="higherQualification">
                {qualificationOptions.length > 0 ? (
                  <Select
                    {...register("higherQualification")}
                    onBlur={handleFieldBlur}
                    placeholder="Select qualification..."
                    options={toSelectOptions(qualificationOptions)}
                  />
                ) : (
                  <Input {...register("higherQualification")} onBlur={handleFieldBlur} />
                )}
              </FormField>
              {/* §23.19 — Diploma from dropdown service */}
              <FormField label="Diploma Part / Full" htmlFor="diplomaPartFull">
                {diplomaOptions.length > 0 ? (
                  <Select
                    {...register("diplomaPartFull")}
                    onBlur={handleFieldBlur}
                    placeholder="Select..."
                    options={toSelectOptions(diplomaOptions)}
                  />
                ) : (
                  <Select
                    {...register("diplomaPartFull")}
                    onBlur={handleFieldBlur}
                    placeholder="Select..."
                    options={[
                      { value: "Part", label: "Part" },
                      { value: "Full", label: "Full" },
                    ]}
                  />
                )}
              </FormField>
              <FormField label="Graduation %" htmlFor="graduationPercent">
                <Input
                  type="number"
                  {...register("graduationPercent", { valueAsNumber: true })}
                  onBlur={handleFieldBlur}
                />
              </FormField>
              <FormField label="Graduation Year" htmlFor="graduationYear">
                <Input
                  type="number"
                  {...register("graduationYear", { valueAsNumber: true })}
                  onBlur={handleFieldBlur}
                />
              </FormField>
              <FormField label="12th Passing Year" htmlFor="twelfthPassingYear">
                <Input
                  type="number"
                  {...register("twelfthPassingYear", { valueAsNumber: true })}
                  onBlur={handleFieldBlur}
                />
              </FormField>
              <FormField label="12th %" htmlFor="twelfthPercent">
                <Input
                  type="number"
                  {...register("twelfthPercent", { valueAsNumber: true })}
                  onBlur={handleFieldBlur}
                />
              </FormField>
              <FormField label="10th Passing Year" htmlFor="tenthPassingYear">
                <Input
                  type="number"
                  {...register("tenthPassingYear", { valueAsNumber: true })}
                  onBlur={handleFieldBlur}
                />
              </FormField>
              <FormField label="10th %" htmlFor="tenthPercent">
                <Input
                  type="number"
                  {...register("tenthPercent", { valueAsNumber: true })}
                  onBlur={handleFieldBlur}
                />
              </FormField>
            </div>
          </Card.Body>
        </Card>

        {/* Employment */}
        <Card>
          <Card.Header>
            <h3 className="text-text-secondary text-sm font-medium">Employment</h3>
          </Card.Header>
          <Card.Body>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* §23.19 — Profile from dropdown service */}
              <FormField label="Profile" htmlFor="profile">
                {profileOptions.length > 0 ? (
                  <Select
                    {...register("profile")}
                    onBlur={handleFieldBlur}
                    placeholder="Select profile..."
                    options={toSelectOptions(profileOptions)}
                  />
                ) : (
                  <Input {...register("profile")} onBlur={handleFieldBlur} />
                )}
              </FormField>
              <FormField label="Years of Experience" htmlFor="yearsOfExperience">
                <Input
                  type="number"
                  {...register("yearsOfExperience", { valueAsNumber: true })}
                  onBlur={handleFieldBlur}
                />
              </FormField>
              <FormField label="Current CTC (₹)" htmlFor="currentCtc">
                <Input
                  type="number"
                  {...register("currentCtc", { valueAsNumber: true })}
                  onBlur={handleFieldBlur}
                />
              </FormField>
              <FormField label="Expected CTC (₹)" htmlFor="expectedCtc">
                <Input
                  type="number"
                  {...register("expectedCtc", { valueAsNumber: true })}
                  onBlur={handleFieldBlur}
                />
              </FormField>
              <FormField label="Current Designation" htmlFor="currentDesignation">
                <Input {...register("currentDesignation")} onBlur={handleFieldBlur} />
              </FormField>
              <FormField label="Current Organization" htmlFor="currentOrganization">
                <Input {...register("currentOrganization")} onBlur={handleFieldBlur} />
              </FormField>
              {/* §23.19 — Notice Period from dropdown service */}
              <FormField label="Notice Period" htmlFor="noticePeriod">
                {noticePeriodOptions.length > 0 ? (
                  <Select
                    {...register("noticePeriod")}
                    onBlur={handleFieldBlur}
                    placeholder="Select..."
                    options={toSelectOptions(noticePeriodOptions)}
                  />
                ) : (
                  <Input
                    {...register("noticePeriod")}
                    onBlur={handleFieldBlur}
                    placeholder="e.g., Immediate, 30 days"
                  />
                )}
              </FormField>
            </div>
          </Card.Body>
        </Card>

        {/* Screening (Set A only) */}
        {showSetA && (
          <Card className="border-primary-200 bg-primary-50">
            <Card.Header>
              <h3 className="text-primary-700 text-sm font-medium">
                Screening / Assessment (Set A)
              </h3>
            </Card.Header>
            <Card.Body>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Is CTC informed and okay?" htmlFor="isCtcInformed">
                  <Select
                    {...register("isCtcInformed")}
                    onBlur={handleFieldBlur}
                    placeholder="Select..."
                    options={[
                      { value: "Yes", label: "Yes" },
                      { value: "No", label: "No" },
                    ]}
                  />
                </FormField>
                <FormField
                  label="Is off-roll okay?"
                  htmlFor="isOffRollOkay"
                  tooltip="Off-roll means the candidate will be employed through a third-party staffing agency, not directly by the company. Confirm the candidate understands and accepts this arrangement."
                >
                  <Select
                    {...register("isOffRollOkay")}
                    onBlur={handleFieldBlur}
                    placeholder="Select..."
                    options={[
                      { value: "Yes", label: "Yes" },
                      { value: "No", label: "No" },
                    ]}
                  />
                </FormField>
                <FormField
                  label="On-roll 18 months explained?"
                  htmlFor="isOnRollExplained"
                  tooltip="On-roll conversion may be available after 18 months of service. Confirm this has been communicated to the candidate."
                >
                  <Select
                    {...register("isOnRollExplained")}
                    onBlur={handleFieldBlur}
                    placeholder="Select..."
                    options={[
                      { value: "Yes", label: "Yes" },
                      { value: "No", label: "No" },
                    ]}
                  />
                </FormField>
                <FormField label="Two wheeler + licence?" htmlFor="hasTwoWheeler">
                  <Select
                    {...register("hasTwoWheeler")}
                    onBlur={handleFieldBlur}
                    placeholder="Select..."
                    options={[
                      { value: "Yes", label: "Yes" },
                      { value: "No", label: "No" },
                    ]}
                  />
                </FormField>
                <FormField
                  label="Communication Skills (1-10)"
                  htmlFor="communicationSkill"
                  tooltip="Rate the candidate's verbal communication skills during your screening call. 1 = very poor, 5 = average, 10 = excellent."
                >
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    {...register("communicationSkill", { valueAsNumber: true })}
                    onBlur={handleFieldBlur}
                  />
                </FormField>
              </div>
            </Card.Body>
          </Card>
        )}

        {/* Remarks & Status */}
        <Card>
          <Card.Header>
            <h3 className="text-text-secondary text-sm font-medium">Remarks & Status</h3>
          </Card.Header>
          <Card.Body className="space-y-4">
            <FormField label="Remarks" htmlFor="remarks">
              <Textarea rows={3} {...register("remarks")} onBlur={handleFieldBlur} />
            </FormField>
            <FormField label="Status" htmlFor="status">
              <Select
                {...register("status")}
                onBlur={handleFieldBlur}
                placeholder="Select..."
                options={[
                  { value: "PENDING", label: "Pending" },
                  { value: "COMPLETE", label: "Complete" },
                ]}
              />
            </FormField>
          </Card.Body>
        </Card>

        {/* Auto-populated fields (§5.2 fields #31-32) */}
        <Alert variant="info" title="Auto-populated">
          <p>
            <strong>Recruiter:</strong> {user?.name ?? "Current User"}
          </p>
          <p>
            <strong>Reporting Manager:</strong> {reportingManagerName}
          </p>
        </Alert>

        {/* Submit */}
        <div data-tour="submit-report" className="flex gap-3">
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Report"}
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>

      {/* Onboarding Tour — first-time report creation */}
      <OnboardingTour tourId="report-form" steps={REPORT_TOUR_STEPS} />
    </div>
  );
}
