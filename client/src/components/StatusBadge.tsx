import { Badge } from "@/components/ui/badge";

type SessionStatus = "running" | "paused" | "stopped" | "error";

interface StatusBadgeProps {
  status: SessionStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const statusConfig = {
    running: {
      label: "Running",
      dotColor: "bg-green-500",
      variant: "default" as const,
      animate: true,
    },
    paused: {
      label: "Paused",
      dotColor: "bg-yellow-500",
      variant: "secondary" as const,
      animate: false,
    },
    stopped: {
      label: "Stopped",
      dotColor: "bg-gray-400",
      variant: "secondary" as const,
      animate: false,
    },
    error: {
      label: "Error",
      dotColor: "bg-red-500",
      variant: "destructive" as const,
      animate: false,
    },
  };

  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className="gap-2" data-testid={`status-${status}`}>
      <span
        className={`w-2 h-2 rounded-full ${config.dotColor} ${
          config.animate ? "animate-pulse" : ""
        }`}
      />
      <span className="text-xs">{config.label}</span>
    </Badge>
  );
}
