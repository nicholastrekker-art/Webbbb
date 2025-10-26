import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBrowserSessionSchema } from "@shared/schema";
import type { InsertBrowserSessionInput } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface CreateSessionDialogProps {
  userId: string;
  onSubmit: (data: InsertBrowserSessionInput) => void;
  isPending?: boolean;
}

export function CreateSessionDialog({ userId, onSubmit, isPending }: CreateSessionDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<InsertBrowserSessionInput>({
    resolver: zodResolver(insertBrowserSessionSchema),
    defaultValues: {
      userId,
      url: "https://deriv.com/",
      status: "stopped",
      viewportWidth: 1920,
      viewportHeight: 1080,
      userAgent: "",
    },
  });

  const handleSubmit = (data: InsertBrowserSessionInput) => {
    onSubmit(data);
    setOpen(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-session" className="gap-2">
          <Plus className="w-5 h-5" />
          New Session
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Create Browser Session</DialogTitle>
          <DialogDescription>
            Start a new persistent browser session. The session will continue running in the
            background even when you close this interface.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com"
                      className="h-12 font-mono"
                      data-testid="input-session-url"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="viewportWidth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Viewport Width</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="h-12"
                        data-testid="input-viewport-width"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="viewportHeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Viewport Height</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="h-12"
                        data-testid="input-viewport-height"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="userAgent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User Agent (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Leave empty for default"
                      className="h-12 font-mono text-xs"
                      data-testid="input-user-agent"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-submit-session">
                {isPending ? "Creating..." : "Create Session"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
