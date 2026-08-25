"use client";

type DepartmentNavigatorProps = {
  t: (key: string, params?: Record<string, string | number>) => string;
};

/**
 * Department/module pills are intentionally omitted from the global top bar.
 * The sidebar supplies department navigation while the workspace supplies the
 * single visible page title.
 */
export function DepartmentNavigator(_props: DepartmentNavigatorProps) {
  return null;
}
