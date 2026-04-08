import { type DropdownCategory } from "@prisma/client";
import { z } from "zod";
import * as dropdownSvc from "../services/dropdown.service.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Dropdown Options Controller (Admin Master Data)
//
//  The frontend uses lowercase, descriptive category keys
//  (e.g. "higher_qualification") so the URLs read naturally.
//  Internally we map to the Prisma `DropdownCategory` enum.
//
//  We also accept the raw UPPERCASE Prisma enum names for
//  back-compat with the candidate report form, which still
//  calls `getDropdownOptions("STATE", ...)`.
// ──────────────────────────────────────────────

const FRIENDLY_TO_ENUM = {
  state: "STATE",
  location: "LOCATION",
  profile: "PROFILE",
  higher_qualification: "QUALIFICATION",
  notice_period: "NOTICE_PERIOD",
  diploma_type: "DIPLOMA",
  custom: "CUSTOM",
} as const satisfies Record<string, DropdownCategory>;

type FriendlyCategory = keyof typeof FRIENDLY_TO_ENUM;

const ENUM_TO_FRIENDLY: Record<DropdownCategory, FriendlyCategory> = {
  STATE: "state",
  LOCATION: "location",
  PROFILE: "profile",
  QUALIFICATION: "higher_qualification",
  NOTICE_PERIOD: "notice_period",
  DIPLOMA: "diploma_type",
  CUSTOM: "custom",
};

const FRIENDLY_KEYS = Object.keys(FRIENDLY_TO_ENUM) as FriendlyCategory[];
const ENUM_KEYS = Object.keys(ENUM_TO_FRIENDLY) as DropdownCategory[];

/**
 * Resolve a category from either the lowercase friendly key the admin
 * page uses, or the UPPERCASE Prisma enum the candidate form sends.
 * Throws a zod-style validation error on miss.
 */
function resolveCategory(raw: unknown): DropdownCategory {
  if (typeof raw === "string") {
    if ((FRIENDLY_KEYS as string[]).includes(raw)) {
      return FRIENDLY_TO_ENUM[raw as FriendlyCategory];
    }
    if ((ENUM_KEYS as string[]).includes(raw)) {
      return raw as DropdownCategory;
    }
  }
  throw new z.ZodError([
    {
      code: "invalid_enum_value",
      path: ["category"],
      message: `Invalid dropdown category: ${String(raw)}`,
      received: String(raw),
      options: [...FRIENDLY_KEYS, ...ENUM_KEYS],
    } as never,
  ]);
}

const zoneEnum = z.enum(["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"]).nullable().optional();

/**
 * Serialize a Prisma DropdownOption row into the shape the admin
 * master-data UI expects: friendly category key + zone/parentId surfaced.
 */
function serializeOption(o: {
  id: string;
  category: DropdownCategory;
  value: string;
  label: string;
  zone: "NORTH" | "SOUTH" | "EAST" | "WEST" | "CENTRAL" | null;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}) {
  return {
    id: o.id,
    category: ENUM_TO_FRIENDLY[o.category],
    value: o.value,
    label: o.label,
    zone: o.zone,
    parentId: o.parentId,
    sortOrder: o.sortOrder,
    isActive: o.isActive,
  };
}

export async function handleListDropdownOptions(req: Request, res: Response): Promise<void> {
  const category = resolveCategory(req.params["category"]);

  // Admin master-data view needs to see deactivated options too so they can
  // be reactivated; runtime form callers pass `?includeInactive=false`.
  const includeInactive = (req.query["includeInactive"] ?? "true") !== "false";

  const options = await dropdownSvc.listDropdownOptionsAdmin(category, includeInactive);
  res.status(200).json({ data: options.map(serializeOption) });
}

export async function handleCreateDropdownOption(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      // Accept either `fieldKey` (used by the master-data UI) or `category`
      // (legacy / direct API consumers). At least one is required.
      fieldKey: z.string().optional(),
      category: z.string().optional(),
      value: z.string().trim().min(1),
      label: z.string().trim().min(1),
      zone: zoneEnum,
      parentId: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
    })
    .refine((d) => Boolean(d.fieldKey ?? d.category), {
      message: "fieldKey or category is required",
      path: ["fieldKey"],
    })
    .parse(req.body);

  const category = resolveCategory(body.fieldKey ?? body.category);

  const option = await dropdownSvc.createDropdownOption({
    category,
    value: body.value,
    label: body.label,
    zone: body.zone,
    parentId: body.parentId,
    sortOrder: body.sortOrder,
  });

  res.status(201).json({ data: serializeOption(option) });
}

export async function handleUpdateDropdownOption(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      value: z.string().trim().min(1).optional(),
      label: z.string().trim().min(1).optional(),
      zone: zoneEnum,
      parentId: z.string().nullable().optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })
    .parse(req.body);
  const option = await dropdownSvc.updateDropdownOption(req.params["id"] as string, body);
  res.status(200).json({ data: serializeOption(option) });
}

export async function handleDeleteDropdownOption(req: Request, res: Response): Promise<void> {
  await dropdownSvc.deleteDropdownOption(req.params["id"] as string);
  res.status(200).json({ message: "Dropdown option deactivated" });
}

/**
 * POST /dropdowns/reorder
 *
 * Accepts the master-data UI shape `{ items: [{ id, sortOrder }] }` —
 * each row carries its new explicit `sortOrder` so the swap-up/down
 * actions don't have to renumber the entire list.
 */
export async function handleReorderDropdownOptions(req: Request, res: Response): Promise<void> {
  const { items } = z
    .object({
      items: z
        .array(
          z.object({
            id: z.string(),
            sortOrder: z.number().int(),
          }),
        )
        .min(1),
    })
    .parse(req.body);
  await dropdownSvc.reorderDropdownOptions(items);
  res.status(200).json({ message: "Options reordered" });
}
