// ──────────────────────────────────────────────
//  Company Types
// ──────────────────────────────────────────────

export interface Company {
  id: string;
  name: string;
  serviceProviders: { id: string; name: string }[];
  hrManagers: { id: string; name: string; email: string | null; phone: string | null }[];
  _count: { candidateReports: number };
}
