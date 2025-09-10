import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(amount: number, decimals: number = 2): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function formatCurrency(amount: number, currency: string = "€"): string {
  return `${currency}${formatNumber(amount, 2)}`
}
