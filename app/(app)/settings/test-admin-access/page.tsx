import { TestAdminAccessClient } from "./test-admin-access-client";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default async function TestAdminAccessPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <TestAdminAccessClient
      initialEmail={first(params.email)}
      initialFirstName={first(params.firstName)}
      initialLastName={first(params.lastName)}
    />
  );
}
