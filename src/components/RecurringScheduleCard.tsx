import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RefreshCw, Pause, Play, Trash2, CalendarClock } from "lucide-react";
import { format, addDays, addWeeks, addMonths } from "date-fns";
import { useState, useEffect } from "react";
import {
  useRecurringSchedule,
  useUpsertRecurringSchedule,
  useToggleRecurringSchedule,
  useDeleteRecurringSchedule,
} from "@/hooks/useRecurringInvoices";
import { useToast } from "@/hooks/use-toast";

interface RecurringScheduleCardProps {
  invoiceId: string;
  userId: string;
  customerId: string;
  isEditMode?: boolean;
  /** Hide the card entirely when no schedule exists and we're on InvoiceDetails */
  viewOnly?: boolean;
}

const frequencyLabels: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annually: "Annually",
};

function getDefaultNextDate(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case "weekly":
      return addWeeks(now, 1).toISOString().split("T")[0];
    case "monthly":
      return addMonths(now, 1).toISOString().split("T")[0];
    case "quarterly":
      return addMonths(now, 3).toISOString().split("T")[0];
    case "annually":
      return addMonths(now, 12).toISOString().split("T")[0];
    default:
      return addMonths(now, 1).toISOString().split("T")[0];
  }
}

export function RecurringScheduleCard({
  invoiceId,
  userId,
  customerId,
  isEditMode = false,
  viewOnly = false,
}: RecurringScheduleCardProps) {
  const { data: schedule, isLoading } = useRecurringSchedule(invoiceId);
  const upsertMutation = useUpsertRecurringSchedule();
  const toggleMutation = useToggleRecurringSchedule();
  const deleteMutation = useDeleteRecurringSchedule();
  const { toast } = useToast();

  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState("monthly");
  const [nextRunDate, setNextRunDate] = useState(getDefaultNextDate("monthly"));

  useEffect(() => {
    if (schedule) {
      setIsRecurring(true);
      setFrequency(schedule.frequency);
      setNextRunDate(schedule.next_run_date);
    }
  }, [schedule]);

  if (isLoading) return null;

  // In view-only mode (InvoiceDetails), don't show if no schedule
  if (viewOnly && !schedule) return null;

  const handleToggleRecurring = (checked: boolean) => {
    setIsRecurring(checked);
    if (!checked && schedule) {
      // Pause the schedule
      toggleMutation.mutate(
        { scheduleId: schedule.id, isActive: false },
        {
          onSuccess: () => toast({ title: "Recurring schedule paused" }),
        },
      );
    }
  };

  const handleSave = () => {
    upsertMutation.mutate(
      {
        invoiceId,
        userId,
        customerId,
        frequency,
        nextRunDate,
      },
      {
        onSuccess: () =>
          toast({
            title: "Recurring schedule saved",
            description: `Invoice will recur ${frequencyLabels[frequency].toLowerCase()}, next on ${format(new Date(nextRunDate), "dd MMM yyyy")}.`,
          }),
      },
    );
  };

  const handlePause = () => {
    if (!schedule) return;
    toggleMutation.mutate(
      { scheduleId: schedule.id, isActive: false },
      { onSuccess: () => toast({ title: "Recurring schedule paused" }) },
    );
  };

  const handleResume = () => {
    if (!schedule) return;
    toggleMutation.mutate(
      { scheduleId: schedule.id, isActive: true },
      { onSuccess: () => toast({ title: "Recurring schedule resumed" }) },
    );
  };

  const handleDelete = () => {
    if (!schedule) return;
    deleteMutation.mutate(schedule.id, {
      onSuccess: () => {
        setIsRecurring(false);
        toast({ title: "Recurring schedule cancelled" });
      },
    });
  };

  // View-only mode for InvoiceDetails with existing schedule
  if (viewOnly && schedule) {
    return (
      <Card className="shadow-sm border-primary/20">
        <CardHeader className="py-2.5 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Recurring Schedule
            </CardTitle>
            <Badge
              variant={schedule.is_active ? "default" : "secondary"}
              className="text-xs"
            >
              {schedule.is_active ? "Active" : "Paused"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 px-4 pb-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Frequency</span>
              <p className="font-medium">{frequencyLabels[schedule.frequency]}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Next Run</span>
              <p className="font-medium">
                {format(new Date(schedule.next_run_date), "dd MMM yyyy")}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Generated</span>
              <p className="font-medium">{schedule.total_generated} invoices</p>
            </div>
            {schedule.last_generated_at && (
              <div>
                <span className="text-muted-foreground text-xs">Last Generated</span>
                <p className="font-medium">
                  {format(new Date(schedule.last_generated_at), "dd MMM yyyy")}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            {schedule.is_active ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePause}
                disabled={toggleMutation.isPending}
                className="flex-1 h-7 text-xs"
              >
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResume}
                disabled={toggleMutation.isPending}
                className="flex-1 h-7 text-xs"
              >
                <Play className="h-3 w-3 mr-1" />
                Resume
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="h-7 text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Edit mode for NewInvoice sidebar
  return (
    <Card className="shadow-sm">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Recurring
          </CardTitle>
          <Switch
            checked={isRecurring}
            onCheckedChange={handleToggleRecurring}
          />
        </div>
      </CardHeader>
      {isRecurring && (
        <CardContent className="pt-0 px-4 pb-3 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Frequency</Label>
            <Select
              value={frequency}
              onValueChange={(val) => {
                setFrequency(val);
                setNextRunDate(getDefaultNextDate(val));
              }}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Next Invoice Date</Label>
            <Input
              type="date"
              value={nextRunDate}
              onChange={(e) => setNextRunDate(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {schedule && (
            <div className="text-xs text-muted-foreground">
              {schedule.total_generated} invoices generated so far
            </div>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={upsertMutation.isPending}
            className="w-full h-8 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            {schedule ? "Update Schedule" : "Enable Recurring"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
