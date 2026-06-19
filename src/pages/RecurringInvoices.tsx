import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useAllRecurringSchedules,
  useToggleRecurringSchedule,
  useDeleteRecurringSchedule,
  useGenerateRecurringNow,
} from "@/hooks/useRecurringInvoices";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { RefreshCw, Pause, Play, Trash2, Zap, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

export default function RecurringInvoices() {
  const { user } = useAuth();
  const { data: schedules, isLoading } = useAllRecurringSchedules(user?.id);
  const toggleMutation = useToggleRecurringSchedule();
  const deleteMutation = useDeleteRecurringSchedule();
  const generateNow = useGenerateRecurringNow();
  const { toast } = useToast();

  const handlePause = (scheduleId: string) => {
    toggleMutation.mutate(
      { scheduleId, isActive: false },
      { onSuccess: () => toast({ title: "Recurring schedule paused" }) },
    );
  };

  const handleResume = (scheduleId: string) => {
    toggleMutation.mutate(
      { scheduleId, isActive: true },
      { onSuccess: () => toast({ title: "Recurring schedule resumed" }) },
    );
  };

  const handleCancel = (scheduleId: string) => {
    deleteMutation.mutate(scheduleId, {
      onSuccess: () => toast({ title: "Recurring schedule cancelled" }),
    });
  };

  const handleGenerateNow = (scheduleId: string) => {
    generateNow.mutate(scheduleId, {
      onSuccess: () =>
        toast({
          title: "Invoice generated",
          description: "Check your invoice list for the new draft.",
        }),
      onError: (err: any) =>
        toast({
          title: "Generation failed",
          description: err.message,
          variant: "destructive",
        }),
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <RefreshCw className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold">Recurring Invoices</h1>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading schedules…</p>
      )}

      {!isLoading && (!schedules || schedules.length === 0) && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No recurring schedules set up yet.
            <br />
            Open any issued invoice and enable the Recurring toggle to get started.
          </CardContent>
        </Card>
      )}

      {schedules && schedules.length > 0 && (
        <div className="space-y-3">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="shadow-sm">
              <CardContent className="py-4 px-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {schedule.customers?.name ?? "Unknown client"}
                      </span>
                      <Badge
                        variant={schedule.is_active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {schedule.is_active ? "Active" : "Paused"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {frequencyLabels[schedule.frequency] ?? schedule.frequency}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>
                        Next invoice:{" "}
                        <span className="text-foreground font-medium">
                          {format(new Date(schedule.next_run_date), "dd MMM yyyy")}
                        </span>
                      </span>
                      {schedule.last_generated_at && (
                        <span>
                          Last generated:{" "}
                          {format(new Date(schedule.last_generated_at), "dd MMM yyyy")}
                        </span>
                      )}
                      <span>{schedule.total_generated} generated so far</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleGenerateNow(schedule.id)}
                      disabled={generateNow.isPending}
                    >
                      <Zap className="h-3 w-3 mr-1 text-amber-500" />
                      Generate Now
                    </Button>

                    {schedule.is_active ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handlePause(schedule.id)}
                        disabled={toggleMutation.isPending}
                      >
                        <Pause className="h-3 w-3 mr-1" />
                        Pause
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleResume(schedule.id)}
                        disabled={toggleMutation.isPending}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Resume
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-destructive hover:text-destructive"
                      onClick={() => handleCancel(schedule.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>

                    <Button variant="ghost" size="sm" className="h-8 text-xs" asChild>
                      <Link to={`/invoices/${schedule.source_invoice_id}?recurring=1`}>
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Source
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
