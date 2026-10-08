import { request } from "@/shared/api";

/** Each section stands on its own: read, locked by a permission the CX key lacks, or failed. */
export type Locked = { status: "missing_scope"; scope: string };
export type Failed = { status: "error"; message: string };
export type Section<T> = ({ status: "ok" | "partial" } & T) | Locked | Failed;

export interface Count {
  name: string;
  count: number;
}

export interface Leads {
  total: number;
  previous: number;
  change: number | null;
  perDay: number;
  byDay: { date: string; count: number }[];
  byChannel: Count[];
  byAd: Count[];
  truncated: boolean;
}

export interface Inbox {
  unread: number;
  waiting: number;
  recent: number;
  waitingOver24h: number;
  waitingUnder1h: number;
  medianWaitingHours: number | null;
  buckets: { label: string; count: number }[];
  byChannel: Count[];
  toAnswer: {
    conversationId: string;
    contactId: string;
    name: string;
    channel: string;
    preview: string;
    waitingHours: number;
    assignedTo: string | null;
  }[];
  truncated: boolean;
}

export interface Stage {
  id: string;
  name: string;
  count: number;
  value: number;
}

export interface Pipeline {
  open: number;
  openValue: number;
  pipelines: { id: string; name: string; open: number; openValue: number; stages: Stage[] }[];
  stale: number;
  staleDays: number;
  staleList: { id: string; name: string; pipeline: string | null; stage: string | null; idleDays: number; value: number }[];
  valueWarning: { count: number; value: number; typical: number; examples: { id: string; name: string; value: number }[] } | null;
  truncated: boolean;
}

export interface Sales {
  created: number;
  won: number;
  wonValue: number;
  lost: number;
  abandoned: number;
  winRate: number | null;
  averageWon: number | null;
  bySource: { name: string; count: number; won: number; value: number }[];
}

export interface Appointments {
  calendars: number;
  total: number;
  showed: number;
  noShow: number;
  cancelled: number;
  pending: number;
  showRate: number | null;
  upcoming: number;
  upcomingList: { id: string; title: string; start: string; status: string }[];
}

export interface Team {
  members: { id: string | null; name: string | null; openOpportunities: number; waitingConversations: number }[];
  scope?: string;
}

export interface Payments {
  collected: number;
  count: number;
  average: number | null;
  currency: string | null;
  byDay: { date: string; amount: number }[];
  truncated: boolean;
}

export interface Comparison {
  lastMonth: number | null;
  monthOverMonth: number | null;
  yearOverYear: number | null;
}

export interface Growth {
  months: { month: string; leads: number; opportunities: number; won: number; wonValue: number; revenue: number | null; current: boolean }[];
  leads: Comparison;
  opportunities: Comparison;
  wonValue: Comparison;
  revenue: Comparison | null;
  revenueScope: string | null;
}

export interface Conversion {
  leads: number;
  withOpportunity: number;
  customers: number;
  leadToOpportunity: number | null;
  leadToCustomer: number | null;
  opportunityToCustomer: number | null;
  cycleDays: number | null;
  cycleSample: number;
}

export interface ResponseTimes {
  sampled: number;
  messages: number;
  answered: number;
  unanswered: number;
  medianHours: number | null;
  instantShare: number | null;
  medianHoursWithoutInstant: number | null;
  within1h: number | null;
  within24h: number | null;
  byChannel: { name: string; medianHours: number; count: number }[];
  byPerson: { id: string; medianHours: number; count: number }[];
}

export interface Ads {
  ads: { name: string; leads: number; opportunities: number; won: number; value: number; toOpportunity: number }[];
  attributed: number;
  leads: number;
  attributedShare: number | null;
  best: string | null;
  campaigns?: { name: string; source: string | null; leads: number; opportunities: number; won: number }[];
}

export interface Social {
  accounts: number;
  expired?: string[];
  window?: string;
  impressions?: number;
  impressionsChange?: number | null;
  reach?: number | null;
  reachChange?: number | null;
  interactions?: number;
  engagementRate?: number | null;
  newFollowers?: number | null;
  postsLastWeek?: number | null;
  postsInPeriod?: number;
  postsByPlatform?: Count[];
  platforms?: { name: string; impressions: number; posts: number; engagement: number; change: number | null }[];
  networks?: string[];
  series?: { day: string; impressions: number; likes: number; comments: number }[];
  content?: Content;
}

export interface Interactions {
  posts: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  average: number | null;
}

export interface Post {
  id: string;
  platform: string;
  format: string;
  caption: string;
  thumbnail: string | null;
  link: string | null;
  publishedAt: string;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
}

/** What was published and how people answered it. */
export interface Content extends Interactions {
  published: number;
  unmeasured: string[];
  perWeek: number;
  daysSinceLastPost: number | null;
  byPlatform: ({ name: string } & Interactions)[];
  postsByPlatform: Count[];
  byFormat: ({ name: string } & Interactions)[];
  byWeekday: ({ name: string } & Interactions)[];
  byDaypart: ({ name: string } & Interactions)[];
  bestWeekday: string | null;
  bestDaypart: string | null;
  patternSample: number;
  cadence: { week: string; posts: number }[];
  top: Post[];
}

export interface Handovers {
  leads: number;
  handedOver: number;
  handoverRate: number | null;
  tags: Count[];
}

export interface Tasks {
  open: number;
  overdue: number;
  dueToday: number;
  byPerson: { id: string | null; open: number; overdue: number }[];
  overdueList: { id: string; title: string; contact: string | null; daysLate: number; assignedTo: string | null }[];
}

export interface Retention {
  customers: number;
  repeatCustomers: number;
  repeatRate: number | null;
  valuePerCustomer: number | null;
  returningShare: number | null;
  subscriptions: { active: number; mrr: number; cancelled: number; churnRate: number | null } | null;
  subscriptionsScope: string | null;
}

export interface NpsScore {
  responses: number;
  score: number | null;
  promoters: number;
  passives: number;
  detractors: number;
}

export interface Nps extends NpsScore {
  survey: string | null;
  previousScore: number | null;
  change: number | null;
  byMonth: ({ month: string } & NpsScore)[];
  comments: { score: number; text: string; date: string; name: string | null }[];
}

/** NPS before there is a survey to read. */
export type NoSurvey = { status: "no_survey"; surveys?: number };

export interface Dashboard {
  connected: true;
  invalidToken?: false;
  cached: boolean;
  generatedAt: string;
  period: { days: number; start: string; end: string; timezone: string };
  leads: Section<Leads>;
  inbox: Section<Inbox>;
  pipeline: Section<Pipeline>;
  sales: Section<Sales>;
  appointments: Section<Appointments>;
  team: Section<Team>;
  payments: Section<Payments>;
  growth: Section<Growth>;
  conversion: Section<Conversion>;
  response: Section<ResponseTimes>;
  ads: Section<Ads>;
  social: Section<Social>;
  retention: Section<Retention>;
  nps: Section<Nps> | NoSurvey;
  handovers: Section<Handovers>;
  tasks: Section<Tasks>;
  account: { name: string | null; timezone: string | null; currency: string | null } | null;
  /** Every person the sections name by id. */
  users: Record<string, string>;
}

export type DashboardResponse = Dashboard | { connected: false } | { connected: true; invalidToken: true; generatedAt: string };

export const PERIODS = ["7", "30", "90"] as const;
export type PeriodDays = (typeof PERIODS)[number];

export function timezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "America/Mexico_City";
  }
}

export function getDashboard(days: PeriodDays, refresh = false) {
  const query = new URLSearchParams({ days, tz: timezone(), ...(refresh ? { refresh: "true" } : {}) });
  return request<DashboardResponse>(`cx/dashboard?${query}`);
}

/** Read and usable. A section missing altogether -- a copy cached before it existed --
 *  is simply not ready. */
export function isReady<T>(section: Section<T> | undefined): section is { status: "ok" | "partial" } & T {
  return section?.status === "ok" || section?.status === "partial";
}

// --- the detail behind the lists -------------------------------------------------------

const DETAIL_ERRORS = {
  cx_not_connected: "Conecta tu llave del CX en llaves api.",
  cx_missing_scope: "Tu llave del CX no tiene permiso para esto. Actívalo en la integración privada del CX.",
  cx_invalid_token: "El CX rechazó tu llave. Reemplázala en llaves api.",
  cx_rate_limited: "El CX pidió esperar un momento. Intenta en un minuto.",
  cx_error: "El CX no pudo responder. Intenta de nuevo.",
  cx_conversation_not_found: "Esa conversación ya no existe en el CX.",
  cx_reply_empty: "Escribe un mensaje.",
};

export interface ConversationMessage {
  id: string;
  direction: "inbound" | "outbound";
  kind: "message" | "activity";
  channel: string;
  body: string;
  attachments: string[];
  date: string | null;
  status: string | null;
  sender: string | null;
  automated: boolean;
}

export interface ConversationDetail {
  id: string;
  contactId: string;
  name: string;
  phone: string | null;
  email: string | null;
  tags: string[];
  assignedTo: string | null;
  unread: number;
  messages: ConversationMessage[];
  before: string | null;
  replyType: string | null;
  replyChannel: string | null;
  /** WhatsApp, Instagram and Messenger take replies only within 24 h of the client's last message. */
  replyWindow: { open: boolean; closesAt: string | null; lastInbound: string | null; reason: "window_closed" | "unsupported_channel" | null };
}

export type ReplyResult =
  | { sent: true; messageId: string | null; channel: string }
  | { sent: false; reason: "unsupported_channel" | "rejected" | "window_closed"; detail?: string | null; lastInbound?: string | null };

export interface PostDetail {
  id: string;
  title: string;
  caption: string;
  platform: string;
  profiles: string[];
  format: string;
  status: string | null;
  publishedAt: string | null;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  media: { url: string; thumbnail: string | null; type: string | null }[];
  thumbnail: string | null;
  video: string | null;
  link: string | null;
  tags: string[];
  createdBy: string | null;
  error: unknown;
}

export interface AdDetail {
  name: string;
  adId: string | null;
  landing: string | null;
  leads: number;
  opportunities: number;
  won: number;
  toOpportunity: number | null;
  first: string | null;
  last: string | null;
  byStage: Count[];
  people: { contactId: string; name: string; date: string; channel: string; status: string | null; pipeline: string | null; stage: string | null; value: number }[];
}

export function getConversation(id: string, before?: string | null) {
  const query = before ? `?${new URLSearchParams({ before })}` : "";
  return request<ConversationDetail>(`cx/conversations/${encodeURIComponent(id)}${query}`, { errors: DETAIL_ERRORS });
}

export function replyConversation(id: string, message: string) {
  return request<ReplyResult>(`cx/conversations/${encodeURIComponent(id)}/reply`, { method: "POST", body: { message }, errors: DETAIL_ERRORS });
}

export function getPosts(days: PeriodDays) {
  return request<{ posts: PostDetail[]; networks: { name: string; count: number; measured: boolean }[] }>(
    `cx/posts?${new URLSearchParams({ days, tz: timezone() })}`,
    { errors: DETAIL_ERRORS },
  );
}

export function getAds(days: PeriodDays) {
  return request<{ ads: AdDetail[] }>(`cx/ads?${new URLSearchParams({ days, tz: timezone() })}`, { errors: DETAIL_ERRORS });
}
