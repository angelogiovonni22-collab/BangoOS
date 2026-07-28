"use client";

import { useEffect, useState } from "react";
import { createCrewService, type CrewService } from "./service";
import type { Crew } from "./types";

type UseCrewProfileParams = {
  crewId: string;
  service?: CrewService;
};

export function useCrewProfile({ crewId, service = createCrewService() }: UseCrewProfileParams) {
  const [crew, setCrew] = useState<Crew | null>(null);
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
        const result = await service.getCrew(crewId);

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
  }, [crewId, service]);

  return {
    crew,
    isLoading,
    errorMessage,
    notFound,
  };
}
