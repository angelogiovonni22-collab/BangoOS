import { TradePartnerInviteClient } from "./trade-partner-invite-client";

export default async function TradePartnerInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return <TradePartnerInviteClient token={params.token?.trim() || ""} />;
}
