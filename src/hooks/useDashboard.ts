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
} from "@/lib/dashboard";

export const useSetupStatus = (userId: string | undefined) =>
  useQuery({
    queryKey: ["setupStatus", userId],
    queryFn: () => getSetupStatus(userId!),
    enabled: !!userId,
  });

export const useDashboardMetrics = (userId: string | undefined) =>
  useQuery({
    queryKey: ["dashboardMetrics", userId],
    queryFn: () => getDashboardMetrics(userId!),
    enabled: !!userId,
  });

export const useRecentCustomers = (userId: string | undefined) =>
  useQuery({
    queryKey: ["recentCustomers", userId],
    queryFn: () => getRecentCustomersWithOutstanding(userId!),
    enabled: !!userId,
  });

export const useOverdueInvoices = (userId: string | undefined) =>
  useQuery({
    queryKey: ["overdueInvoices", userId],
    queryFn: () => getOverdueInvoices(userId!),
    enabled: !!userId,
  });

export const usePendingReminders = (userId: string | undefined) =>
  useQuery({
    queryKey: ["pendingReminders", userId],
    queryFn: () => getPendingReminders(userId!),
    enabled: !!userId,
  });

export const useInvoicesNeedingSending = (userId: string | undefined) =>
  useQuery({
    queryKey: ["invoicesNeedingSending", userId],
    queryFn: () => getInvoicesNeedingSending(userId!),
    enabled: !!userId,
  });

export const useTodaySnapshot = (userId: string | undefined) =>
  useQuery({
    queryKey: ["todaySnapshot", userId],
    queryFn: () => getTodaySnapshot(userId!),
    enabled: !!userId,
  });
