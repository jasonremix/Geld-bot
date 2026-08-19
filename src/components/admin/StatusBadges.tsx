import { Badge } from "@/components/ui/Stat";

export function OrderBadge({ status }: { status: string }) {
  const tone =
    status === "PAID"
      ? "positive"
      : status === "PENDING"
        ? "warning"
        : status === "FAILED" || status === "CANCELED"
          ? "danger"
          : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

export function SubscriptionBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE"
      ? "positive"
      : status === "PAST_DUE" || status === "GRACE"
        ? "warning"
        : status === "CANCELED" || status === "EXPIRED"
          ? "danger"
          : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

export function PayoutBadge({ status }: { status: string }) {
  const tone =
    status === "COMPLETED"
      ? "positive"
      : status === "FAILED"
        ? "danger"
        : status === "UNKNOWN"
          ? "neutral"
          : "warning";
  return <Badge tone={tone}>{status}</Badge>;
}
