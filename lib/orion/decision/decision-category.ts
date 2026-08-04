import type { OrionDecisionCategory } from "./decision-types";

export function decisionCategoryLabel(category: OrionDecisionCategory) {
  if (category === "estimates") {
    return "Estimates";
  }

  if (category === "customers") {
    return "Customers";
  }

  if (category === "projects") {
    return "Projects";
  }

  if (category === "finance") {
    return "Finance";
  }

  if (category === "workforce") {
    return "Workforce";
  }

  return "Operations";
}
