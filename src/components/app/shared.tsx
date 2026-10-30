"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AlertCircle, Leaf, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StatCard({
  icon,
  label,
  value,
  sub,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("soft-card card-hover p-4 flex items-start gap-3", className)}>
      <div className="h-10 w-10 shrink-0 rounded-full bg-mint-soft flex items-center justify-center text-teal-700 dark:text-teal-200">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-extrabold leading-tight mt-0.5">{value}</p>
        {sub ? <p className="text-xs text-muted-foreground mt-0.5">{sub}</p> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl border border-dashed bg-muted/30">
      <div className="h-12 w-12 rounded-full bg-mint-soft flex items-center justify-center text-teal-700 dark:text-teal-200 mb-3">
        {icon ?? <Leaf className="h-6 w-6" />}
      </div>
      <p className="font-bold">{title}</p>
      {description ? <p className="text-sm text-muted-foreground mt-1 max-w-md">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-6 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40">
      <AlertCircle className="h-8 w-8 text-rose-500 mb-2" />
      <p className="font-semibold text-rose-800 dark:text-rose-200">Something went wrong</p>
      <p className="text-sm text-rose-700/80 dark:text-rose-300/80 mt-1 max-w-md">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-1" /> Try again
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="h-11 w-11 rounded-xl bg-secondary flex items-center justify-center text-teal-700 dark:text-teal-200 shrink-0">
            {icon}
          </div>
        ) : null}
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2.5 w-full rounded-full bg-muted overflow-hidden", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-mint to-sky transition-all duration-500"
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function Ring({ value, size = 92, label }: { value: number; size?: number; label?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 7} strokeWidth="8" className="stroke-muted" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 7}
          strokeWidth="8"
          strokeLinecap="round"
          className="stroke-mint transition-all duration-700"
          fill="none"
          strokeDasharray={2 * Math.PI * (size / 2 - 7)}
          strokeDashoffset={2 * Math.PI * (size / 2 - 7) * (1 - v / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-extrabold leading-none">{v}%</span>
        {label ? <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span> : null}
      </div>
    </div>
  );
}

export function AIRunning({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mint opacity-60" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-mint" />
      </span>
      {label ?? "Thinking…"}
    </div>
  );
}
