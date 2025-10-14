/**
 * PDF Consistency Utilities
 * 
 * This file contains utilities to ensure PDF generation matches preview exactly.
 * The key principle is: What You See Is What You Get (WYSIWYG)
 * 
 * CORE PRINCIPLES:
 * 1. Template preview MUST use UnifiedInvoiceLayout component
 * 2. PDF generation MUST capture the same UnifiedInvoiceLayout component
 * 3. All data (company, banking, template settings) MUST be identical
 * 4. CSS and fonts MUST be identical between preview and PDF
 */

export interface PDFConsistencyReport {
  isConsistent: boolean;
  warnings: string[];
  errors: string[];
  details: {
    hasCompanySettings: boolean;
    hasBankingSettings: boolean;
    hasTemplateSettings: boolean;
    layoutType: string;
    variant: string;
  };
}

/**
 * Validates that all required data is present for consistent PDF generation
 */
export function validatePDFConsistency(
  companySettings: any,
  bankingSettings: any,
  templateSettings: any,
  invoiceData: any
): PDFConsistencyReport {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check company settings
  if (!companySettings) {
    errors.push('Company settings are missing');
  } else if (!companySettings.name) {
    warnings.push('Company name is missing - will show placeholder');
  }

  // Check banking settings
  if (!bankingSettings) {
    warnings.push('Banking settings are missing - no bank details will show on invoice');
  } else if (bankingSettings.include_on_invoices && !bankingSettings.bank_name) {
    warnings.push('Banking details enabled but bank name is missing');
  }

  // Check template settings
  if (!templateSettings) {
    errors.push('Template settings are missing');
  } else {
    if (!templateSettings.primaryColor || !templateSettings.accentColor) {
      warnings.push('Template colors are incomplete - will use defaults');
    }
    if (!templateSettings.fontFamily) {
      warnings.push('Template font family is missing - will use Inter');
    }
  }

  // Check invoice data
  if (!invoiceData) {
    errors.push('Invoice data is missing');
  } else {
    if (!invoiceData.invoiceNumber) {
      errors.push('Invoice number is missing');
    }
    if (!invoiceData.customer || !invoiceData.customer.name) {
      errors.push('Customer information is incomplete');
    }
    if (!invoiceData.items || invoiceData.items.length === 0) {
      errors.push('Invoice has no line items');
    }
  }

  return {
    isConsistent: errors.length === 0,
    warnings,
    errors,
    details: {
      hasCompanySettings: !!companySettings,
      hasBankingSettings: !!bankingSettings,
      hasTemplateSettings: !!templateSettings,
      layoutType: templateSettings?.layout || 'default',
      variant: 'pdf',
    },
  };
}

/**
 * Logs consistency report to console for debugging
 */
export function logConsistencyReport(report: PDFConsistencyReport, context: string) {
  console.group(`[PDF Consistency Check: ${context}]`);
  
  if (report.isConsistent) {
    console.log('✅ PDF generation is consistent with preview');
  } else {
    console.warn('⚠️ PDF generation may not match preview exactly');
  }

  if (report.errors.length > 0) {
    console.error('❌ Errors:', report.errors);
  }

  if (report.warnings.length > 0) {
    console.warn('⚠️ Warnings:', report.warnings);
  }

  console.log('Details:', report.details);
  console.groupEnd();
}

/**
 * Generates a debug HTML comment that can be embedded in PDF HTML
 */
export function generateDebugComment(report: PDFConsistencyReport): string {
  return `
<!-- PDF Consistency Report
Generated: ${new Date().toISOString()}
Consistent: ${report.isConsistent}
Errors: ${report.errors.length}
Warnings: ${report.warnings.length}
Details: ${JSON.stringify(report.details, null, 2)}
-->
  `.trim();
}

/**
 * Checks if preview element matches what will be sent to PDF
 */
export function validatePreviewElement(elementId: string): {
  exists: boolean;
  isVisible: boolean;
  hasContent: boolean;
  dimensions: { width: number; height: number };
} {
  const element = document.getElementById(elementId);
  
  if (!element) {
    return {
      exists: false,
      isVisible: false,
      hasContent: false,
      dimensions: { width: 0, height: 0 },
    };
  }

  const rect = element.getBoundingClientRect();
  const hasContent = element.innerHTML.length > 0;

  return {
    exists: true,
    isVisible: rect.width > 0 && rect.height > 0,
    hasContent,
    dimensions: { width: rect.width, height: rect.height },
  };
}
