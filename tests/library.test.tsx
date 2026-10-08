import { render as renderUI, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentsTable } from "@/features/knowledge";
import { LibraryWorkspace } from "@/features/library";
import { agentPath, brandsOf, type LibraryTree } from "@/features/library/api";
import { SessionProvider, type User } from "@/shared/session";

const owner: User = { id: "owner-1", organizationId: "org-1", email: "owner@example.com", role: "owner", setupComplete: true, createdAt: "2026-01-01" };
const LIBRARY = { id: "lib-1", name: "Biblioteca", shared: true, ownerId: null, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
const at = { createdAt: "2026-01-01", updatedAt: "2026-01-01" };

function folder(id: string, name: string, parentId: string | null = null) {
  return { id, projectId: LIBRARY.id, parentId, name, ...at };
}

function file(id: string, name: string, folderId: string | null, contentType = "image/png") {
  return { id, projectId: LIBRARY.id, folderId, name, contentType, sizeBytes: 2048, status: "ready", uploadedBy: owner.id, ...at };
}

let tree: LibraryTree;
let documents: object[];
let fetchMock: ReturnType<typeof vi.fn>;

function render(ui: ReactElement) {
  return renderUI(<SessionProvider user={owner}>{ui}</SessionProvider>);
}

function bodies(path: string, method: string) {
  return fetchMock.mock.calls.filter(([url, init]) => url === `/api/backend/${path}` && init?.method === method).map(([, init]) => JSON.parse(init.body));
}

beforeEach(() => {
  tree = {
    folders: [folder("f-soul", "Soullens"), folder("f-x", "ClienteX"), folder("f-sub", "logos", "f-soul")],
    files: [file("1", "logo.png", "f-soul"), file("2", "blanco.svg", "f-sub", "image/svg+xml"), file("3", "manual.pdf", "f-x", "application/pdf")],
  } as LibraryTree;
  documents = [
    { id: "d1", title: "Manual Soullens", description: "", filename: "manual.pdf", contentType: "application/pdf", sizeBytes: 10, status: "extracted", extractedChars: 900, uploadedBy: owner.id, brand: null, ...at },
  ];
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (url === "/api/backend/projects/library") return Response.json(LIBRARY);
    if (url === `/api/backend/projects/${LIBRARY.id}/tree`) return Response.json(tree);
    if (url === `/api/backend/projects/${LIBRARY.id}/folders` && method === "POST") {
      const { name } = JSON.parse(init!.body as string);
      const created = folder("f-new", name);
      tree = { ...tree, folders: [...tree.folders, created] };
      return Response.json(created, { status: 201 });
    }
    if (url === "/api/backend/documents") return Response.json(documents);
    if (url === "/api/backend/documents/d1" && method === "PATCH") {
      const changes = JSON.parse(init!.body as string);
      documents = [{ ...documents[0], ...changes, brand: changes.brand || null }];
      return Response.json(documents[0]);
    }
    return Response.json([]);
  });
  vi.stubGlobal("fetch", fetchMock);
});

describe("library", () => {
  it("groups files under the top-level brand folder they are in, however deep", () => {
    const { brands } = brandsOf(tree);
    expect(brands.map((brand) => brand.folder.name)).toEqual(["ClienteX", "Soullens"]);
    expect(brands[1].files.map((f) => f.name)).toEqual(["logo.png", "blanco.svg"]);
  });

  it("names a file the way the agent reads it", () => {
    const { brands } = brandsOf(tree);
    expect(agentPath(LIBRARY, brands[1].folder, brands[1].files[0])).toBe("project:Biblioteca/Soullens/logo.png");
  });

  it("lists brands and shows the chosen brand's images", async () => {
    render(<LibraryWorkspace />);

    const list = await screen.findByRole("list", { name: "Marcas" });
    expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual(["ClienteX1", "Soullens2"]);

    await userEvent.click(within(list).getByRole("button", { name: /Soullens/ }));
    const files = await screen.findByRole("list", { name: "Archivos de Soullens" });
    expect(within(files).getByAltText("logo.png")).toHaveAttribute("src", `/api/backend/projects/${LIBRARY.id}/files/1/content`);
  });

  it("creates a brand and opens it", async () => {
    render(<LibraryWorkspace />);
    await screen.findByRole("list", { name: "Marcas" });

    await userEvent.type(screen.getByLabelText("Nueva marca"), "Café Luna");
    await userEvent.click(screen.getByRole("button", { name: "crear" }));

    expect(bodies(`projects/${LIBRARY.id}/folders`, "POST")).toEqual([{ name: "Café Luna", parentId: null }]);
    expect(await screen.findByText("esta marca todavía no tiene archivos.")).toBeInTheDocument();
  });
});

describe("knowledge documents", () => {
  it("are available without training and can be given a brand from the library", async () => {
    render(<DocumentsTable />);

    expect(await screen.findByText("disponible")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "editar" }));
    const brand = await screen.findByRole("combobox");
    await waitFor(() => expect(within(brand).getAllByRole("option").map((o) => o.textContent)).toContain("Soullens"));
    await userEvent.selectOptions(brand, "Soullens");
    await userEvent.click(screen.getByRole("button", { name: "guardar" }));

    expect(bodies("documents/d1", "PATCH")).toEqual([{ title: "Manual Soullens", description: "", brand: "Soullens" }]);
    expect(await screen.findByText("Soullens", { selector: ".doclist__brand" })).toBeInTheDocument();
  });
});
