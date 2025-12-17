/**
 * Shared PDF print rules for consistent PDF rendering across all document layouts.
 * These styles ensure professional PDF output with proper color rendering, 
 * table header repetition, row integrity, and numeric alignment.
 */

export const PDF_PRINT_STYLES = `
  /* Force exact colors for print */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
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

  /* Standardize body line-height for print */
  body {
    line-height: 1.35;
  }

  /* Additional print optimization rules */
  table {
    border-collapse: collapse;
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
`;
