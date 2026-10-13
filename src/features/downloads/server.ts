import { backendGet } from "@/shared/server/backend";

export type Platform = "windows" | "mac";

export interface Installer {
  platform: Platform;
  label: string;
  filename: string;
  available: boolean;
  sizeBytes: number | null;
  updatedAt: string | null;
}

/** The published installers, or null when the API cannot be reached. */
export async function listInstallers(): Promise<Installer[] | null> {
  try {
    const response = await backendGet("/downloads/desktop");
    if (!response.ok) return null;
    return (await response.json()) as Installer[];
  } catch {
    return null;
  }
}

/** A short-lived link to one installer in the bucket; "missing" when it is not published. */
export async function installerLink(platform: string): Promise<string | "missing" | null> {
  try {
    const response = await backendGet(`/downloads/desktop/${encodeURIComponent(platform)}`);
    if (response.status === 404) return "missing";
    if (!response.ok) return null;
    return ((await response.json()) as { url: string }).url;
  } catch {
    return null;
  }
}

/** Which installer suits the browser asking, from its user agent. */
export function platformOf(userAgent: string): Platform | null {
  if (/Windows/i.test(userAgent)) return "windows";
  if (/Macintosh|Mac OS X/i.test(userAgent) && !/iPhone|iPad/i.test(userAgent)) return "mac";
  return null;
}
