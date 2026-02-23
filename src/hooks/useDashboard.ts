// src/hooks/useDashboard.ts
import { useQuery } from "@tanstack/react-query";
import {
  getSetupStatus,
  getDashboardMetrics,
  getRecentCustomersWithOutstanding,
  getOverdueInvoices,
  getPendingReminders,
  getInvoicesNeedingSending,
  getTodaySnapshot,
  type DashboardFilters,
} from "@/lib/dashboard";

// Re-export the type so Index.tsx (and others) can import it from here
export type { DashboardFilters };

export const useSetupStatus = (userId: string | undefined) =>
  useQuery({
    queryKey: ["setupStatus", userId],
    queryFn: () => getSetupStatus(userId!),
    enabled: !!userId,
  });

// Metrics re-fetch automatically whenever userId, dateRange, or customerId changes
export const useDashboardMetrics = (userId: string | undefined, filters: DashboardFilters = {}) =>
  useQuery({
    queryKey: ["dashboardMetrics", userId, filters.dateRange, filters.customerId],
    queryFn: () => getDashboardMetrics(userId!, filters),
    enabled: !!userId,
  });

// Unfiltered — populates the customer dropdown
export const useRecentCustomers = (userId: string | undefined) =>
  useQuery({
    queryKey: ["recentCustomers", userId],
    queryFn: () => getRecentCustomersWithOutstanding(userId!),
    enabled: !!userId,
  });

// Overdue filtered by customerId only (date range not applicable)
export const useOverdueInvoices = (userId: string | undefined, filters: DashboardFilters = {}) =>
  useQuery({
    queryKey: ["overdueInvoices", userId, filters.customerId],
    queryFn: () => getOverdueInvoices(userId!, filters),
    enabled: !!userId,
  });

export const usePendingReminders = (userId: string | undefined) =>
  useQuery({
    queryKey: ["pendingReminders", userId],
    queryFn: () => getPendingReminders(userId!),
    enabled: !!userId,
  });

// Needs-sending filtered by customerId only
export const useInvoicesNeedingSending = (userId: string | undefined, filters: DashboardFilters = {}) =>
  useQuery({
    queryKey: ["invoicesNeedingSending", userId, filters.customerId],
    queryFn: () => getInvoicesNeedingSending(userId!, filters),
    enabled: !!userId,
  });

// Today's snapshot is always "today" — no filters
export const useTodaySnapshot = (userId: string | undefined) =>
  useQuery({
    queryKey: ["todaySnapshot", userId],
    queryFn: () => getTodaySnapshot(userId!),
    enabled: !!userId,
  });
