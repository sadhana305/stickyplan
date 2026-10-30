"use client";

import { GraduationCap } from "lucide-react";

export function BRAND() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-mint to-sky flex items-center justify-center text-white shadow-sm">
        <GraduationCap className="h-5 w-5" />
      </div>
      <div className="leading-none">
        <span className="font-extrabold tracking-tight text-lg brand-gradient">STICKY PLAN</span>
        <p className="text-[10px] font-semibold text-muted-foreground mt-0.5">Your Personal AI Study Companion</p>
      </div>
    </div>
  );
}
