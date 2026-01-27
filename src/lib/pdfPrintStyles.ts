/**
 * Shared PDF print rules for consistent PDF rendering across all document layouts.
 * These styles ensure professional PDF output with proper color rendering, 
 * table header repetition, row integrity, and numeric alignment.
 * 
 * Uses absolute units (mm, pt) for accurate A4 paper output.
 */

export const PDF_PRINT_STYLES = `
  /* A4 page setup with standard margins */
  @page { 
    size: A4; 
    margin: 15mm; 
  }

  /* Force exact colors for print */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  /* Main container sizing for A4 */
  .invoice-page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    box-sizing: border-box;
  }

  /* Inner content area with margins */
  .invoice-inner {
    padding: 15mm;
    width: 100%;
    min-height: 297mm;
    box-sizing: border-box;
  }

  /* Typography in points for print accuracy */
  body {
    font-size: 10pt;
    line-height: 1.4;
  }

  /* Header typography */
  .doc-title {
    font-size: 18pt !important;
    font-weight: 800;
  }

  .section-label {
    font-size: 8pt !important;
    font-weight: 700;
  }

  .customer-name {
    font-size: 11pt !important;
    font-weight: 700;
  }

  /* Body text */
  .company, .meta, .customer-info, .banking {
    font-size: 9pt !important;
    line-height: 1.4;
  }

  /* Table typography */
  table.items {
    font-size: 9pt !important;
  }

  table.items thead th {
    font-size: 8pt !important;
  }

  /* Totals typography */
  .totals {
    font-size: 9pt !important;
  }

  .totals .total .label,
  .totals .total .value {
    font-size: 11pt !important;
  }

  /* Footer typography */
  .thanks {
    font-size: 9pt !important;
  }

  /* Ensure table header repeats on each page */
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }

  /* Prevent row splits across pages */
  tr, td, th {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Numeric alignment class */
  .num {
    text-align: right;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* Additional print optimization rules */
  table {
    border-collapse: collapse;
    width: 100%;
  }

  /* Prevent orphaned headers and footers */
  h1, h2, h3, h4, h5, h6 {
    page-break-after: avoid;
    break-after: avoid;
  }

  /* Keep totals and banking sections together */
  .totals-section, .banking-section {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Print-specific media query overrides */
  @media print {
    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      height: 297mm;
    }

    .invoice-page {
      width: 210mm;
      min-height: 297mm;
      page-break-after: always;
    }

    .invoice-inner {
      padding: 0; /* @page margin handles this */
    }

    /* Ensure backgrounds print */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;
