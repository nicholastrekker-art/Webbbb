import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { Play, Pause, Square, Cookie, Eye } from "lucide-react";
import type { BrowserSession } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface SessionCardProps {
  session: BrowserSession;
  onView?: (session: BrowserSession) => void;
  onViewCookies?: (session: BrowserSession) => void;
  onPause?: (session: BrowserSession) => void;
  onResume?: (session: BrowserSession) => void;
  onStop?: (session: BrowserSession) => void;
  onSettings?: (session: BrowserSession) => void;
}

export function SessionCard({
  session,
  onView,
  onViewCookies,
  onPause,
  onResume,
  onStop,
  onSettings,
}: SessionCardProps) {
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const getRuntime = () => {
    if (session.lastActivityAt) {
      return formatDistanceToNow(new Date(session.lastActivityAt), { addSuffix: true });
    }
    return "Unknown";
  };

  return (
    <Card className="hover-elevate transition-shadow duration-200" data-testid={`session-card-${session.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">{getDomain(session.url).charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold truncate" data-testid={`session-domain-${session.id}`}>
              {getDomain(session.url)}
            </p>
            <p className="text-xs text-muted-foreground font-mono truncate" data-testid={`session-url-${session.id}`}>
              {session.url}
            </p>
          </div>
        </div>
        <StatusBadge status={session.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Last activity: {getRuntime()}</span>
          <span className="font-mono">{session.viewportWidth}×{session.viewportHeight}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onView?.(session)}
            data-testid={`button-view-${session.id}`}
            className="h-10 w-10"
            title="View Browser"
          >
            <Eye className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onViewCookies?.(session)}
            data-testid={`button-cookies-${session.id}`}
            className="h-10 w-10"
            title="View Cookies"
          >
            <Cookie className="w-5 h-5" />
          </Button>
          {session.status === "running" ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onPause?.(session)}
              data-testid={`button-pause-${session.id}`}
              className="h-10 w-10"
              title="Pause"
            >
              <Pause className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onResume?.(session)}
              data-testid={`button-resume-${session.id}`}
              className="h-10 w-10"
              title="Start"
            >
              <Play className="w-5 h-5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onStop?.(session)}
            data-testid={`button-stop-${session.id}`}
            className="h-10 w-10"
            title="Stop"
          >
            <Square className="w-5 h-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
