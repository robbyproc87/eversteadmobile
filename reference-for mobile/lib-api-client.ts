export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getRedirectUrl(): string {
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
  return `/auth/login?next=${encodeURIComponent(currentPath)}`;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = getRedirectUrl();
    }
    throw new ApiError("Unauthorized", 401);
  }

  if (!response.ok) {
    let message = "Request failed";
    let data: unknown;
    
    try {
      data = await response.json();
      if (typeof data === "object" && data !== null && "message" in data) {
        message = String((data as { message: string }).message);
      } else if (typeof data === "object" && data !== null && "error" in data) {
        message = String((data as { error: string }).error);
      }
    } catch {
      message = response.statusText || "Request failed";
    }
    
    throw new ApiError(message, response.status, data);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function apiGet<T>(
  path: string,
  opts?: RequestInit
): Promise<T> {
  const response = await fetch(path, {
    ...opts,
    method: "GET",
    headers: {
      "Accept": "application/json",
      ...opts?.headers,
    },
    credentials: "include",
  });

  return handleResponse<T>(response);
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  opts?: RequestInit
): Promise<T> {
  const response = await fetch(path, {
    ...opts,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...opts?.headers,
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export async function apiPut<T>(
  path: string,
  body: unknown,
  opts?: RequestInit
): Promise<T> {
  const response = await fetch(path, {
    ...opts,
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...opts?.headers,
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export async function apiDelete<T>(
  path: string,
  opts?: RequestInit
): Promise<T> {
  const response = await fetch(path, {
    ...opts,
    method: "DELETE",
    headers: {
      "Accept": "application/json",
      ...opts?.headers,
    },
    credentials: "include",
  });

  return handleResponse<T>(response);
}
