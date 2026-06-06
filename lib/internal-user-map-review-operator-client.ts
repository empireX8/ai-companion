import type { CandidateLifecycleStatus } from "@prisma/client";

import {
  internalCandidateLifecycleApiPath,
  internalCandidatePublishApiPath,
  internalFieldworkCandidateLifecycleApiPath,
  internalFieldworkCandidatePublishApiPath,
  internalInvestigationCandidateLifecycleApiPath,
  internalInvestigationCandidatePublishApiPath,
} from "./internal-user-map-review-operator-actions";

export type InternalOperatorApiSuccess =
  | {
      kind: "lifecycle";
      id: string;
      previousStatus: CandidateLifecycleStatus;
      newStatus: CandidateLifecycleStatus;
      updatedAt: string;
    }
  | {
      kind: "publish";
      id: string;
      previousVisibility: string;
      newVisibility: string;
      updatedAt: string;
    };

export type InternalOperatorApiFailure = {
  ok: false;
  status: number;
  message: string;
  code: string | null;
};

export type InternalOperatorApiResult =
  | { ok: true; data: InternalOperatorApiSuccess }
  | InternalOperatorApiFailure;

type ErrorBody = {
  error?: string;
  code?: string;
};

async function parseErrorMessage(
  response: Response
): Promise<{ message: string; code: string | null }> {
  try {
    const body = (await response.json()) as ErrorBody;
    const message =
      typeof body.error === "string" && body.error.trim().length > 0
        ? body.error
        : `Request failed (${response.status})`;
    const code =
      typeof body.code === "string" && body.code.trim().length > 0
        ? body.code
        : null;
    return { message, code };
  } catch {
    return {
      message: `Request failed (${response.status})`,
      code: null,
    };
  }
}

export async function postInternalCandidateLifecycle(
  conclusionId: string,
  newStatus: CandidateLifecycleStatus,
  fetchImpl: typeof fetch = fetch
): Promise<InternalOperatorApiResult> {
  const response = await fetchImpl(internalCandidateLifecycleApiPath(conclusionId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newStatus }),
  });

  if (!response.ok) {
    const { message, code } = await parseErrorMessage(response);
    return { ok: false, status: response.status, message, code };
  }

  const data = (await response.json()) as {
    id: string;
    previousStatus: CandidateLifecycleStatus;
    newStatus: CandidateLifecycleStatus;
    updatedAt: string;
  };

  return {
    ok: true,
    data: {
      kind: "lifecycle",
      id: data.id,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
      updatedAt: data.updatedAt,
    },
  };
}

export async function postInternalCandidatePublish(
  conclusionId: string,
  fetchImpl: typeof fetch = fetch
): Promise<InternalOperatorApiResult> {
  const response = await fetchImpl(internalCandidatePublishApiPath(conclusionId), {
    method: "POST",
  });

  if (!response.ok) {
    const { message, code } = await parseErrorMessage(response);
    return { ok: false, status: response.status, message, code };
  }

  const data = (await response.json()) as {
    id: string;
    previousVisibility: string;
    newVisibility: string;
    updatedAt: string;
  };

  return {
    ok: true,
    data: {
      kind: "publish",
      id: data.id,
      previousVisibility: data.previousVisibility,
      newVisibility: data.newVisibility,
      updatedAt: data.updatedAt,
    },
  };
}

export async function postInternalInvestigationCandidateLifecycle(
  investigationId: string,
  newStatus: CandidateLifecycleStatus,
  fetchImpl: typeof fetch = fetch
): Promise<InternalOperatorApiResult> {
  const response = await fetchImpl(
    internalInvestigationCandidateLifecycleApiPath(investigationId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newStatus }),
    }
  );

  if (!response.ok) {
    const { message, code } = await parseErrorMessage(response);
    return { ok: false, status: response.status, message, code };
  }

  const data = (await response.json()) as {
    id: string;
    previousStatus: CandidateLifecycleStatus;
    newStatus: CandidateLifecycleStatus;
    updatedAt: string;
  };

  return {
    ok: true,
    data: {
      kind: "lifecycle",
      id: data.id,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
      updatedAt: data.updatedAt,
    },
  };
}

export async function postInternalInvestigationCandidatePublish(
  investigationId: string,
  fetchImpl: typeof fetch = fetch
): Promise<InternalOperatorApiResult> {
  const response = await fetchImpl(
    internalInvestigationCandidatePublishApiPath(investigationId),
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    const { message, code } = await parseErrorMessage(response);
    return { ok: false, status: response.status, message, code };
  }

  const data = (await response.json()) as {
    id: string;
    previousVisibility: string;
    newVisibility: string;
    updatedAt: string;
  };

  return {
    ok: true,
    data: {
      kind: "publish",
      id: data.id,
      previousVisibility: data.previousVisibility,
      newVisibility: data.newVisibility,
      updatedAt: data.updatedAt,
    },
  };
}

export async function postInternalFieldworkCandidateLifecycle(
  fieldworkAssignmentId: string,
  newStatus: CandidateLifecycleStatus,
  fetchImpl: typeof fetch = fetch
): Promise<InternalOperatorApiResult> {
  const response = await fetchImpl(
    internalFieldworkCandidateLifecycleApiPath(fieldworkAssignmentId),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newStatus }),
    }
  );

  if (!response.ok) {
    const { message, code } = await parseErrorMessage(response);
    return { ok: false, status: response.status, message, code };
  }

  const data = (await response.json()) as {
    id: string;
    previousStatus: CandidateLifecycleStatus;
    newStatus: CandidateLifecycleStatus;
    updatedAt: string;
  };

  return {
    ok: true,
    data: {
      kind: "lifecycle",
      id: data.id,
      previousStatus: data.previousStatus,
      newStatus: data.newStatus,
      updatedAt: data.updatedAt,
    },
  };
}

export async function postInternalFieldworkCandidatePublish(
  fieldworkAssignmentId: string,
  fetchImpl: typeof fetch = fetch
): Promise<InternalOperatorApiResult> {
  const response = await fetchImpl(
    internalFieldworkCandidatePublishApiPath(fieldworkAssignmentId),
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    const { message, code } = await parseErrorMessage(response);
    return { ok: false, status: response.status, message, code };
  }

  const data = (await response.json()) as {
    id: string;
    previousVisibility: string;
    newVisibility: string;
    updatedAt: string;
  };

  return {
    ok: true,
    data: {
      kind: "publish",
      id: data.id,
      previousVisibility: data.previousVisibility,
      newVisibility: data.newVisibility,
      updatedAt: data.updatedAt,
    },
  };
}
