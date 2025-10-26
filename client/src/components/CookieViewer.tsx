import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Cookie } from "@shared/schema";

interface CookieViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cookies: Cookie[];
  sessionUrl: string;
}

export function CookieViewer({ open, onOpenChange, cookies, sessionUrl }: CookieViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Session Cookies</DialogTitle>
          <DialogDescription className="font-mono text-xs">{sessionUrl}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-96 pr-4">
          {cookies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No cookies stored for this session</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cookies.map((cookie) => (
                <div
                  key={cookie.id}
                  className="p-4 border rounded-md space-y-2"
                  data-testid={`cookie-${cookie.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-sm font-semibold truncate">{cookie.name}</p>
                    <div className="flex gap-2 flex-shrink-0">
                      {cookie.httpOnly && (
                        <Badge variant="secondary" className="text-xs">
                          HttpOnly
                        </Badge>
                      )}
                      {cookie.secure && (
                        <Badge variant="secondary" className="text-xs">
                          Secure
                        </Badge>
                      )}
                      {cookie.sameSite && (
                        <Badge variant="secondary" className="text-xs">
                          {cookie.sameSite}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground break-all">
                    {cookie.value}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    {cookie.domain && <p>Domain: {cookie.domain}</p>}
                    {cookie.path && <p>Path: {cookie.path}</p>}
                    {cookie.expires && (
                      <p className="col-span-2">
                        Expires: {new Date(cookie.expires).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
