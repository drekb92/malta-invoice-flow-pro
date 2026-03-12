import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RecurringInvoice {
  id: string;
  user_id: string;
  source_invoice_id: string;
  customer_id: string;
  frequency: "weekly" | "monthly" | "quarterly" | "annually";
  next_run_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_generated_at: string | null;
  total_generated: number;
}

export function useRecurringSchedule(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["recurringSchedule", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_invoices")
        .select("*")
        .eq("source_invoice_id", invoiceId!)
        .maybeSingle();
      if (error) throw error;
      return data as RecurringInvoice | null;
    },
    enabled: !!invoiceId,
  });
}

export function useActiveRecurringSchedules(userId: string | undefined) {
  return useQuery({
    queryKey: ["activeRecurringSchedules", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_invoices")
        .select("*")
        .eq("user_id", userId!)
        .eq("is_active", true)
        .order("next_run_date", { ascending: true });
      if (error) throw error;
      return (data || []) as RecurringInvoice[];
    },
    enabled: !!userId,
  });
}

export function useRecurringSourceInvoiceIds(userId: string | undefined) {
  return useQuery({
    queryKey: ["recurringSourceIds", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_invoices")
        .select("source_invoice_id")
        .eq("user_id", userId!)
        .eq("is_active", true);
      if (error) throw error;
      return new Set((data || []).map((r: any) => r.source_invoice_id));
    },
    enabled: !!userId,
  });
}

export function useUpsertRecurringSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      invoiceId: string;
      userId: string;
      customerId: string;
      frequency: string;
      nextRunDate: string;
    }) => {
      // Check if schedule already exists
      const { data: existing } = await supabase
        .from("recurring_invoices")
        .select("id")
        .eq("source_invoice_id", params.invoiceId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("recurring_invoices")
          .update({
            frequency: params.frequency,
            next_run_date: params.nextRunDate,
            is_active: true,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recurring_invoices").insert({
          source_invoice_id: params.invoiceId,
          user_id: params.userId,
          customer_id: params.customerId,
          frequency: params.frequency,
          next_run_date: params.nextRunDate,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringSchedule"] });
      queryClient.invalidateQueries({ queryKey: ["activeRecurringSchedules"] });
      queryClient.invalidateQueries({ queryKey: ["recurringSourceIds"] });
    },
  });
}

export function useToggleRecurringSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { scheduleId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("recurring_invoices")
        .update({ is_active: params.isActive })
        .eq("id", params.scheduleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringSchedule"] });
      queryClient.invalidateQueries({ queryKey: ["activeRecurringSchedules"] });
      queryClient.invalidateQueries({ queryKey: ["recurringSourceIds"] });
    },
  });
}

export function useDeleteRecurringSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from("recurring_invoices")
        .delete()
        .eq("id", scheduleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringSchedule"] });
      queryClient.invalidateQueries({ queryKey: ["activeRecurringSchedules"] });
      queryClient.invalidateQueries({ queryKey: ["recurringSourceIds"] });
    },
  });
}
