"use client";

import React from "react";

export default function AttendanceSubpageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full h-full bg-transparent">
      {children}
    </div>
  );
}