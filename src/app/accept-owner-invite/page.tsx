import { AcceptInviteScreen } from "@/features/auth";

export default async function AcceptOwnerInvitePage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  return <AcceptInviteScreen kind="owner" token={typeof token === "string" && token.length > 0 ? token : null} />;
}
