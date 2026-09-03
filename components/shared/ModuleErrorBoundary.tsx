"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ModuleErrorBoundaryProps {
  children: ReactNode;
  moduleName: string;
  resetKey?: string | number;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function isLikelyNetworkError(error: Error | null) {
  if (!error) return false;
  const message = error.message.toLocaleLowerCase("nl-BE");
  return (
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    message.includes("aborted")
  );
}

export class ModuleErrorBoundary extends Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  state: ModuleErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ModuleErrorBoundary:${this.props.moduleName}]`, error, info);
  }

  componentDidUpdate(prevProps: ModuleErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const networkIssue = isLikelyNetworkError(this.state.error);

    return (
      <div className="mx-auto w-full max-w-[1500px] p-4 lg:p-6">
        <Card role="alert">
          <CardHeader className="gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0"
                aria-hidden
              />
              <div className="space-y-1">
                <CardTitle className="text-lg">
                  {this.props.moduleName} kon niet worden geladen
                </CardTitle>
                <CardDescription className="text-sm leading-6">
                  {networkIssue
                    ? "De verbinding met de server is onderbroken of duurde te lang."
                    : "Er trad een onverwachte fout op in deze module. Je lesgegevens in de actieve les blijven bewaard."}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={this.handleRetry}>
              <RefreshCw className="size-4" />
              Opnieuw proberen
            </Button>
            <p className="text-xs text-amber-100/70">
              Blijft het probleem? Controleer je internetverbinding of probeer
              het later opnieuw.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export function withModuleErrorBoundary(
  moduleName: string,
  children: ReactNode,
  resetKey?: string | number,
) {
  return (
    <ModuleErrorBoundary moduleName={moduleName} resetKey={resetKey}>
      {children}
    </ModuleErrorBoundary>
  );
}
