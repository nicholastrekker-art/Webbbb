import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface MetricsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  testId?: string;
}

export function MetricsCard({ title, value, icon: Icon, testId }: MetricsCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-2">{title}</p>
            <p className="text-3xl font-bold" data-testid={testId}>
              {value}
            </p>
          </div>
          <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
            <Icon className="w-8 h-8 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
