export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

export type ErrorMessages = Record<string, string>;

const COMMON_ERRORS: ErrorMessages = {
  not_authenticated: "Necesitas iniciar sesión.",
  invalid_session: "Tu sesión expiró. Inicia sesión de nuevo.",
  insufficient_role: "No tienes permisos para esta acción.",
  service_unavailable: "El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.",
  validation_error: "Algún dato no es válido. Revisa el formulario.",
};

const FALLBACK_ERROR = "Algo salió mal. Intenta de nuevo.";

interface RequestOptions {
  method?: string;
  body?: unknown;
  errors?: ErrorMessages;
}

export async function request<T>(path: string, { method = "GET", body, errors }: RequestOptions = {}): Promise<T> {
  const res = await fetch(`/api/backend/${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });

  const data = await res.json().catch((error) => console.log(error));

  if (!res.ok) {
    const code: string = data?.code ?? (res.status === 422 ? "validation_error" : "unknown_error");
    const message = errors?.[code] ?? COMMON_ERRORS[code] ?? FALLBACK_ERROR;
    throw new ApiError(message, res.status, code);
  }

  return data as T;
}

export function errorMessage(err: unknown) {
  return err instanceof ApiError ? err.message : FALLBACK_ERROR;
}
