"use client";

import { useEffect, useState } from "react";
import { createEmployeeService, type EmployeeService } from "./service";
import type { EmployeeProfile } from "./types";

type UseEmployeeProfileParams = {
  employeeId: string;
  service?: EmployeeService;
};

export function useEmployeeProfile({ employeeId, service = createEmployeeService() }: UseEmployeeProfileParams) {
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(employeeId));
  const [errorMessage, setErrorMessage] = useState<string | null>(employeeId ? null : "employees.errorMissingId");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setNotFound(false);

      try {
        const result = await service.getEmployee(employeeId);

        if (!active) {
          return;
        }

        if (!result) {
          setNotFound(true);
          setEmployee(null);
          return;
        }

        setEmployee(result);
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

    if (!employeeId) {
      return;
    }

    void run();

    return () => {
      active = false;
    };
  }, [employeeId, service]);

  return {
    employee,
    isLoading,
    errorMessage,
    notFound,
  };
}
