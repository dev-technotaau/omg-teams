"use client";

import { useEffect, useCallback } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

// ──────────────────────────────────────────────
//  Onboarding Tour — driver.js integration
//  Spec Section 18.7
// ──────────────────────────────────────────────

interface OnboardingTourProps {
  tourId: string;
  steps: DriveStep[];
  /** Delay before auto-starting (ms). Default 1000 */
  delay?: number;
  /** Force show even if previously completed */
  force?: boolean;
}

const STORAGE_KEY_PREFIX = "onboarding_";

function getTourKey(tourId: string): string {
  return `${STORAGE_KEY_PREFIX}${tourId}_done`;
}

export function isTourCompleted(tourId: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(getTourKey(tourId)) === "true";
}

export function resetTour(tourId: string): void {
  localStorage.removeItem(getTourKey(tourId));
}

export function OnboardingTour({
  tourId,
  steps,
  delay = 1000,
  force = false,
}: OnboardingTourProps) {
  const startTour = useCallback(() => {
    if (!force && isTourCompleted(tourId)) return;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      overlayColor: "rgba(0, 24, 69, 0.6)",
      stagePadding: 8,
      stageRadius: 8,
      popoverClass: "omg-tour-popover",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Got it!",
      steps,
      onDestroyStarted: () => {
        localStorage.setItem(getTourKey(tourId), "true");
        driverObj.destroy();
      },
    });

    driverObj.drive();
  }, [tourId, steps, force]);

  useEffect(() => {
    const timeout = setTimeout(startTour, delay);
    return () => clearTimeout(timeout);
  }, [startTour, delay]);

  return null;
}

// ──────────────────────────────────────────────
//  Pre-defined tour step configs
// ──────────────────────────────────────────────

export const DASHBOARD_TOUR_STEPS: DriveStep[] = [
  {
    element: "[data-tour='sidebar']",
    popover: {
      title: "Navigation Sidebar",
      description:
        "Access all sections of the platform from here — reports, analytics, admin tools, and more.",
      side: "right",
      align: "start",
    },
  },
  {
    element: "[data-tour='stats-cards']",
    popover: {
      title: "Key Metrics",
      description:
        "Your dashboard shows real-time KPIs including candidates sourced, pipeline status, and target achievement.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "[data-tour='quick-actions']",
    popover: {
      title: "Quick Actions",
      description:
        "Submit reports, view targets, and access frequently used features with one click.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: "[data-tour='notifications']",
    popover: {
      title: "Notifications",
      description:
        "Stay updated with real-time alerts for report approvals, target updates, and system messages.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: "[data-tour='command-palette']",
    popover: {
      title: "Quick Search",
      description:
        "Press Ctrl+K (or Cmd+K on Mac) to instantly search candidates, companies, and navigate anywhere.",
      side: "bottom",
      align: "center",
    },
  },
];

export const REPORT_TOUR_STEPS: DriveStep[] = [
  {
    element: "[data-tour='report-form']",
    popover: {
      title: "Daily Report Form",
      description:
        "Fill in candidate details here. Fields are organized based on your assigned zone.",
      side: "top",
      align: "center",
    },
  },
  {
    element: "[data-tour='zone-fields']",
    popover: {
      title: "Zone-Specific Fields",
      description:
        "Some fields only appear for certain zones. West/Central zones (Set A) have 33 fields, while East/North/South (Set B) have 28.",
      side: "top",
      align: "center",
    },
  },
  {
    element: "[data-tour='save-draft']",
    popover: {
      title: "Save as Draft",
      description: "Save your progress and come back later. Drafts auto-save every 30 seconds.",
      side: "top",
      align: "center",
    },
  },
  {
    element: "[data-tour='submit-report']",
    popover: {
      title: "Submit Report",
      description:
        "Once all required fields are filled, submit for your Reporting Manager's review.",
      side: "top",
      align: "center",
    },
  },
];
