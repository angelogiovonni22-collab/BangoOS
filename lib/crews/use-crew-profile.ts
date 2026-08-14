"use client";

import { useEffect, useMemo, useState } from "react";
import { createCrewService, type CrewService } from "./service";
import type { CrewProfile } from "./types";

type UseCrewProfileParams = {
  crewId: string;
  service?: CrewService;
};

export function useCrewProfile({ crewId, service }: UseCrewProfileParams) {
  const crewService = useMemo(() => service ?? createCrewService(), [service]);
  const [crew, setCrew] = useState<CrewProfile | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(crewId));
  const [errorMessage, setErrorMessage] = useState<string | null>(crewId ? null : "crews.errorMissingId");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setNotFound(false);

      try {
        const result = await crewService.getCrew(crewId);

        if (!active) {
          return;
        }

        if (!result) {
          setNotFound(true);
          setCrew(null);
          return;
        }

        setCrew(result);
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

    if (!crewId) {
      return;
    }

    void run();

    return () => {
      active = false;
    };
  }, [crewId, crewService]);

  return {
    crew,
    isLoading,
    errorMessage,
    notFound,
  };
}
