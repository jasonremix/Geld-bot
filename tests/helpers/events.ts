import { randomUUID } from "node:crypto";
import type { NormalizedWebhookEvent } from "../../src/lib/payments/types";

/** Baut ein normalisiertes Webhook-Event für Tests. */
export function makeEvent(
  type: NormalizedWebhookEvent["type"],
  data: NormalizedWebhookEvent["data"],
  id = `evt_${randomUUID()}`,
): NormalizedWebhookEvent {
  return {
    id,
    type,
    providerEventType: type,
    createdAt: new Date(),
    data,
  };
}
