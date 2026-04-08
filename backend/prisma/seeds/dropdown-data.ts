// ──────────────────────────────────────────────
//  Shared dropdown master data — India
//
//  Single source of truth for the dropdown_options seed. Both the
//  initial seed (`seeds/seed.ts`) and the one-shot backfill script
//  (`scripts/backfill-dropdown-zones.ts`) import from here so the
//  data only needs to be maintained in one place.
//
//  All 28 states + 8 union territories of India are tagged with their
//  geographic zone. Cities are linked to their parent state via
//  `parentValue`, which the seed/backfill resolves to a foreign-key
//  id at insert time. Profiles are universal — no zone, no parent.
// ──────────────────────────────────────────────

import { Prisma, type DropdownCategory, type DropdownOption, type PrismaClient, type Zone } from "@prisma/client";
import { LOCATIONS } from "./districts.js";
export { LOCATIONS };

export type StateSeed = {
  value: string;
  label: string;
  zone: Zone;
};

export type LocationSeed = {
  value: string;
  label: string;
  parentValue: string;
};

export type SimpleSeed = {
  value: string;
  label: string;
};

// ── States + Union Territories (36 total) ────────────────────────

export const STATES: StateSeed[] = [
  // West (4)
  { value: "maharashtra",        label: "Maharashtra",                                   zone: "WEST" },
  { value: "gujarat",            label: "Gujarat",                                       zone: "WEST" },
  { value: "goa",                label: "Goa",                                           zone: "WEST" },
  { value: "dadra_nagar_haveli", label: "Dadra and Nagar Haveli and Daman and Diu",      zone: "WEST" },

  // North (9)
  { value: "delhi",              label: "Delhi",                                         zone: "NORTH" },
  { value: "jammu_kashmir",      label: "Jammu and Kashmir",                             zone: "NORTH" },
  { value: "ladakh",             label: "Ladakh",                                        zone: "NORTH" },
  { value: "himachal_pradesh",   label: "Himachal Pradesh",                              zone: "NORTH" },
  { value: "punjab",             label: "Punjab",                                        zone: "NORTH" },
  { value: "chandigarh",         label: "Chandigarh",                                    zone: "NORTH" },
  { value: "haryana",            label: "Haryana",                                       zone: "NORTH" },
  { value: "rajasthan",          label: "Rajasthan",                                     zone: "NORTH" },
  { value: "uttarakhand",        label: "Uttarakhand",                                   zone: "NORTH" },

  // South (8)
  { value: "karnataka",          label: "Karnataka",                                     zone: "SOUTH" },
  { value: "tamil_nadu",         label: "Tamil Nadu",                                    zone: "SOUTH" },
  { value: "kerala",             label: "Kerala",                                        zone: "SOUTH" },
  { value: "andhra_pradesh",     label: "Andhra Pradesh",                                zone: "SOUTH" },
  { value: "telangana",          label: "Telangana",                                     zone: "SOUTH" },
  { value: "puducherry",         label: "Puducherry",                                    zone: "SOUTH" },
  { value: "lakshadweep",        label: "Lakshadweep",                                   zone: "SOUTH" },
  { value: "andaman_nicobar",    label: "Andaman and Nicobar Islands",                   zone: "SOUTH" },

  // East — includes the 8 Northeast states (Zone enum has no NORTHEAST) (12)
  { value: "west_bengal",        label: "West Bengal",                                   zone: "EAST" },
  { value: "bihar",              label: "Bihar",                                         zone: "EAST" },
  { value: "jharkhand",          label: "Jharkhand",                                     zone: "EAST" },
  { value: "odisha",             label: "Odisha",                                        zone: "EAST" },
  { value: "sikkim",             label: "Sikkim",                                        zone: "EAST" },
  { value: "assam",              label: "Assam",                                         zone: "EAST" },
  { value: "arunachal_pradesh",  label: "Arunachal Pradesh",                             zone: "EAST" },
  { value: "manipur",            label: "Manipur",                                       zone: "EAST" },
  { value: "meghalaya",          label: "Meghalaya",                                     zone: "EAST" },
  { value: "mizoram",            label: "Mizoram",                                       zone: "EAST" },
  { value: "nagaland",           label: "Nagaland",                                      zone: "EAST" },
  { value: "tripura",            label: "Tripura",                                       zone: "EAST" },

  // Central (3)
  { value: "uttar_pradesh",      label: "Uttar Pradesh",                                 zone: "CENTRAL" },
  { value: "madhya_pradesh",     label: "Madhya Pradesh",                                zone: "CENTRAL" },
  { value: "chhattisgarh",       label: "Chhattisgarh",                                  zone: "CENTRAL" },
];


// ── Profiles — universal across all zones ────────────────────────

export const PROFILES: SimpleSeed[] = [
  // ── Sales ──
  { value: "sales_executive",            label: "Sales Executive" },
  { value: "senior_sales_executive",     label: "Senior Sales Executive" },
  { value: "sales_officer",              label: "Sales Officer" },
  { value: "sales_manager",              label: "Sales Manager" },
  { value: "area_sales_manager",         label: "Area Sales Manager" },
  { value: "regional_sales_manager",     label: "Regional Sales Manager" },
  { value: "territory_sales_manager",    label: "Territory Sales Manager" },
  { value: "national_sales_manager",     label: "National Sales Manager" },
  { value: "inside_sales_executive",     label: "Inside Sales Executive" },
  { value: "pre_sales_executive",        label: "Pre-Sales Executive" },
  { value: "channel_sales_executive",    label: "Channel Sales Executive" },
  { value: "key_account_manager",        label: "Key Account Manager" },
  { value: "account_manager",            label: "Account Manager" },
  { value: "client_relationship_exec",   label: "Client Relationship Executive" },
  { value: "telecaller",                 label: "Telecaller" },
  { value: "tele_sales_inbound",         label: "Tele Sales (Inbound)" },
  { value: "tele_sales_outbound",        label: "Tele Sales (Outbound)" },

  // ── Business Development ──
  { value: "business_development",       label: "Business Development Executive" },
  { value: "bdm",                        label: "Business Development Manager" },
  { value: "bd_associate",               label: "Business Development Associate" },
  { value: "partnerships_manager",       label: "Partnerships Manager" },

  // ── Marketing ──
  { value: "marketing_executive",        label: "Marketing Executive" },
  { value: "marketing_manager",          label: "Marketing Manager" },
  { value: "brand_executive",            label: "Brand Executive" },
  { value: "brand_manager",              label: "Brand Manager" },
  { value: "product_manager",            label: "Product Manager" },
  { value: "product_marketing_manager",  label: "Product Marketing Manager" },
  { value: "digital_marketing",          label: "Digital Marketing Executive" },
  { value: "digital_marketing_manager",  label: "Digital Marketing Manager" },
  { value: "seo_executive",              label: "SEO Executive" },
  { value: "sem_specialist",             label: "SEM Specialist" },
  { value: "ppc_specialist",             label: "PPC Specialist" },
  { value: "social_media_executive",     label: "Social Media Executive" },
  { value: "social_media_manager",       label: "Social Media Manager" },
  { value: "performance_marketing",      label: "Performance Marketing Specialist" },
  { value: "email_marketing",            label: "Email Marketing Specialist" },
  { value: "affiliate_marketing",        label: "Affiliate Marketing Manager" },
  { value: "marketing_analyst",          label: "Marketing Analyst" },
  { value: "growth_marketer",            label: "Growth Marketer" },
  { value: "public_relations",           label: "Public Relations Executive" },
  { value: "event_executive",            label: "Event Executive" },
  { value: "event_manager",              label: "Event Manager" },
  { value: "content_writer",             label: "Content Writer" },
  { value: "content_marketer",           label: "Content Marketing Specialist" },
  { value: "copywriter",                 label: "Copywriter" },
  { value: "graphic_designer",           label: "Graphic Designer" },
  { value: "ui_designer",                label: "UI Designer" },
  { value: "ux_designer",                label: "UX Designer" },
  { value: "visual_designer",            label: "Visual Designer" },
  { value: "video_editor",               label: "Video Editor" },
  { value: "animator",                   label: "Animator" },
  { value: "photographer",               label: "Photographer" },

  // ── Customer Service & BPO ──
  { value: "customer_service",           label: "Customer Service Executive" },
  { value: "customer_care",              label: "Customer Care Representative" },
  { value: "customer_support",           label: "Customer Support Executive" },
  { value: "customer_success",           label: "Customer Success Manager" },
  { value: "bpo_voice",                  label: "BPO — Voice Process" },
  { value: "bpo_non_voice",              label: "BPO — Non-voice Process" },
  { value: "email_process",              label: "Email Process Associate" },
  { value: "chat_process",               label: "Chat Process Associate" },
  { value: "process_associate",          label: "Process Associate" },
  { value: "process_lead",               label: "Process Lead" },
  { value: "team_leader_bpo",            label: "Team Leader (BPO)" },
  { value: "quality_analyst_bpo",        label: "Quality Analyst (BPO)" },
  { value: "trainer_bpo",                label: "Trainer (BPO)" },
  { value: "international_voice",        label: "International Voice Process" },
  { value: "domestic_voice",             label: "Domestic Voice Process" },

  // ── Operations & Back Office ──
  { value: "back_office",                label: "Back Office Executive" },
  { value: "data_entry",                 label: "Data Entry Operator" },
  { value: "operations_executive",       label: "Operations Executive" },
  { value: "operations_manager",         label: "Operations Manager" },
  { value: "operations_lead",            label: "Operations Lead" },
  { value: "process_executive",          label: "Process Executive" },
  { value: "documentation_executive",    label: "Documentation Executive" },
  { value: "mis_executive",              label: "MIS Executive" },
  { value: "coordinator",                label: "Coordinator" },
  { value: "office_assistant",           label: "Office Assistant" },
  { value: "scrum_master",               label: "Scrum Master" },

  // ── Field & Logistics ──
  { value: "field_executive",            label: "Field Executive" },
  { value: "field_sales",                label: "Field Sales Executive" },
  { value: "field_officer",              label: "Field Officer" },
  { value: "survey_executive",           label: "Survey Executive" },
  { value: "delivery_executive",         label: "Delivery Executive" },
  { value: "delivery_boy",               label: "Delivery Boy" },
  { value: "driver",                     label: "Driver" },
  { value: "heavy_vehicle_driver",       label: "Heavy Vehicle Driver" },
  { value: "logistics_coordinator",      label: "Logistics Coordinator" },
  { value: "logistics_manager",          label: "Logistics Manager" },
  { value: "supply_chain_executive",     label: "Supply Chain Executive" },
  { value: "supply_chain_manager",       label: "Supply Chain Manager" },
  { value: "procurement_executive",      label: "Procurement Executive" },
  { value: "procurement_manager",        label: "Procurement Manager" },
  { value: "dispatch_executive",         label: "Dispatch Executive" },
  { value: "fleet_manager",              label: "Fleet Manager" },

  // ── Retail ──
  { value: "cashier",                    label: "Cashier" },
  { value: "store_manager",              label: "Store Manager" },
  { value: "asst_store_manager",         label: "Assistant Store Manager" },
  { value: "retail_associate",           label: "Retail Sales Associate" },
  { value: "floor_manager",              label: "Floor Manager" },
  { value: "visual_merchandiser",        label: "Visual Merchandiser" },
  { value: "counter_sales",              label: "Counter Sales Executive" },
  { value: "beauty_advisor",             label: "Beauty Advisor" },
  { value: "fashion_consultant",         label: "Fashion Consultant" },
  { value: "showroom_executive",         label: "Showroom Executive" },

  // ── HR & Admin ──
  { value: "receptionist",               label: "Receptionist" },
  { value: "front_desk_executive",       label: "Front Desk Executive" },
  { value: "hr_executive",               label: "HR Executive" },
  { value: "hr_manager",                 label: "HR Manager" },
  { value: "hr_generalist",              label: "HR Generalist" },
  { value: "hr_business_partner",        label: "HR Business Partner" },
  { value: "recruiter",                  label: "Recruiter" },
  { value: "senior_recruiter",           label: "Senior Recruiter" },
  { value: "talent_acquisition",         label: "Talent Acquisition Specialist" },
  { value: "hr_operations",              label: "HR Operations" },
  { value: "comp_benefits",              label: "Compensation & Benefits Specialist" },
  { value: "training_dev",               label: "Training & Development" },
  { value: "payroll_executive",          label: "Payroll Executive" },
  { value: "admin_executive",            label: "Admin Executive" },
  { value: "admin_manager",              label: "Admin Manager" },
  { value: "office_boy",                 label: "Office Boy" },
  { value: "personal_assistant",         label: "Personal Assistant" },
  { value: "executive_assistant",        label: "Executive Assistant" },
  { value: "office_manager",             label: "Office Manager" },

  // ── Finance & Accounts ──
  { value: "accountant",                 label: "Accountant" },
  { value: "junior_accountant",          label: "Junior Accountant" },
  { value: "senior_accountant",          label: "Senior Accountant" },
  { value: "accounts_executive",         label: "Accounts Executive" },
  { value: "accounts_manager",           label: "Accounts Manager" },
  { value: "finance_executive",          label: "Finance Executive" },
  { value: "finance_manager",            label: "Finance Manager" },
  { value: "tally_operator",             label: "Tally Operator" },
  { value: "gst_executive",              label: "GST Executive" },
  { value: "audit_executive",            label: "Audit Executive" },
  { value: "internal_auditor",           label: "Internal Auditor" },
  { value: "tax_consultant",             label: "Tax Consultant" },
  { value: "cost_accountant",            label: "Cost Accountant" },
  { value: "billing_executive",          label: "Billing Executive" },
  { value: "collections_executive",      label: "Collections Executive" },
  { value: "credit_analyst",             label: "Credit Analyst" },
  { value: "investment_analyst",         label: "Investment Analyst" },
  { value: "ca",                         label: "Chartered Accountant" },
  { value: "cfa",                        label: "Financial Analyst" },

  // ── IT & Technical ──
  { value: "software_developer",         label: "Software Developer" },
  { value: "senior_software_developer",  label: "Senior Software Developer" },
  { value: "software_engineer",          label: "Software Engineer" },
  { value: "tech_lead",                  label: "Tech Lead" },
  { value: "engineering_manager",        label: "Engineering Manager" },
  { value: "frontend_developer",         label: "Frontend Developer" },
  { value: "backend_developer",          label: "Backend Developer" },
  { value: "fullstack_developer",        label: "Full Stack Developer" },
  { value: "web_developer",              label: "Web Developer" },
  { value: "mobile_developer",           label: "Mobile App Developer" },
  { value: "android_developer",          label: "Android Developer" },
  { value: "ios_developer",              label: "iOS Developer" },
  { value: "react_developer",            label: "React Developer" },
  { value: "node_developer",             label: "Node.js Developer" },
  { value: "java_developer",             label: "Java Developer" },
  { value: "python_developer",           label: "Python Developer" },
  { value: "php_developer",              label: "PHP Developer" },
  { value: "dotnet_developer",           label: ".NET Developer" },
  { value: "wordpress_developer",        label: "WordPress Developer" },
  { value: "salesforce_developer",       label: "Salesforce Developer" },
  { value: "qa_engineer",                label: "QA / Test Engineer" },
  { value: "manual_tester",              label: "Manual Tester" },
  { value: "automation_tester",          label: "Automation Tester" },
  { value: "devops_engineer",            label: "DevOps Engineer" },
  { value: "site_reliability_engineer",  label: "Site Reliability Engineer" },
  { value: "system_administrator",       label: "System Administrator" },
  { value: "database_administrator",     label: "Database Administrator" },
  { value: "network_engineer",           label: "Network Engineer" },
  { value: "network_administrator",      label: "Network Administrator" },
  { value: "cloud_engineer",             label: "Cloud Engineer" },
  { value: "aws_engineer",               label: "AWS Engineer" },
  { value: "azure_engineer",             label: "Azure Engineer" },
  { value: "cybersecurity_analyst",      label: "Cybersecurity Analyst" },
  { value: "data_analyst",               label: "Data Analyst" },
  { value: "data_scientist",             label: "Data Scientist" },
  { value: "data_engineer",              label: "Data Engineer" },
  { value: "ml_engineer",                label: "Machine Learning Engineer" },
  { value: "ai_engineer",                label: "AI Engineer" },
  { value: "business_analyst",           label: "Business Analyst" },
  { value: "tech_support",               label: "Technical Support Executive" },
  { value: "it_support",                 label: "IT Support" },
  { value: "help_desk",                  label: "Help Desk Executive" },
  { value: "technical_writer",           label: "Technical Writer" },
  { value: "solution_architect",         label: "Solution Architect" },
  { value: "sap_consultant",             label: "SAP Consultant" },

  // ── Production & Manufacturing ──
  { value: "production_operator",        label: "Production Operator" },
  { value: "production_supervisor",      label: "Production Supervisor" },
  { value: "production_manager",         label: "Production Manager" },
  { value: "machine_operator",           label: "Machine Operator" },
  { value: "cnc_operator",               label: "CNC Operator" },
  { value: "vmc_operator",               label: "VMC Operator" },
  { value: "quality_inspector",          label: "Quality Inspector" },
  { value: "quality_control",            label: "Quality Control Executive" },
  { value: "quality_assurance",          label: "Quality Assurance Executive" },
  { value: "warehouse",                  label: "Warehouse Associate" },
  { value: "warehouse_supervisor",       label: "Warehouse Supervisor" },
  { value: "storekeeper",                label: "Storekeeper" },
  { value: "material_handler",           label: "Material Handler" },
  { value: "forklift_operator",          label: "Forklift Operator" },
  { value: "assembly_line_worker",       label: "Assembly Line Worker" },
  { value: "maintenance_technician",     label: "Maintenance Technician" },
  { value: "tool_die_maker",             label: "Tool & Die Maker" },
  { value: "plant_engineer",             label: "Plant Engineer" },
  { value: "industrial_engineer",        label: "Industrial Engineer" },
  { value: "process_engineer",           label: "Process Engineer" },

  // ── Engineering ──
  { value: "civil_engineer",             label: "Civil Engineer" },
  { value: "mechanical_engineer",        label: "Mechanical Engineer" },
  { value: "electrical_engineer",        label: "Electrical Engineer" },
  { value: "electronics_engineer",       label: "Electronics Engineer" },
  { value: "chemical_engineer",          label: "Chemical Engineer" },
  { value: "automobile_engineer",        label: "Automobile Engineer" },
  { value: "site_engineer",              label: "Site Engineer" },
  { value: "project_engineer",           label: "Project Engineer" },
  { value: "project_manager",            label: "Project Manager" },
  { value: "site_supervisor",            label: "Site Supervisor" },
  { value: "autocad_designer",           label: "AutoCAD Designer" },
  { value: "quantity_surveyor",          label: "Quantity Surveyor" },
  { value: "draftsman",                  label: "Draftsman" },

  // ── Skilled Trades ──
  { value: "electrician",                label: "Electrician" },
  { value: "plumber",                    label: "Plumber" },
  { value: "mechanic",                   label: "Mechanic" },
  { value: "auto_mechanic",              label: "Auto Mechanic" },
  { value: "two_wheeler_mechanic",       label: "Two-Wheeler Mechanic" },
  { value: "welder",                     label: "Welder" },
  { value: "fitter",                     label: "Fitter" },
  { value: "carpenter",                  label: "Carpenter" },
  { value: "mason",                      label: "Mason" },
  { value: "painter",                    label: "Painter" },
  { value: "tailor",                     label: "Tailor" },
  { value: "ac_technician",              label: "AC Technician" },
  { value: "refrigerator_technician",    label: "Refrigerator Technician" },
  { value: "tv_technician",              label: "TV Technician" },
  { value: "mobile_repair_technician",   label: "Mobile Repair Technician" },
  { value: "computer_hardware",          label: "Computer Hardware Technician" },
  { value: "solar_technician",           label: "Solar Technician" },
  { value: "lift_technician",            label: "Lift Technician" },

  // ── Healthcare ──
  { value: "nurse_gnm",                  label: "Nurse (GNM)" },
  { value: "nurse_bsc",                  label: "Nurse (BSc)" },
  { value: "anm",                        label: "ANM (Auxiliary Nurse Midwife)" },
  { value: "ward_boy",                   label: "Ward Boy" },
  { value: "pharmacist",                 label: "Pharmacist" },
  { value: "lab_technician",             label: "Lab Technician" },
  { value: "xray_technician",            label: "X-Ray Technician" },
  { value: "ot_technician",              label: "OT Technician" },
  { value: "dental_assistant",           label: "Dental Assistant" },
  { value: "physiotherapist",            label: "Physiotherapist" },
  { value: "medical_representative",     label: "Medical Representative" },
  { value: "medical_coder",              label: "Medical Coder" },
  { value: "hospital_administrator",     label: "Hospital Administrator" },
  { value: "radiologist",                label: "Radiologist" },
  { value: "nutritionist",               label: "Nutritionist" },

  // ── Education ──
  { value: "teacher_primary",            label: "Teacher (Primary)" },
  { value: "teacher_secondary",          label: "Teacher (Secondary)" },
  { value: "teacher_higher",             label: "Teacher (Higher Secondary)" },
  { value: "tutor",                      label: "Private Tutor" },
  { value: "professor",                  label: "Professor" },
  { value: "lecturer",                   label: "Lecturer" },
  { value: "academic_coordinator",       label: "Academic Coordinator" },
  { value: "counselor",                  label: "Counselor" },
  { value: "trainer",                    label: "Trainer" },
  { value: "librarian",                  label: "Librarian" },

  // ── Banking & Insurance ──
  { value: "bank_po",                    label: "Bank PO" },
  { value: "bank_clerk",                 label: "Bank Clerk" },
  { value: "branch_manager",             label: "Branch Manager" },
  { value: "loan_officer",               label: "Loan Officer" },
  { value: "relationship_manager",       label: "Relationship Manager" },
  { value: "insurance_agent",            label: "Insurance Agent" },
  { value: "insurance_advisor",          label: "Insurance Advisor" },
  { value: "credit_manager",             label: "Credit Manager" },
  { value: "risk_analyst",               label: "Risk Analyst" },
  { value: "wealth_manager",             label: "Wealth Manager" },

  // ── Legal & Compliance ──
  { value: "legal_executive",            label: "Legal Executive" },
  { value: "legal_advisor",              label: "Legal Advisor" },
  { value: "paralegal",                  label: "Paralegal" },
  { value: "compliance_officer",         label: "Compliance Officer" },
  { value: "company_secretary",          label: "Company Secretary" },

  // ── Media & Journalism ──
  { value: "journalist",                 label: "Journalist" },
  { value: "reporter",                   label: "Reporter" },
  { value: "editor",                     label: "Editor" },
  { value: "sub_editor",                 label: "Sub-Editor" },
  { value: "news_anchor",                label: "News Anchor" },
  { value: "camera_operator",            label: "Camera Operator" },
  { value: "rj",                         label: "Radio Jockey" },

  // ── Hospitality & Food Service ──
  { value: "cook",                       label: "Cook" },
  { value: "chef",                       label: "Chef" },
  { value: "sous_chef",                  label: "Sous Chef" },
  { value: "kitchen_helper",             label: "Kitchen Helper" },
  { value: "waiter",                     label: "Waiter" },
  { value: "steward",                    label: "Steward" },
  { value: "bartender",                  label: "Bartender" },
  { value: "captain",                    label: "Restaurant Captain" },
  { value: "hotel_manager",              label: "Hotel Manager" },
  { value: "front_office_hotel",         label: "Front Office Executive (Hotel)" },
  { value: "housekeeping_attendant",     label: "Housekeeping Attendant" },
  { value: "housekeeping_supervisor",    label: "Housekeeping Supervisor" },
  { value: "laundry_operator",           label: "Laundry Operator" },
  { value: "spa_therapist",              label: "Spa Therapist" },
  { value: "salon_stylist",              label: "Salon Stylist" },
  { value: "beautician",                 label: "Beautician" },

  // ── Aviation & Travel ──
  { value: "cabin_crew",                 label: "Cabin Crew / Air Hostess" },
  { value: "ground_staff",               label: "Ground Staff" },
  { value: "travel_consultant",          label: "Travel Consultant" },
  { value: "tour_guide",                 label: "Tour Guide" },

  // ── Security & Support ──
  { value: "security_guard",             label: "Security Guard" },
  { value: "security_supervisor",        label: "Security Supervisor" },
  { value: "bouncer",                    label: "Bouncer" },
  { value: "loss_prevention",            label: "Loss Prevention Officer" },
  { value: "cctv_operator",              label: "CCTV Operator" },
  { value: "housekeeping",               label: "Housekeeping" },
  { value: "sweeper",                    label: "Sweeper" },
  { value: "cleaner",                    label: "Cleaner" },
  { value: "gardener",                   label: "Gardener" },
  { value: "peon",                       label: "Peon" },
  { value: "messenger",                  label: "Messenger" },
];

// ── Flat lists (no zone, no parent) ───────────────────────────────

export const QUALIFICATIONS: SimpleSeed[] = [
  { value: "10th",         label: "10th Pass" },
  { value: "12th",         label: "12th Pass" },
  { value: "diploma",      label: "Diploma" },
  { value: "graduate",     label: "Graduate" },
  { value: "post_graduate",label: "Post Graduate" },
  { value: "mba",          label: "MBA" },
  { value: "btech",        label: "B.Tech / B.E." },
  { value: "other",        label: "Other" },
];

export const NOTICE_PERIODS: SimpleSeed[] = [
  { value: "immediate",         label: "Immediate" },
  { value: "7_days",            label: "7 Days" },
  { value: "15_days",           label: "15 Days" },
  { value: "30_days",           label: "30 Days" },
  { value: "60_days",           label: "60 Days" },
  { value: "90_days",           label: "90 Days" },
  { value: "currently_serving", label: "Currently Serving" },
];

export const DIPLOMA_TYPES: SimpleSeed[] = [
  { value: "part", label: "Diploma (Part)" },
  { value: "full", label: "Diploma (Full)" },
  { value: "na",   label: "N/A" },
];

// ──────────────────────────────────────────────
//  Upsert helper — used by both the seed and the backfill script.
//
//  Two-pass: states first so each one has a generated id, then everything
//  else with `parentValue` resolved against the state map. Profiles always
//  get `zoneSet` cleared because the new design treats them as universal.
//
//  Idempotent — re-running it on a populated DB just no-ops on rows that
//  are already correct, and re-tags any that drifted (e.g. an existing
//  state row whose zone was previously NULL after a `db push`).
// ──────────────────────────────────────────────

export interface DropdownSeedReport {
  statesUpserted: number;
  locationsUpserted: number;
  locationsSkipped: number;
  profilesUpserted: number;
  profilesZoneSetCleared: number;
  qualificationsUpserted: number;
  noticePeriodsUpserted: number;
  diplomaTypesUpserted: number;
}

// Prisma's generated compound-unique input types nullable @@unique fields as
// non-nullable, so we can't pass `zoneSet: null` to upsert's `where`. Use a
// findFirst + update/create pair instead — same idempotent semantics.
async function upsertByCategoryValue(
  prisma: PrismaClient,
  category: DropdownCategory,
  value: string,
  create: Omit<Prisma.DropdownOptionUncheckedCreateInput, "category" | "value">,
  update: Prisma.DropdownOptionUncheckedUpdateInput,
): Promise<DropdownOption> {
  const existing = await prisma.dropdownOption.findFirst({
    where: { category, value, zoneSet: null },
  });
  if (existing) {
    return prisma.dropdownOption.update({ where: { id: existing.id }, data: update });
  }
  return prisma.dropdownOption.create({ data: { category, value, ...create } });
}

export async function seedDropdownOptions(prisma: PrismaClient): Promise<DropdownSeedReport> {
  const report: DropdownSeedReport = {
    statesUpserted: 0,
    locationsUpserted: 0,
    locationsSkipped: 0,
    profilesUpserted: 0,
    profilesZoneSetCleared: 0,
    qualificationsUpserted: 0,
    noticePeriodsUpserted: 0,
    diplomaTypesUpserted: 0,
  };

  // ── 1. States ──
  const stateIdByValue = new Map<string, string>();
  for (let i = 0; i < STATES.length; i++) {
    const s = STATES[i]!;
    const row = await upsertByCategoryValue(
      prisma,
      "STATE",
      s.value,
      { label: s.label, zone: s.zone, sortOrder: i + 1, isActive: true },
      // Don't clobber sortOrder on existing rows — admin may have re-ordered.
      { label: s.label, zone: s.zone },
    );
    stateIdByValue.set(s.value, row.id);
    report.statesUpserted++;
  }

  // ── 2. Locations ──
  for (let i = 0; i < LOCATIONS.length; i++) {
    const l = LOCATIONS[i]!;
    const parentId = stateIdByValue.get(l.parentValue);
    if (!parentId) {
      report.locationsSkipped++;
      continue;
    }
    await upsertByCategoryValue(
      prisma,
      "LOCATION",
      l.value,
      { label: l.label, parentId, sortOrder: i + 1, isActive: true },
      { label: l.label, parentId },
    );
    report.locationsUpserted++;
  }

  // ── 3. Profiles (universal — no zone, no parent) ──
  for (let i = 0; i < PROFILES.length; i++) {
    const p = PROFILES[i]!;
    await upsertByCategoryValue(
      prisma,
      "PROFILE",
      p.value,
      { label: p.label, sortOrder: i + 1, isActive: true },
      { label: p.label },
    );
    report.profilesUpserted++;
  }

  // Wipe legacy SET_A/SET_B tags off any pre-existing profile rows from the
  // old schema. New rows already have zoneSet=null.
  const profileWipe = await prisma.dropdownOption.updateMany({
    where: { category: "PROFILE", zoneSet: { not: null } },
    data: { zoneSet: null },
  });
  report.profilesZoneSetCleared = profileWipe.count;

  // ── 4. Flat lists ──
  for (let i = 0; i < QUALIFICATIONS.length; i++) {
    const q = QUALIFICATIONS[i]!;
    await upsertByCategoryValue(
      prisma,
      "QUALIFICATION",
      q.value,
      { label: q.label, sortOrder: i + 1, isActive: true },
      { label: q.label },
    );
    report.qualificationsUpserted++;
  }

  for (let i = 0; i < NOTICE_PERIODS.length; i++) {
    const n = NOTICE_PERIODS[i]!;
    await upsertByCategoryValue(
      prisma,
      "NOTICE_PERIOD",
      n.value,
      { label: n.label, sortOrder: i + 1, isActive: true },
      { label: n.label },
    );
    report.noticePeriodsUpserted++;
  }

  for (let i = 0; i < DIPLOMA_TYPES.length; i++) {
    const d = DIPLOMA_TYPES[i]!;
    await upsertByCategoryValue(
      prisma,
      "DIPLOMA",
      d.value,
      { label: d.label, sortOrder: i + 1, isActive: true },
      { label: d.label },
    );
    report.diplomaTypesUpserted++;
  }

  return report;
}
