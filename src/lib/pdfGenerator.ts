import { generateInvoicePDF, InvoiceData } from '@/services/pdfService';
import { getDefaultTemplate } from '@/services/templateService';

// Legacy PDF generation using html2canvas (kept for compatibility)
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PDFOptions {
  format?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  margin?: number;
  quality?: number;
}

export const generatePDF = async (
  elementId: string, 
  filename: string,
  options: PDFOptions = {}
): Promise<void> => {
  const {
    format = 'A4',
    orientation = 'portrait',
    margin = 10,
    quality = 0.95
  } = options;

  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID '${elementId}' not found`);
    }

    // Make the element visible temporarily for capture
    const originalDisplay = element.style.display;
    element.style.display = 'block';

    // Wait for fonts to load before capture
    // @ts-ignore
    if (document?.fonts?.ready) {
      await (document as any).fonts.ready;
    }

    // Configure html2canvas options for better quality
    const canvas = await html2canvas(element, {
      scale: 2, // Higher resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight
    });

    // Restore original display
    element.style.display = originalDisplay;

    // Calculate PDF dimensions
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    // PDF page dimensions (A4: 210 x 297 mm)
    const pdfWidth = format === 'A4' ? 210 : 216; // Letter: 216mm
    const pdfHeight = format === 'A4' ? 297 : 279; // Letter: 279mm
    
    // Calculate scaling to fit content with margins
    const availableWidth = pdfWidth - (margin * 2);
    const availableHeight = pdfHeight - (margin * 2);
    
    const ratio = Math.min(
      availableWidth / (imgWidth * 0.264583), // Convert pixels to mm
      availableHeight / (imgHeight * 0.264583)
    );
    
    const scaledWidth = (imgWidth * 0.264583) * ratio;
    const scaledHeight = (imgHeight * 0.264583) * ratio;

    // Create PDF
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: format.toLowerCase() as 'a4' | 'letter'
    });

    // Convert canvas to image data
    const imgData = canvas.toDataURL('image/png', quality);
    
    // Center the content on the page (both horizontally and vertically)
    const leftoverH = availableHeight - scaledHeight;
    const x = (pdfWidth - scaledWidth) / 2;
    const y = margin + Math.max(0, leftoverH / 2);
    
    // Add image to PDF
    pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight);
    
    // Download the PDF
    pdf.save(`${filename}.pdf`);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// New vector-based PDF generation with template support
export const generateInvoicePDFWithTemplate = async (
  invoiceData: InvoiceData,
  filename: string
): Promise<void> => {
  try {
    const template = await getDefaultTemplate();
    await generateInvoicePDF(invoiceData, template, filename);
  } catch (error) {
    console.error('Error generating PDF with template:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Legacy function (kept for compatibility)
export const generateInvoicePDFLegacy = async (invoiceNumber: string): Promise<void> => {
  return generatePDF('invoice-html-preview', invoiceNumber, {
    format: 'A4',
    orientation: 'portrait',
    margin: 15,
    quality: 0.95
  });
};