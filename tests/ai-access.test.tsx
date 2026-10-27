import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionProvider, type User } from "@/shared/session";
import { AiAccessNotice } from "@/shell";

const user = (setupComplete: boolean, role: User["role"] = "owner"): User => ({
  id: "u-1",
  organizationId: "org-1",
  email: "dueno@acme.mx",
  role,
  setupComplete,
  createdAt: "2026-01-01",
});

function show(person: User) {
  return render(
    <SessionProvider user={person}>
      <AiAccessNotice />
    </SessionProvider>,
  );
}

describe("AI access of the organization", () => {
  it("says nothing when the organization has been set up", () => {
    show(user(true));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("tells the owner the organization is not enabled yet, and that Xplorers enables it", () => {
    show(user(false));

    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("todavía no está habilitado");
    expect(notice).toHaveTextContent("Xplorers");
  });

  it("does not offer to issue a key: nobody in the organization can", () => {
    show(user(false));

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/asign|emit|Llaves API/i);
  });
});
