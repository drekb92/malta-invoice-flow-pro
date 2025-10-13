import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary for invoice rendering
 * Catches and displays errors during invoice generation
 */
export class InvoiceErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[InvoiceErrorBoundary] Caught error:', error);
    console.error('[InvoiceErrorBoundary] Error info:', errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-8">
          <Alert variant="destructive">
            <AlertDescription>
              <h3 className="font-bold mb-2">Invoice Rendering Error</h3>
              <p className="mb-4">
                An error occurred while rendering the invoice. Please check the template settings and invoice data.
              </p>
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold mb-2">Error Details</summary>
                <pre className="bg-red-50 p-2 rounded overflow-auto">
                  {this.state.error?.toString()}
                  {this.state.errorInfo?.componentStack && (
                    <>
                      {'\n\nComponent Stack:'}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}
