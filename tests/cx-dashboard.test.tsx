import { render as renderUI, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CxDashboard } from "@/features/cx-dashboard";
import { money, waited } from "@/features/cx-dashboard/format";
import { SessionProvider, type User } from "@/shared/session";

const owner: User = { id: "owner-1", organizationId: "org-1", email: "owner@example.com", role: "owner", setupComplete: true, createdAt: "2026-01-01" };

const content = {
  posts: 2, likes: 5, comments: 1, shares: 0, engagement: 6, average: 3, published: 26, unmeasured: ["tiktok", "youtube"], perWeek: 2, daysSinceLastPost: 7,
  byPlatform: [{ name: "instagram", posts: 2, likes: 5, comments: 1, shares: 0, engagement: 6, average: 3 }],
  postsByPlatform: [{ name: "tiktok", count: 11 }, { name: "youtube", count: 10 }],
  byFormat: [{ name: "reel", posts: 2, likes: 5, comments: 1, shares: 0, engagement: 6, average: 3 }],
  byWeekday: ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"].map((name) => ({ name, posts: 0, likes: 0, comments: 0, shares: 0, engagement: 0, average: null })),
  byDaypart: ["madrugada", "mañana", "tarde", "noche"].map((name) => ({ name, posts: 0, likes: 0, comments: 0, shares: 0, engagement: 0, average: null })),
  bestWeekday: "lunes", bestDaypart: "tarde", patternSample: 26,
  cadence: [{ week: "2026-09-28", posts: 3 }, { week: "2026-10-05", posts: 1 }],
  top: [{ id: "p1", platform: "instagram", format: "reel", caption: "Soul Story Kids en acción", thumbnail: null, link: "https://example.com/p1", publishedAt: "2026-10-01T18:00:00Z", likes: 3, comments: 1, shares: 0, engagement: 4 }],
};

const DASHBOARD = {
  connected: true,
  cached: false,
  generatedAt: new Date().toISOString(),
  period: { days: 30, start: "2026-09-09T00:00:00-06:00", end: "2026-10-08T12:00:00-06:00", timezone: "America/Mexico_City" },
  account: { name: "Soul Lens Studios", timezone: "America/Mexico_City", currency: "MXN" },
  users: { abcd1234: "Brenda Ruiz", user9876: "Carlos Pérez" },
  leads: {
    status: "ok", total: 9, previous: 7, change: 0.2857, perDay: 0.3,
    byDay: [{ date: "2026-10-07", count: 2 }, { date: "2026-10-08", count: 5 }],
    byChannel: [{ name: "whatsapp", count: 6 }], byAd: [{ name: "Promo Kids", count: 4 }], truncated: false,
  },
  inbox: {
    status: "ok", unread: 984, waiting: 197, recent: 3, waitingOver24h: 195, waitingUnder1h: 1, medianWaitingHours: 4000,
    buckets: [{ label: "menos de 1 h", count: 1 }, { label: "más de 1 mes", count: 190 }],
    byChannel: [{ name: "whatsapp", count: 162 }],
    toAnswer: [
      { conversationId: "c1", contactId: "k1", name: "Ana López", channel: "whatsapp", preview: "¿Tienen precio?", waitingHours: 0.3, assignedTo: null },
      { conversationId: "c2", contactId: "k2", name: "Luis", channel: "instagram", preview: "Hola", waitingHours: 50, assignedTo: null },
    ],
    truncated: false,
  },
  pipeline: {
    status: "ok", open: 647, openValue: 25554, stale: 645, staleDays: 14, truncated: false,
    pipelines: [{ id: "p1", name: "Comercial", open: 575, openValue: 20000, stages: [{ id: "s1", name: "Nuevo", count: 56, value: 0 }, { id: "s2", name: "Propuesta", count: 427, value: 20000 }] }],
    staleList: [{ id: "o1", name: "Hotel Mérida", pipeline: "Comercial", stage: "Propuesta", idleDays: 120, value: 999 }],
    valueWarning: { count: 3, value: 689250000000, typical: 749, examples: [{ id: "x", name: "15617093805", value: 229749899999 }] },
  },
  sales: { status: "ok", created: 3, won: 0, wonValue: 0, lost: 0, abandoned: 0, winRate: null, averageWon: null, bySource: [{ name: "sin dato", count: 3, won: 0, value: 0 }] },
  appointments: { status: "ok", calendars: 2, total: 1, showed: 0, noShow: 0, cancelled: 0, pending: 1, showRate: null, upcoming: 0, upcomingList: [] },
  team: { status: "ok", members: [{ id: "abcd1234", name: "Brenda Ruiz", openOpportunities: 600, waitingConversations: 150 }] },
  payments: { status: "missing_scope", scope: "payments/transactions.readonly" },
  growth: {
    status: "ok",
    months: [
      { month: "2026-08-01", leads: 158, opportunities: 154, won: 0, wonValue: 0, revenue: null, current: false },
      { month: "2026-09-01", leads: 9, opportunities: 2, won: 0, wonValue: 0, revenue: null, current: false },
      { month: "2026-10-01", leads: 3, opportunities: 2, won: 0, wonValue: 0, revenue: null, current: true },
    ],
    leads: { lastMonth: 9, monthOverMonth: -0.943, yearOverYear: null },
    opportunities: { lastMonth: 2, monthOverMonth: -0.987, yearOverYear: null },
    wonValue: { lastMonth: 0, monthOverMonth: null, yearOverYear: null },
    revenue: null,
    revenueScope: "payments/transactions.readonly",
  },
  conversion: { status: "ok", leads: 9, withOpportunity: 3, customers: 0, leadToOpportunity: 0.3333, leadToCustomer: 0, opportunityToCustomer: 0, cycleDays: 1.2, cycleSample: 1 },
  response: {
    status: "ok", sampled: 11, messages: 28, answered: 26, unanswered: 2, medianHours: 0.01, instantShare: 0.9, medianHoursWithoutInstant: 2,
    within1h: 0.93, within24h: 0.93, byChannel: [{ name: "whatsapp", medianHours: 0.01, count: 22 }], byPerson: [{ id: "user9876", medianHours: 0.01, count: 20 }],
  },
  ads: { status: "ok", ads: [], attributed: 0, leads: 9, attributedShare: 0, best: null, campaigns: [] },
  social: {
    status: "ok", accounts: 7, expired: [], window: "7d", impressions: 541, impressionsChange: 3.4711, reach: 63, reachChange: 0.05, interactions: 16,
    engagementRate: 0.0296, newFollowers: 1, postsLastWeek: 2, postsInPeriod: 4, postsByPlatform: [],
    platforms: [{ name: "tiktok", impressions: 442, posts: 1, engagement: 14, change: 26.6 }], networks: ["instagram", "tiktok"],
    series: [{ day: "Thu", impressions: 112, likes: 7, comments: 0 }, { day: "Fri", impressions: 245, likes: 5, comments: 0 }],
    content,
  },
  retention: { status: "missing_scope", scope: "payments/transactions.readonly" },
  nps: { status: "no_survey" },
  handovers: { status: "ok", leads: 599, handedOver: 39, handoverRate: 0.0651, tags: [{ name: "stop bot", count: 30 }] },
  tasks: {
    status: "ok", open: 46, overdue: 46, dueToday: 0,
    byPerson: [{ id: "abcd1234", open: 40, overdue: 40 }, { id: null, open: 6, overdue: 6 }],
    overdueList: [{ id: "t1", title: "Llamar a Ana", contact: "Ana López", daysLate: 12, assignedTo: "abcd1234" }],
  },
};

const CONVERSATION = {
  id: "c1", contactId: "k1", name: "Ana López", phone: "+52 999 111", email: null, tags: ["kids"], assignedTo: "Brenda Ruiz", unread: 1,
  before: "cursor-older",
  replyType: "WhatsApp", replyChannel: "whatsapp",
  replyWindow: { open: true, closesAt: new Date(Date.now() + 5 * 3_600_000).toISOString(), lastInbound: new Date(Date.now() - 19 * 3_600_000).toISOString(), reason: null },
  messages: [
    { id: "m1", direction: "inbound", kind: "message", channel: "whatsapp", body: "¿Tienen precio?", attachments: [], date: "2026-10-08T17:00:00Z", status: null, sender: null, automated: false },
    { id: "m2", direction: "outbound", kind: "activity", channel: "", body: "Employee action log created", attachments: [], date: "2026-10-08T17:01:00Z", status: null, sender: null, automated: true },
  ],
};
const OLDER = { ...CONVERSATION, before: null, messages: [{ id: "m0", direction: "outbound", kind: "message", channel: "whatsapp", body: "Hola Ana, bienvenida", attachments: [], date: "2026-10-01T10:00:00Z", status: "read", sender: "Brenda Ruiz", automated: false }] };
const POSTS = {
  networks: [{ name: "instagram", count: 1, measured: true }, { name: "tiktok", count: 1, measured: false }],
  posts: [
    { id: "p1", title: "México se siente — Soul Lens Studios", caption: "México se siente, texto completo del post", platform: "tiktok", profiles: ["Soul Lens Studios"], format: "post", status: "published",
      publishedAt: "2026-10-05T18:00:00Z", likes: 0, comments: 0, shares: 0, engagement: 0, media: [], thumbnail: null, video: "https://cdn/v.mp4", link: "https://tiktok/p1", tags: [], createdBy: "Eleazar Aguilar", error: null },
    { id: "p2", title: "Soul Story Kids en acción", caption: "Kids", platform: "instagram", profiles: ["soullens"], format: "reel", status: "published",
      publishedAt: "2026-10-01T18:00:00Z", likes: 3, comments: 1, shares: 0, engagement: 4, media: [], thumbnail: "https://cdn/t.jpg", video: null, link: null, tags: [], createdBy: null, error: null },
  ],
};
const ADS = {
  ads: [{ name: "Videos donde tu hij@ es el protagonista", adId: "123", landing: "https://soullens.mx/kids", leads: 268, opportunities: 265, won: 0, toOpportunity: 0.989, first: null, last: null,
    byStage: [{ name: "Sin Respuesta", count: 202 }, { name: "Perdido", count: 22 }],
    people: [{ contactId: "k1", name: "Ana López", date: "2026-10-05T18:00:00Z", channel: "whatsapp", status: "open", pipeline: "Comercial", stage: "Sin Respuesta", value: 0 }] }],
};

let response: object;
let reply: object;
let conversation: object;
let fetchMock: ReturnType<typeof vi.fn>;

function render(ui: ReactElement) {
  return renderUI(<SessionProvider user={owner}>{ui}</SessionProvider>);
}

async function openTab(name: RegExp | string) {
  await userEvent.click(await screen.findByRole("tab", { name }));
}

function card(title: string) {
  return screen.getByRole("heading", { name: title }).closest("section")!;
}

beforeEach(() => {
  response = DASHBOARD;
  reply = { sent: true, messageId: "new-1", channel: "WhatsApp" };
  conversation = CONVERSATION;
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url);
    if (path.startsWith("/api/backend/cx/conversations/c1/reply")) return Response.json(reply);
    if (path === "/api/backend/cx/conversations/c1?before=cursor-older") return Response.json(OLDER);
    if (path.startsWith("/api/backend/cx/conversations/c1")) return Response.json(conversation);
    if (path.startsWith("/api/backend/cx/posts")) return Response.json(POSTS);
    if (path.startsWith("/api/backend/cx/ads")) return Response.json(ADS);
    void init;
    return Response.json(response);
  });
  vi.stubGlobal("fetch", fetchMock);
  window.history.replaceState(null, "", "/cx");
});

describe("mi cx tabs", () => {
  it("opens on the summary, with what needs attention and badges on the tabs that need someone", async () => {
    render(<CxDashboard />);

    expect(await screen.findByText("esperando respuesta")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "resumen" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /conversaciones/ })).toHaveTextContent("3");
    expect(screen.getByRole("tab", { name: /equipo/ })).toHaveTextContent("46");
    expect(card("QUÉ ATENDER")).toHaveTextContent("46 tareas vencidas del equipo");
  });

  it("jumps from an alert to its tab and keeps the tab in the address", async () => {
    render(<CxDashboard />);
    await screen.findByText("esperando respuesta");

    await userEvent.click(within(card("QUÉ ATENDER")).getAllByRole("button", { name: "ver equipo" })[0]);

    expect(screen.getByRole("tab", { name: /equipo/ })).toHaveAttribute("aria-selected", "true");
    expect(window.location.hash).toBe("#equipo");
    expect(card("TAREAS")).toHaveTextContent("Llamar a Ana");
    expect(card("TAREAS")).toHaveTextContent("Brenda Ruiz");
  });

  it("moves between tabs with the arrow keys", async () => {
    render(<CxDashboard />);
    const summary = await screen.findByRole("tab", { name: "resumen" });

    summary.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "ventas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "ventas" })).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "clientes" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("mi cx sections", () => {
  it("puts the freshest unanswered first in conversations", async () => {
    render(<CxDashboard />);
    await openTab(/conversaciones/);

    const names = within(card("POR CONTESTAR")).getAllByRole("listitem").map((li) => li.textContent);
    expect(names.find((t) => t?.includes("Ana López"))).toContain("18 min");
    expect(card("PRIMERA RESPUESTA")).toHaveTextContent("90% de las respuestas llegaron en menos de un minuto");
    expect(card("DEL AGENTE DE IA A UNA PERSONA")).toHaveTextContent("39 de 599 leads");
  });

  it("calls out mistyped amounts and shows growth in sales", async () => {
    render(<CxDashboard />);
    await openTab("ventas");

    expect(screen.getByText(/Revisa 3 montos/).closest("p")).toHaveTextContent("No se cuentan en el valor del pipeline");
    const growth = card("CRECIMIENTO · 12 MESES");
    expect(within(growth).getByRole("figure", { name: "leads por mes" })).toBeInTheDocument();
    expect(within(growth).getByText(/-94/)).toBeInTheDocument();
    await userEvent.click(within(growth).getByRole("radio", { name: /cobrado/ }));
    expect(within(growth).getByText("payments/transactions.readonly")).toBeInTheDocument();
    expect(within(card("PAGOS COBRADOS")).getByText("payments/transactions.readonly")).toBeInTheDocument();
  });

  it("shows reach, what content works, the best time and the top posts in social", async () => {
    render(<CxDashboard />);
    await openTab("redes sociales");

    expect(card("ALCANCE · ÚLTIMOS 7 DÍAS")).toHaveTextContent("+347% vs semana anterior");
    expect(within(card("ALCANCE · ÚLTIMOS 7 DÍAS")).getByRole("figure", { name: "Impresiones por día, últimos 7 días" })).toBeInTheDocument();
    expect(card("CONTENIDO DEL PERIODO")).toHaveTextContent("TikTok, YouTube no reportan likes");
    expect(card("MEJOR MOMENTO PARA PUBLICAR")).toHaveTextContent("lunes por la tarde");
    const top = within(card("LO QUE MÁS FUNCIONÓ")).getByRole("list", { name: "Publicaciones con más interacciones" });
    expect(top).toHaveTextContent("Soul Story Kids en acción");
    expect(within(top).getByRole("link", { name: /ver publicación/ })).toHaveAttribute("href", "https://example.com/p1");
  });

  it("names the team and explains how to start NPS", async () => {
    render(<CxDashboard />);
    await openTab(/equipo/);
    expect(card("QUIÉN RESPONDE Y QUÉ TAN RÁPIDO")).toHaveTextContent("Carlos Pérez");

    await openTab("clientes");
    const nps = card("NPS");
    expect(nps).toHaveTextContent("necesitas una encuesta en el CX");
    expect(within(nps).getAllByRole("listitem")).toHaveLength(3);
  });

  it("asks for a key when there is none, and for a new one when it is refused", async () => {
    response = { connected: false };
    const { unmount } = render(<CxDashboard />);
    expect(await screen.findByText("EL CX NO ESTÁ CONECTADO")).toBeInTheDocument();
    unmount();

    response = { connected: true, invalidToken: true, generatedAt: new Date().toISOString() };
    render(<CxDashboard key="again" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("rechazó tu llave");
  });

  it("re-reads CX on demand and with the chosen period", async () => {
    render(<CxDashboard />);
    await screen.findByText("esperando respuesta");

    await userEvent.click(screen.getByRole("button", { name: "actualizar" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("refresh=true"))).toBe(true));

    await userEvent.click(screen.getByRole("radio", { name: /90 días/ }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).includes("days=90"))).toBe(true));
  });

  it("survives a copy cached before a section existed", async () => {
    const { tasks: _tasks, handovers: _handovers, ...older } = DASHBOARD;
    response = older;
    render(<CxDashboard />);
    await screen.findByText("esperando respuesta");

    await openTab(/equipo/);
    expect(card("TAREAS")).toHaveTextContent("pulsa actualizar para ver esta sección");
  });
});

describe("dashboard formats", () => {
  it("says waits the way people do and keeps big money short", () => {
    expect([waited(0.3), waited(5), waited(50), waited(24 * 200)]).toEqual(["18 min", "5 h", "2 días", "7 meses"]);
    expect(money(25554)).toBe("$25,554");
    expect(money(1_250_000)).toMatch(/^\$1\.3\sM$/);
  });
});

describe("mi cx details", () => {
  it("opens a conversation, loads older messages and replies on the client's channel", async () => {
    render(<CxDashboard />);
    await openTab(/conversaciones/);

    await userEvent.click(within(card("POR CONTESTAR")).getByRole("button", { name: "Abrir la conversación con Ana López" }));
    const panel = await screen.findByRole("dialog", { name: "Ana López" });
    const messages = await within(panel).findByRole("list", { name: "Mensajes con Ana López" });
    expect(messages).toHaveTextContent("¿Tienen precio?");
    expect(panel).toHaveTextContent("asignado a Brenda Ruiz");

    await userEvent.click(within(panel).getByRole("button", { name: "ver mensajes anteriores" }));
    expect(await within(messages).findByText("Hola Ana, bienvenida")).toBeInTheDocument();

    await userEvent.type(within(panel).getByLabelText("responder por whatsapp"), "Sí, te mando la lista");
    await userEvent.click(within(panel).getByRole("button", { name: "enviar" }));

    const posted = fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith("/reply") && init?.method === "POST");
    expect(posted.map(([, init]) => JSON.parse(init.body))).toEqual([{ message: "Sí, te mando la lista" }]);
    expect(await within(messages).findByText("Sí, te mando la lista")).toBeInTheDocument();
    expect(within(panel).getByLabelText("responder por whatsapp")).toHaveValue("");

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows how long is left to answer inside WhatsApp's 24-hour window", async () => {
    render(<CxDashboard />);
    await openTab(/conversaciones/);
    await userEvent.click(within(card("POR CONTESTAR")).getByRole("button", { name: "Abrir la conversación con Ana López" }));
    const panel = await screen.findByRole("dialog", { name: "Ana López" });

    expect(await within(panel).findByText(/quedan 5 h de la ventana de 24 h/)).toBeInTheDocument();
  });

  it("does not offer to reply once WhatsApp's 24-hour window has closed", async () => {
    conversation = {
      ...CONVERSATION,
      replyWindow: { open: false, closesAt: new Date(Date.now() - 26 * 3_600_000).toISOString(), lastInbound: new Date(Date.now() - 50 * 3_600_000).toISOString(), reason: "window_closed" },
    };
    render(<CxDashboard />);
    await openTab(/conversaciones/);
    expect(within(card("POR CONTESTAR")).getByRole("button", { name: "Abrir la conversación con Luis" })).toHaveTextContent("ventana cerrada");

    await userEvent.click(within(card("POR CONTESTAR")).getByRole("button", { name: "Abrir la conversación con Ana López" }));
    const panel = await screen.findByRole("dialog", { name: "Ana López" });

    expect(await within(panel).findByText("La ventana de 24 h de WhatsApp está cerrada.")).toBeInTheDocument();
    expect(panel).toHaveTextContent("escribió por última vez hace 2 días");
    expect(within(panel).queryByRole("button", { name: "enviar" })).not.toBeInTheDocument();
    expect(within(panel).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("says why CX refused a reply and keeps the draft", async () => {
    reply = { sent: false, reason: "rejected", detail: "Outside the 24 hour window" };
    render(<CxDashboard />);
    await openTab(/conversaciones/);
    await userEvent.click(within(card("POR CONTESTAR")).getByRole("button", { name: "Abrir la conversación con Ana López" }));
    const panel = await screen.findByRole("dialog", { name: "Ana López" });
    await within(panel).findByRole("list", { name: "Mensajes con Ana López" });

    await userEvent.type(within(panel).getByLabelText("responder por whatsapp"), "Hola");
    await userEvent.click(within(panel).getByRole("button", { name: "enviar" }));

    expect(await within(panel).findByRole("alert")).toHaveTextContent("Outside the 24 hour window");
    expect(within(panel).getByLabelText("responder por whatsapp")).toHaveValue("Hola");
  });

  it("lists every post by name, filters by network and opens one", async () => {
    render(<CxDashboard />);
    await openTab("redes sociales");

    const list = await within(card("TODAS LAS PUBLICACIONES")).findByRole("list", { name: "Todas las publicaciones" });
    expect(within(list).getAllByRole("button").map((b) => b.textContent)).toEqual([
      expect.stringContaining("México se siente"),
      expect.stringContaining("Soul Story Kids en acción"),
    ]);
    expect(within(list).getAllByRole("button")[0]).toHaveTextContent("sin métricas");

    await userEvent.selectOptions(within(card("TODAS LAS PUBLICACIONES")).getByLabelText("red"), "instagram");
    expect(within(list).getAllByRole("button")).toHaveLength(1);

    await userEvent.click(within(list).getByRole("button", { name: /Soul Story Kids/ }));
    const panel = await screen.findByRole("dialog", { name: "Soul Story Kids en acción" });
    expect(panel).toHaveTextContent("soullens");
    expect(within(panel).getByText("4")).toBeInTheDocument();
  });

  it("opens an ad to see its leads and where they stand", async () => {
    response = { ...DASHBOARD, ads: { status: "ok", ads: [{ name: "Videos donde tu hij@ es el protagonista", leads: 268, opportunities: 265, won: 0, value: 0, toOpportunity: 0.989 }], attributed: 268, leads: 300, attributedShare: 0.89, best: null, campaigns: [] } };
    render(<CxDashboard />);
    await openTab("marketing");

    await userEvent.click(within(card("ANUNCIOS")).getByRole("button", { name: "Videos donde tu hij@ es el protagonista" }));
    const panel = await screen.findByRole("dialog", { name: "Videos donde tu hij@ es el protagonista" });
    expect(await within(panel).findByRole("list", { name: "Leads del anuncio por etapa" })).toHaveTextContent("Sin Respuesta");
    expect(panel).toHaveTextContent("Ana López");
    expect(within(panel).getByRole("link", { name: /soullens.mx\/kids/ })).toHaveAttribute("href", "https://soullens.mx/kids");
  });
});
