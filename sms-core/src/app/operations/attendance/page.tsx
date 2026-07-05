"use client";

import React from "react";
import DesktopAttendancePage from "@/components/desktop-attendance";
import MobileAttendancePage from "@/components/mobile-attendance";

export default function AttendancePage() {
  return (
    <>
      {/* ─── MOBILE VIEW CONTAINER ─── */}
      {/* Hidden on medium screens (768px) and up */}
      <div className="block md:hidden w-full h-full">
        <MobileAttendancePage />
      </div>

      {/* ─── DESKTOP VIEW CONTAINER ─── */}
      {/* Hidden on mobile, displayed as a flex container from md screens up */}
      <div className="hidden md:flex w-full h-full">
        <DesktopAttendancePage />
      </div>
    </>
  );
}