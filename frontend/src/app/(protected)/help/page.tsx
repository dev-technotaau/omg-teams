"use client";

import { useState, useMemo } from "react";
import { HelpCircle, ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import { useAuth } from "@/contexts/auth";
import { PageHeader, SearchInput, Card, Badge } from "@/components/ui";

interface FAQItem {
  q: string;
  a: string;
}
interface FAQSection {
  title: string;
  roles: string[];
  items: FAQItem[];
}

const FAQ_DATA: FAQSection[] = [
  {
    title: "Recruiter FAQs",
    roles: ["RECRUITER"],
    items: [
      {
        q: "How do I submit a daily candidate report?",
        a: "Navigate to 'Daily Report' from the sidebar. Fill in all required fields for your zone (Set A for West/Central zones has 33 fields, Set B for East/North/South has 28 fields). You can save as draft and submit later. Reports lock after the daily submission deadline.",
      },
      {
        q: "How does the zone-based form work?",
        a: "Your assigned zone determines which form fields you see. West and Central zones use Set A with 33 fields including company and SP details. East, North, and South zones use Set B with 28 fields. Your zone is assigned by your Reporting Manager.",
      },
      {
        q: "Can I edit a submitted report?",
        a: "You can edit reports that are still in DRAFT status. Once submitted, only your Reporting Manager can send it back for revision. Approved and locked reports cannot be edited.",
      },
      {
        q: "How do I track my recruitment targets?",
        a: "Go to 'My Targets' in the sidebar to view your daily, weekly, and monthly targets. The progress bar shows your achievement percentage calculated from submitted reports in the target period.",
      },
      {
        q: "How does attendance tracking work?",
        a: "Attendance is recorded automatically based on your daily report submissions. Check-in happens when you submit your first report of the day. Your RM can also mark manual attendance. Holidays are excluded from attendance calculations.",
      },
      {
        q: "What is the candidate pipeline?",
        a: "The pipeline tracks candidates through stages: Sourced \u2192 Screened \u2192 Interviewed \u2192 Selected \u2192 Joined. Each daily report submission moves a candidate through these stages based on the data you enter.",
      },
      {
        q: "How do I use the mobile app?",
        a: "The platform is fully responsive. Access it through your mobile browser at the same URL. All features including report submission, notifications, and dashboard are available on mobile.",
      },
      {
        q: "Why can't I see certain candidates?",
        a: "You can only see candidates from your own reports. Reporting Managers see candidates from all their assigned recruiters. Admins see all candidates across the platform.",
      },
    ],
  },
  {
    title: "Reporting Manager FAQs",
    roles: ["REPORTING_MANAGER"],
    items: [
      {
        q: "How do I review and approve reports?",
        a: "Navigate to 'Team Reports' in the sidebar. Pending reports appear at the top. Click on a report to review details, then approve, reject, or send back for revision with comments.",
      },
      {
        q: "How do I manage my team's targets?",
        a: "Go to 'Admin \u2192 Targets' to create and manage targets for your team. You can set daily, weekly, or monthly targets. Achievement is automatically calculated from approved reports.",
      },
      {
        q: "How do I assign recruiters to zones?",
        a: "In the Users management section, edit a recruiter's profile to assign their zone. The zone determines their report form type (Set A or Set B) and which master data options they see.",
      },
      {
        q: "How do I view team analytics?",
        a: "The Analytics page shows your team's performance metrics including pipeline funnel, recruitment trends, recruiter rankings, and zone distribution. Use date range filters to analyze specific periods.",
      },
      {
        q: "How do I generate team reports?",
        a: "Go to 'Reports Management' to generate and download Excel reports. Available reports include daily summaries, monthly compilations, recruiter performance, and custom date-range reports.",
      },
    ],
  },
  {
    title: "Admin FAQs",
    roles: ["ADMIN"],
    items: [
      {
        q: "How do I manage system users?",
        a: "Navigate to 'Admin \u2192 Users' to create, edit, suspend, or reactivate user accounts. You can assign roles (Admin, Recruiter, Reporting Manager), set zones, and manage reporting relationships.",
      },
      {
        q: "How do I configure master data?",
        a: "Go to 'Admin \u2192 Master Data' to manage dropdown options like sources, qualifications, processes, and other form field values. Options are zone-dependent \u2014 some appear only for specific zones.",
      },
      {
        q: "How do I manage email templates?",
        a: "Navigate to 'Admin \u2192 Email Templates' to customize system emails. You can edit the subject and HTML body of templates for daily reports, account notifications, and password resets. Use {{variables}} for dynamic content.",
      },
      {
        q: "How do I import bulk data?",
        a: "Use 'Admin \u2192 Import' to upload CSV or XLSX files. The import wizard validates data, detects duplicates, and shows a preview before executing. Download the template first to ensure correct column format.",
      },
      {
        q: "How do I manage company and SP data?",
        a: "Companies and Service Providers are managed from their respective sections in the sidebar. You can create, edit, and soft-delete entries. Both support contact information, multiple HR manager associations, and zone assignments.",
      },
      {
        q: "How do I handle duplicate records?",
        a: "Go to 'Admin \u2192 Duplicates' to view auto-detected duplicate groups. The system identifies duplicates based on phone number, email, and name similarity. You can merge or dismiss duplicate groups.",
      },
      {
        q: "How do I view audit logs?",
        a: "Navigate to 'Admin \u2192 Audit Log' to see all system actions. Filter by user, action type, entity, or date range. Each entry shows who did what, when, and the before/after values for data changes.",
      },
      {
        q: "How do I manage active sessions?",
        a: "Go to 'Admin \u2192 Sessions' to view all active user sessions. You can revoke individual sessions or all sessions for a specific user. This is useful when a device is lost or an account may be compromised.",
      },
    ],
  },
];

export default function HelpPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const userRole = user?.role ?? "RECRUITER";

  const filteredSections = useMemo(() => {
    return FAQ_DATA.filter((s) => s.roles.includes(userRole))
      .map((s) => ({
        ...s,
        items:
          search.trim().length < 2
            ? s.items
            : s.items.filter((item) => {
                const lower = search.toLowerCase();
                return item.q.toLowerCase().includes(lower) || item.a.toLowerCase().includes(lower);
              }),
      }))
      .filter((s) => s.items.length > 0);
  }, [userRole, search]);

  const toggle = (key: string) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const totalItems = filteredSections.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Help & FAQ"
        description="Find answers to commonly asked questions about the OMG Teams platform"
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search FAQs..."
        historyKey="help"
      />

      {/* FAQ Sections */}
      {filteredSections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <HelpCircle size={48} className="text-text-muted mb-4" />
          <p className="text-text-muted text-sm">
            No FAQs match your search. Try a different term.
          </p>
        </div>
      ) : (
        <>
          <p className="text-text-muted text-xs">
            {totalItems} question{totalItems !== 1 ? "s" : ""} across {filteredSections.length}{" "}
            section
            {filteredSections.length !== 1 ? "s" : ""}
          </p>

          <div className="space-y-6">
            {filteredSections.map((section) => (
              <div key={section.title}>
                <div className="mb-3 flex items-center gap-2">
                  <BookOpen size={16} className="text-primary-500" />
                  <h2 className="text-text-primary text-sm font-semibold">{section.title}</h2>
                  <Badge variant="default" size="sm">
                    {section.items.length}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {section.items.map((item, idx) => {
                    const key = `${section.title}-${idx}`;
                    const isOpen = !!expanded[key];
                    return (
                      <Card key={key} padding="sm">
                        <button
                          onClick={() => toggle(key)}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <span className="text-text-primary text-sm font-medium">{item.q}</span>
                          {isOpen ? (
                            <ChevronDown size={16} className="text-text-muted shrink-0" />
                          ) : (
                            <ChevronRight size={16} className="text-text-muted shrink-0" />
                          )}
                        </button>
                        {isOpen && (
                          <div className="border-border-default mt-3 border-t pt-3">
                            <p className="text-text-secondary text-sm leading-relaxed">{item.a}</p>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer */}
      <Card className="bg-bg-muted text-center">
        <p className="text-text-secondary text-sm">
          Can&apos;t find what you&apos;re looking for? Contact your system administrator for
          further assistance.
        </p>
      </Card>
    </div>
  );
}
