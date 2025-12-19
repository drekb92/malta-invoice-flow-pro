// Invoice Status Model
// Document state (stored): draft, issued, void
// Payment status (computed): unpaid, partial, paid
// Due status (computed): not_due, due, overdue

export type DocumentStatus = 'draft' | 'issued' | 'void';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type DueStatus = 'not_due' | 'due' | 'overdue';

export interface InvoiceStatusInfo {
  document: DocumentStatus;
  payment: PaymentStatus;
  due: DueStatus;
  displayStatus: string; // The primary status to show in UI
}

export function computePaymentStatus(
  totalAmount: number,
  paidAmount: number
): PaymentStatus {
  if (paidAmount <= 0) return 'unpaid';
  if (paidAmount >= totalAmount) return 'paid';
  return 'partial';
}

export function computeDueStatus(
  dueDate: string | Date | null,
  paymentStatus: PaymentStatus
): DueStatus {
  if (paymentStatus === 'paid') return 'not_due';
  if (!dueDate) return 'not_due';
  
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  
  if (due < today) return 'overdue';
  if (due.getTime() === today.getTime()) return 'due';
  return 'not_due';
}

export function getInvoiceStatus(
  documentStatus: DocumentStatus,
  totalAmount: number,
  paidAmount: number,
  dueDate: string | Date | null
): InvoiceStatusInfo {
  const payment = computePaymentStatus(totalAmount, paidAmount);
  const due = computeDueStatus(dueDate, payment);
  
  // Determine display status (priority order)
  let displayStatus: string;
  
  if (documentStatus === 'draft') {
    displayStatus = 'draft';
  } else if (documentStatus === 'void') {
    displayStatus = 'void';
  } else if (payment === 'paid') {
    displayStatus = 'paid';
  } else if (due === 'overdue') {
    displayStatus = 'overdue';
  } else if (payment === 'partial') {
    displayStatus = 'partial';
  } else {
    displayStatus = 'issued'; // Issued but not yet paid or overdue
  }
  
  return { document: documentStatus, payment, due, displayStatus };
}

// Badge styling helpers
export function getStatusBadgeStyle(status: string): {
  className: string;
  label: string;
} {
  switch (status) {
    case 'draft':
      return {
        className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
        label: 'Draft'
      };
    case 'issued':
      return {
        className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
        label: 'Issued'
      };
    case 'paid':
      return {
        className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800',
        label: 'Paid'
      };
    case 'partial':
      return {
        className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800',
        label: 'Partially Paid'
      };
    case 'overdue':
      return {
        className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
        label: 'Overdue'
      };
    case 'void':
      return {
        className: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/50 dark:text-gray-400 dark:border-gray-800',
        label: 'Void'
      };
    default:
      return {
        className: 'bg-muted text-muted-foreground border-border',
        label: status
      };
  }
}
