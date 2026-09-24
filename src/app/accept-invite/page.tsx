import { AcceptInviteScreen } from "@/features/auth";

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <AcceptInviteScreen token={typeof token === "string" && token.length > 0 ? token : null} />;
}
