import React from 'react';
import { AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 fade-in h-full">
          <div className="w-12 h-12 rounded-full bg-[#ef444415] flex items-center justify-center text-[#ef4444] mb-2">
            <AlertTriangle size={24} />
          </div>
          <p className="text-[14px] font-medium text-[#e2e8f0]">
            This section failed to load
          </p>
          <p className="text-[12px] text-[#475569] text-center max-w-xs">
            {this.state.error?.message || "Check backend connection or data shape."}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
