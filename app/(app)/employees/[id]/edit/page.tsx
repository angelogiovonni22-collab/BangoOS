"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { EmployeeForm } from "@/components/employees";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { createEmployeeService, type Employee } from "@/lib/employees";
import type { EmployeeProfile } from "@/lib/employees";
import { createCrewService } from "@/lib/crews";
import { useI18n } from "@/lib/i18n/provider";

export default function EditEmployeePage() {
  const params = useParams<{ id?: string | string[] }>();
  const employeeId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const { t } = useI18n();
  const router = useRouter();
  const employeeService = useMemo(() => createEmployeeService(), []);
  const crewService = useMemo(() => createCrewService(), []);

  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [crewOptions, setCrewOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!employeeId) {
        setErrorMessage("employees.errorMissingId");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [loadedProfile, crews] = await Promise.all([
          employeeService.getEmployee(employeeId),
          crewService.getCrews({
            query: "",
            status: "all",
            leadId: "all",
            supervisorId: "all",
            projectId: "all",
            assignmentStatus: "all",
            sortBy: "name_asc",
            page: 1,
            pageSize: 50,
          }),
        ]);

        if (!active) {
          return;
        }

        if (!loadedProfile) {
          setErrorMessage("employees.notFound.description");
          setIsLoading(false);
          return;
        }

        const options = crews.items.map((crew) => crew.name).filter(Boolean);
        setCrewOptions(options.length > 0 ? options : ["General Crew"]);
        setProfile(loadedProfile);
      } catch {
        if (active) {
          setErrorMessage("employees.errorLoadProfile");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [crewService, employeeId, employeeService]);

  const initialValue = useMemo<Employee | undefined>(() => {
    if (!profile) {
      return undefined;
    }

    const overview = profile.overview;
    return {
      id: overview.id,
      employeeNumber: overview.employeeNumber,
      fullName: overview.fullName,
      positionTitle: overview.positionTitle,
      trade: overview.trade,
      employmentStatus: overview.employmentStatus,
      availabilityStatus: overview.availabilityStatus,
      supervisorName: overview.supervisorName,
      supervisorProfileId: overview.supervisorProfileId,
      primaryCrewId: overview.primaryCrewId,
      primaryCrewName: overview.primaryCrewName,
      currentAssignmentId: overview.currentAssignmentId,
      currentAssignmentTitle: overview.currentAssignmentTitle,
      currentProjectId: overview.currentProjectId,
      currentProjectName: overview.currentProjectName,
      currentPhaseOrTask: overview.currentPhaseOrTask,
      currentAssignmentStatus: overview.currentAssignmentStatus,
      hireDate: overview.hireDate,
      updatedAt: overview.updatedAt,
      notes: overview.notes,
      terminationDate: overview.terminationDate,
      assignmentBucket: overview.assignmentBucket,
      equipmentCount: overview.equipmentCount,
      position: overview.positionTitle,
      crew: overview.primaryCrewName || crewOptions[0] || "General Crew",
      supervisor: overview.supervisorName || "",
      phone: "",
      email: "",
      currentAssignment: overview.currentAssignmentTitle,
      activeToday: overview.assignmentBucket === "current",
      hiredOn: overview.hireDate,
      birthDate: "",
      address: "",
      emergencyContact: {
        name: "",
        relationship: "",
        phone: "",
      },
      certifications: [],
      skills: [],
      assignedProjects: [],
      employmentHistory: [],
      avatarUrl: null,
    };
  }, [crewOptions, profile]);

  const handleSubmit = async (value: Parameters<typeof employeeService.updateEmployee>[1]) => {
    if (!employeeId || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await employeeService.updateEmployee(employeeId, value);
      if (!updated) {
        throw new Error("Unable to update employee");
      }

      router.push(`/employees/${employeeId}`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Employee records" description="Update workforce employee details." />
      </div>
    );
  }

  if (errorMessage) {
    return <ErrorState title={t("employees.errorTitle")} description={t(errorMessage)} />;
  }

  if (!initialValue) {
    return (
      <EmptyState
        title={t("employees.notFound.title")}
        description={t("employees.notFound.description")}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Employee records" description="Update workforce employee details." />
      <EmployeeForm
        mode="edit"
        initialValue={initialValue}
        crewOptions={crewOptions}
        isSaving={isSaving}
        onSubmit={handleSubmit}
        onCancel={() => router.push(employeeId ? `/employees/${employeeId}` : "/employees")}
        t={t}
      />
    </div>
  );
}
