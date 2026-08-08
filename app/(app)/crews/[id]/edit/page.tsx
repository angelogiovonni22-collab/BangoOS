"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { CrewForm } from "@/components/crews";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { createCrewService, type Crew, type CrewEmployeeOption, type CrewMember, type CrewProfile } from "@/lib/crews";
import { useI18n } from "@/lib/i18n/provider";

export default function EditCrewPage() {
  const params = useParams<{ id?: string | string[] }>();
  const crewId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const { t } = useI18n();
  const router = useRouter();
  const crewService = useMemo(() => createCrewService(), []);

  const [profile, setProfile] = useState<CrewProfile | null>(null);
  const [employeeOptions, setEmployeeOptions] = useState<CrewEmployeeOption[]>([]);
  const [specialtyOptions, setSpecialtyOptions] = useState<string[]>([]);
  const [projectOptions, setProjectOptions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!crewId) {
        setErrorMessage("crews.errorMissingId");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [loadedProfile, employees, specialties, projects] = await Promise.all([
          crewService.getCrew(crewId),
          crewService.getEmployeeOptions(),
          crewService.getSpecialtyOptions(),
          crewService.getProjectOptions(),
        ]);

        if (!active) {
          return;
        }

        if (!loadedProfile) {
          setErrorMessage("crews.notFound.description");
          setIsLoading(false);
          return;
        }

        setProfile(loadedProfile);
        setEmployeeOptions(employees);
        setSpecialtyOptions(specialties.length > 0 ? specialties : ["General Labor"]);
        setProjectOptions(projects.map((project) => project.label));
      } catch {
        if (active) {
          setErrorMessage("crews.errorLoadProfile");
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
  }, [crewId, crewService]);

  let initialValue: Crew | undefined;
  if (profile) {
    const overview = profile.overview;
    const memberByEmployeeId = new Map(
      employeeOptions.map((employee) => [employee.employeeId, employee]),
    );

    const members: CrewMember[] = profile.memberships.current.map((membership) => {
      const option = memberByEmployeeId.get(membership.employeeId);
      return {
        employeeId: membership.employeeId,
        fullName: membership.employeeName,
        role: membership.role,
        position: option?.position || "Crew Member",
        employmentStatus: option?.employmentStatus || "active",
        availabilityStatus: option?.availabilityStatus || "available",
        assignedCrewId: option?.assignedCrewId || membership.crewId,
        primaryCrew: membership.isPrimary,
        joinedOn: membership.startsOn,
      };
    });

    initialValue = {
      id: overview.id,
      crewCode: overview.crewCode,
      name: overview.name,
      status: overview.status,
      leadName: overview.leadName,
      leadProfileId: overview.leadProfileId,
      supervisorName: overview.supervisorName,
      supervisorProfileId: overview.supervisorProfileId,
      homeLocation: overview.homeLocation,
      description: overview.description,
      notes: overview.notes,
      activeMemberCount: overview.activeMemberCount,
      primaryMemberCount: overview.primaryMemberCount,
      currentAssignmentId: overview.currentAssignmentId,
      currentAssignmentTitle: overview.currentAssignmentTitle,
      currentProjectId: overview.currentProjectId,
      currentProjectName: overview.currentProjectName,
      currentPhaseOrTask: overview.currentPhaseOrTask,
      currentAssignmentStatus: overview.currentAssignmentStatus,
      nextAssignmentTitle: overview.nextAssignmentTitle,
      nextProjectName: overview.nextProjectName,
      updatedAt: overview.updatedAt,
      equipmentCount: overview.equipmentCount,
      projectEquipmentCount: overview.projectEquipmentCount,
      hasEquipmentConflict: overview.hasEquipmentConflict,
      availability: overview.availability,
      isActive: overview.isActive,
      code: overview.crewCode,
      lead: overview.leadName || "",
      supervisor: overview.supervisorName || "",
      primarySpecialty: overview.description || specialtyOptions[0] || "General Labor",
      secondarySpecialties: [],
      currentProject: overview.currentProjectName,
      members,
    };
  }

  const handleSubmit = async (value: Parameters<typeof crewService.updateCrew>[1]) => {
    if (!crewId || isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      const updated = await crewService.updateCrew(crewId, value);
      if (!updated) {
        throw new Error("Unable to update crew");
      }

      router.push(`/crews/${crewId}`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Crew records" description="Update operations crew details." />
      </div>
    );
  }

  if (errorMessage) {
    return <ErrorState title={t("crews.errorTitle")} description={t(errorMessage)} />;
  }

  if (!initialValue) {
    return (
      <EmptyState
        title={t("crews.notFound.title")}
        description={t("crews.notFound.description")}
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Crew records" description="Update operations crew details." />
      <CrewForm
        mode="edit"
        initialValue={initialValue}
        employeeOptions={employeeOptions}
        specialtyOptions={specialtyOptions}
        projectOptions={projectOptions}
        isSaving={isSaving}
        onSubmit={handleSubmit}
        onCancel={() => router.push(crewId ? `/crews/${crewId}` : "/crews")}
        t={t}
      />
    </div>
  );
}
