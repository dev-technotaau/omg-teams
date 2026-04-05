// ──────────────────────────────────────────────
//  Candidate / Report Types
// ──────────────────────────────────────────────

export interface CandidateReport {
  id: string;
  globalSerialNumber: number;
  zone: string;
  candidateName: string | null;
  contactNo: string | null;
  emailId: string | null;
  state: string | null;
  location: string | null;
  profile: string | null;
  status: string | null;
  candidateStage: string;
  createdAt: string;
  recruiter: {
    id: string;
    firstName: string;
    lastName: string;
    employeeId: string | null;
  };
  company: { id: string; name: string } | null;
}
