import type {
  Employee,
  EmploymentStatus,
  AvailabilityStatus,
  EmployeeDashboardSummary,
  EmployeeFilters,
  EmployeeListResult,
  SortKey,
  UpsertEmployeeInput,
} from "./types";

const STORAGE_KEY = "bangoos.mock.employees.v1";

const baseEmployees: Employee[] = [
  {
    id: "emp-001",
    avatarUrl: "/avatars/emp-001.svg",
    fullName: "Maya Rivera",
    position: "Project Superintendent",
    crew: "Field Ops Alpha",
    supervisor: "Daniel Ortiz",
    phone: "(512) 555-0131",
    email: "maya.rivera@bangoos.dev",
    employmentStatus: "active",
    availabilityStatus: "assigned",
    currentAssignment: "Northpoint Medical Center",
    activeToday: true,
    hiredOn: "2021-03-14",
    birthDate: "1988-09-22",
    address: "1402 W 6th St, Austin, TX 78703",
    emergencyContact: {
      name: "Gabriel Rivera",
      relationship: "Spouse",
      phone: "(512) 555-0220",
    },
    certifications: [
      { id: "cert-001", name: "OSHA 30", issuer: "OSHA", expiresAt: "2027-04-15" },
      { id: "cert-002", name: "First Aid / CPR", issuer: "Red Cross", expiresAt: "2026-11-12" },
    ],
    skills: ["Scheduling", "Subcontractor Coordination", "Site Safety", "Inspection Prep"],
    assignedProjects: [
      { id: "prj-101", projectName: "Northpoint Medical Center", role: "Site Lead", startDate: "2026-01-12", status: "active" },
    ],
    employmentHistory: [
      { id: "hist-001", title: "Assistant Superintendent", crew: "Field Ops Alpha", startedOn: "2021-03-14", endedOn: "2023-06-01", summary: "Managed daily logs and trade coordination." },
      { id: "hist-002", title: "Project Superintendent", crew: "Field Ops Alpha", startedOn: "2023-06-02", endedOn: null, summary: "Leads execution and risk mitigation for healthcare projects." },
    ],
    notes: "Excellent with owner communication. Prefers early AM inspections.",
  },
  {
    id: "emp-002",
    avatarUrl: "/avatars/emp-002.svg",
    fullName: "Noah Bennett",
    position: "Estimator",
    crew: "Preconstruction",
    supervisor: "Renee Wallace",
    phone: "(737) 555-0188",
    email: "noah.bennett@bangoos.dev",
    employmentStatus: "active",
    availabilityStatus: "available",
    currentAssignment: null,
    activeToday: true,
    hiredOn: "2022-08-09",
    birthDate: "1992-01-11",
    address: "3905 S Lamar Blvd, Austin, TX 78704",
    emergencyContact: {
      name: "Lena Bennett",
      relationship: "Sibling",
      phone: "(737) 555-0889",
    },
    certifications: [
      { id: "cert-003", name: "Bluebeam Certified Professional", issuer: "Bluebeam", expiresAt: null },
    ],
    skills: ["Takeoffs", "Value Engineering", "Bid Packaging", "Cost Modeling"],
    assignedProjects: [],
    employmentHistory: [
      { id: "hist-003", title: "Estimator", crew: "Preconstruction", startedOn: "2022-08-09", endedOn: null, summary: "Produces conceptual through GMP estimates." },
    ],
    notes: "Strong conceptual estimating for TI projects.",
  },
  {
    id: "emp-003",
    avatarUrl: "/avatars/emp-003.svg",
    fullName: "Avery Singh",
    position: "Carpenter Foreman",
    crew: "Interior Crew",
    supervisor: "Daniel Ortiz",
    phone: "(512) 555-0192",
    email: "avery.singh@bangoos.dev",
    employmentStatus: "active",
    availabilityStatus: "assigned",
    currentAssignment: "Harper Residence",
    activeToday: true,
    hiredOn: "2020-11-03",
    birthDate: "1986-06-28",
    address: "6409 Berkett Dr, Austin, TX 78745",
    emergencyContact: {
      name: "Priya Singh",
      relationship: "Spouse",
      phone: "(512) 555-0714",
    },
    certifications: [
      { id: "cert-004", name: "Forklift Operator", issuer: "NCCER", expiresAt: "2028-02-10" },
    ],
    skills: ["Framing", "Finish Carpentry", "Punchlist", "Crew Leadership"],
    assignedProjects: [
      { id: "prj-102", projectName: "Harper Residence", role: "Foreman", startDate: "2026-02-01", status: "active" },
    ],
    employmentHistory: [
      { id: "hist-004", title: "Lead Carpenter", crew: "Interior Crew", startedOn: "2020-11-03", endedOn: "2024-01-15", summary: "Led framing/finish tasks across residential jobs." },
      { id: "hist-005", title: "Carpenter Foreman", crew: "Interior Crew", startedOn: "2024-01-16", endedOn: null, summary: "Runs daily huddles and tracks quality checkpoints." },
    ],
    notes: "Trusted for complex millwork installs.",
  },
  {
    id: "emp-004",
    avatarUrl: "/avatars/emp-004.svg",
    fullName: "Isabella Flores",
    position: "Project Engineer",
    crew: "Field Ops Bravo",
    supervisor: "Camila Reyes",
    phone: "(512) 555-0177",
    email: "isabella.flores@bangoos.dev",
    employmentStatus: "on_leave",
    availabilityStatus: "off_shift",
    currentAssignment: null,
    activeToday: false,
    hiredOn: "2023-04-19",
    birthDate: "1995-12-05",
    address: "2117 E 7th St, Austin, TX 78702",
    emergencyContact: {
      name: "Sofia Flores",
      relationship: "Parent",
      phone: "(512) 555-0655",
    },
    certifications: [
      { id: "cert-005", name: "Procore Certified: Project Manager", issuer: "Procore", expiresAt: null },
    ],
    skills: ["Submittals", "RFI Management", "Meeting Minutes", "Closeout"],
    assignedProjects: [
      { id: "prj-103", projectName: "Dock Expansion", role: "Project Engineer", startDate: "2025-09-20", status: "active" },
    ],
    employmentHistory: [
      { id: "hist-006", title: "Project Engineer", crew: "Field Ops Bravo", startedOn: "2023-04-19", endedOn: null, summary: "Supports project controls and documentation." },
    ],
    notes: "On approved leave through next sprint.",
  },
  {
    id: "emp-005",
    avatarUrl: "/avatars/emp-005.svg",
    fullName: "Ethan Cole",
    position: "Safety Coordinator",
    crew: "Safety",
    supervisor: "Nate McCall",
    phone: "(737) 555-0146",
    email: "ethan.cole@bangoos.dev",
    employmentStatus: "active",
    availabilityStatus: "available",
    currentAssignment: null,
    activeToday: true,
    hiredOn: "2019-07-01",
    birthDate: "1984-03-17",
    address: "9900 Research Blvd, Austin, TX 78759",
    emergencyContact: {
      name: "Diana Cole",
      relationship: "Spouse",
      phone: "(737) 555-0981",
    },
    certifications: [
      { id: "cert-006", name: "CHST", issuer: "BCSP", expiresAt: "2027-09-30" },
      { id: "cert-007", name: "OSHA 500", issuer: "OSHA", expiresAt: "2026-12-31" },
    ],
    skills: ["Safety Audits", "Incident Response", "Training", "JHA Reviews"],
    assignedProjects: [
      { id: "prj-104", projectName: "Project Oak", role: "Safety Oversight", startDate: "2026-03-10", status: "active" },
    ],
    employmentHistory: [
      { id: "hist-007", title: "Safety Coordinator", crew: "Safety", startedOn: "2019-07-01", endedOn: null, summary: "Leads weekly audits and toolbox talks." },
    ],
    notes: "Leads monthly all-hands safety workshops.",
  },
  {
    id: "emp-006",
    avatarUrl: "/avatars/emp-006.svg",
    fullName: "Jordan Kim",
    position: "Electrician",
    crew: "MEP Crew",
    supervisor: "Camila Reyes",
    phone: "(512) 555-0118",
    email: "jordan.kim@bangoos.dev",
    employmentStatus: "inactive",
    availabilityStatus: "off_shift",
    currentAssignment: null,
    activeToday: false,
    hiredOn: "2018-05-22",
    birthDate: "1983-10-01",
    address: "701 Tillery St, Austin, TX 78702",
    emergencyContact: {
      name: "Hana Kim",
      relationship: "Spouse",
      phone: "(512) 555-0662",
    },
    certifications: [
      { id: "cert-008", name: "Journeyman Electrician", issuer: "State of Texas", expiresAt: "2027-06-01" },
    ],
    skills: ["Rough-In", "Service Panels", "Lighting Controls"],
    assignedProjects: [],
    employmentHistory: [
      { id: "hist-008", title: "Electrician", crew: "MEP Crew", startedOn: "2018-05-22", endedOn: "2026-05-30", summary: "Handled TI electrical scope and commissioning support." },
    ],
    notes: "Seasonal rehire candidate.",
  },
];

function withExtendedRoster(seed: Employee[]): Employee[] {
  const extras: Employee[] = [];
  const crews = ["Field Ops Alpha", "Field Ops Bravo", "Interior Crew", "MEP Crew", "Preconstruction"];
  const positions = ["Assistant PM", "Scheduler", "Concrete Lead", "Site Coordinator", "Field Engineer"];
  const supervisors = ["Daniel Ortiz", "Camila Reyes", "Renee Wallace", "Nate McCall", "Javier Morales"];
  const names = [
    "Liam Patel",
    "Sofia Alvarez",
    "Marcus Johnson",
    "Elena Torres",
    "Caleb Wright",
    "Priya Menon",
    "Hudson Clark",
    "Naomi Brooks",
    "Diego Navarro",
    "Grace Whitman",
    "Trevor Scott",
    "Aaliyah Price",
    "Mateo Ramirez",
    "Ivy Larson",
    "Brandon Hayes",
    "Kira Dawson",
    "Jonah Silva",
    "Adriana Vega",
  ];
  const projects = [
    "Northpoint Medical Center",
    "Harper Residence",
    "Project Oak",
    "Dock Expansion",
    "Summit Retail TI",
    "Cedar Grove Townhomes",
    "Lakeside Lab Buildout",
    "Barton Creek Clubhouse",
  ];

  for (let i = 7; i <= 24; i += 1) {
    const idx = i - 7;
    const status: EmploymentStatus = i % 9 === 0 ? "on_leave" : i % 11 === 0 ? "inactive" : "active";
    const availability: AvailabilityStatus = status !== "active" ? "off_shift" : i % 2 === 0 ? "assigned" : "available";
    const activeToday = status === "active" && i % 5 !== 0;
    const crew = crews[idx % crews.length];
    const position = positions[idx % positions.length];
    const hasAssignment = availability === "assigned";

    extras.push({
      id: `emp-${String(i).padStart(3, "0")}`,
      avatarUrl: i <= 12 ? `/avatars/emp-${String(i).padStart(3, "0")}.svg` : null,
      fullName: names[idx],
      position,
      crew,
      supervisor: supervisors[idx % supervisors.length],
      phone: `(512) 555-${String(1100 + i).slice(-4)}`,
      email: `${names[idx].toLowerCase().replace(/\s+/g, ".")}@bangoos.dev`,
      employmentStatus: status,
      availabilityStatus: availability,
      currentAssignment: hasAssignment ? projects[idx % projects.length] : null,
      activeToday,
      hiredOn: `202${idx % 6}-0${(idx % 8) + 1}-1${idx % 9}`,
      birthDate: `199${idx % 10}-0${(idx % 8) + 1}-0${(idx % 9) + 1}`,
      address: `${100 + i} Craft Ln, Austin, TX 7870${idx % 9}`,
      emergencyContact: {
        name: `Contact ${i}`,
        relationship: idx % 2 === 0 ? "Spouse" : "Sibling",
        phone: `(737) 555-${String(1200 + i).slice(-4)}`,
      },
      certifications: [
        {
          id: `cert-${String(100 + i)}`,
          name: idx % 2 === 0 ? "OSHA 10" : "First Aid / CPR",
          issuer: idx % 2 === 0 ? "OSHA" : "Red Cross",
          expiresAt: idx % 3 === 0 ? null : `202${7 + (idx % 2)}-0${(idx % 9) + 1}-15`,
        },
      ],
      skills: ["Communication", "Quality Control", "Crew Support"],
      assignedProjects: hasAssignment
        ? [
            {
              id: `prj-${200 + i}`,
              projectName: projects[idx % projects.length],
              role: position,
              startDate: `2026-0${(idx % 8) + 1}-0${(idx % 9) + 1}`,
              status: "active",
            },
          ]
        : [],
      employmentHistory: [
        {
          id: `hist-${200 + i}`,
          title: position,
          crew,
          startedOn: `202${idx % 6}-0${(idx % 8) + 1}-1${idx % 9}`,
          endedOn: status === "inactive" ? "2026-04-30" : null,
          summary: "Contributed to field operations and milestone delivery.",
        },
      ],
      notes: status === "on_leave" ? "Temporary leave approved." : "Strong team contributor.",
    });
  }

  return [...seed, ...extras];
}

const seededEmployees = withExtendedRoster(baseEmployees);

function isBrowser() {
  return typeof window !== "undefined";
}

function readStoredEmployees() {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as Employee[];
  } catch {
    return null;
  }
}

function writeStoredEmployees(items: Employee[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function getAllEmployees() {
  return readStoredEmployees() || seededEmployees;
}

function compareBy(a: Employee, b: Employee, sortBy: SortKey) {
  const collator = new Intl.Collator("en", { sensitivity: "base" });

  const pick = (value: string | null | undefined) => value || "";

  switch (sortBy) {
    case "name_desc":
      return collator.compare(b.fullName, a.fullName);
    case "position_asc":
      return collator.compare(a.position, b.position);
    case "position_desc":
      return collator.compare(b.position, a.position);
    case "crew_asc":
      return collator.compare(a.crew, b.crew);
    case "crew_desc":
      return collator.compare(b.crew, a.crew);
    case "status_asc":
      return collator.compare(a.employmentStatus, b.employmentStatus);
    case "status_desc":
      return collator.compare(b.employmentStatus, a.employmentStatus);
    case "name_asc":
    default:
      return collator.compare(pick(a.fullName), pick(b.fullName));
  }
}

export function listEmployees(filters: EmployeeFilters): EmployeeListResult {
  const { query, crew, employmentStatus, availabilityStatus, sortBy, page, pageSize } = filters;
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = getAllEmployees()
    .filter((employee) => {
      const matchesQuery =
        !normalizedQuery
        || employee.fullName.toLowerCase().includes(normalizedQuery)
        || employee.position.toLowerCase().includes(normalizedQuery)
        || employee.crew.toLowerCase().includes(normalizedQuery)
        || employee.email.toLowerCase().includes(normalizedQuery)
        || employee.phone.toLowerCase().includes(normalizedQuery)
        || (employee.currentAssignment || "").toLowerCase().includes(normalizedQuery);

      const matchesCrew = crew === "all" || employee.crew === crew;
      const matchesEmployment = employmentStatus === "all" || employee.employmentStatus === employmentStatus;
      const matchesAvailability = availabilityStatus === "all" || employee.availabilityStatus === availabilityStatus;

      return matchesQuery && matchesCrew && matchesEmployment && matchesAvailability;
    })
    .sort((a, b) => compareBy(a, b, sortBy));

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return {
    items,
    total,
    totalPages,
    page: safePage,
    pageSize,
  };
}

export function getEmployeeDashboardSummary(): EmployeeDashboardSummary {
  const employees = getAllEmployees();

  return {
    totalEmployees: employees.length,
    activeToday: employees.filter((employee) => employee.activeToday).length,
    available: employees.filter((employee) => employee.availabilityStatus === "available" && employee.employmentStatus === "active").length,
    assignedToProjects: employees.filter((employee) => employee.availabilityStatus === "assigned").length,
    onLeave: employees.filter((employee) => employee.employmentStatus === "on_leave").length,
  };
}

export function getEmployeeById(employeeId: string): Employee | null {
  return getAllEmployees().find((employee) => employee.id === employeeId) || null;
}

export function getCrewOptions(): string[] {
  return Array.from(new Set(getAllEmployees().map((employee) => employee.crew))).sort((a, b) => a.localeCompare(b));
}

export function createEmployee(input: UpsertEmployeeInput): Employee {
  const employee: Employee = {
    id: `emp-${Math.random().toString(36).slice(2, 10)}`,
    avatarUrl: input.avatarUrl || null,
    fullName: input.fullName,
    position: input.position,
    crew: input.crew,
    supervisor: input.supervisor,
    phone: input.phone,
    email: input.email,
    employmentStatus: input.employmentStatus,
    availabilityStatus: input.availabilityStatus,
    currentAssignment: input.currentAssignment,
    activeToday: input.activeToday,
    hiredOn: input.hiredOn,
    birthDate: input.birthDate,
    address: input.address,
    emergencyContact: input.emergencyContact,
    certifications: input.certifications,
    skills: input.skills,
    assignedProjects: input.assignedProjects,
    employmentHistory: input.employmentHistory,
    notes: input.notes,
  };

  const items = [employee, ...getAllEmployees()];
  writeStoredEmployees(items);
  return employee;
}

export function updateEmployee(employeeId: string, input: UpsertEmployeeInput): Employee | null {
  const existing = getEmployeeById(employeeId);

  if (!existing) {
    return null;
  }

  const updated: Employee = {
    ...existing,
    ...input,
    avatarUrl: input.avatarUrl || null,
  };

  const items = getAllEmployees().map((employee) => (employee.id === employeeId ? updated : employee));
  writeStoredEmployees(items);
  return updated;
}

export function clearEmployeeMocks() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}
