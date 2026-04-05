import { z } from "zod";
import * as companySvc from "../services/company.service.js";
import type { Request, Response } from "express";

// ──────────────────────────────────────────────
//  Company / Service Provider / HR Manager Controller
// ──────────────────────────────────────────────

// ── Company ──

export async function handleCreateCompany(req: Request, res: Response): Promise<void> {
  const { name } = z.object({ name: z.string().trim().min(1) }).parse(req.body);
  const company = await companySvc.createCompany(name);
  res.status(201).json({ company });
}

export async function handleListCompanies(req: Request, res: Response): Promise<void> {
  const search = req.query["search"] as string | undefined;
  const companies = await companySvc.listCompanies(search);
  res.status(200).json({ companies });
}

export async function handleGetCompany(req: Request, res: Response): Promise<void> {
  const company = await companySvc.getCompanyById(req.params["id"] as string);
  res.status(200).json({ company });
}

export async function handleUpdateCompany(req: Request, res: Response): Promise<void> {
  const { name } = z.object({ name: z.string().trim().min(1) }).parse(req.body);
  const company = await companySvc.updateCompany(req.params["id"] as string, name);
  res.status(200).json({ company });
}

export async function handleDeleteCompany(req: Request, res: Response): Promise<void> {
  await companySvc.deleteCompany(req.params["id"] as string, req.user!.id);
  res.status(200).json({ message: "Company deleted" });
}

// ── Service Provider ──

export async function handleCreateServiceProvider(req: Request, res: Response): Promise<void> {
  const { name, companyId } = z
    .object({ name: z.string().trim().min(1), companyId: z.string() })
    .parse(req.body);
  const sp = await companySvc.createServiceProvider(name, companyId);
  res.status(201).json({ serviceProvider: sp });
}

export async function handleListServiceProviders(req: Request, res: Response): Promise<void> {
  const companyId = req.params["companyId"] as string;
  const sps = await companySvc.listServiceProvidersByCompany(companyId);
  res.status(200).json({ serviceProviders: sps });
}

export async function handleUpdateServiceProvider(req: Request, res: Response): Promise<void> {
  const { name } = z.object({ name: z.string().trim().min(1) }).parse(req.body);
  const sp = await companySvc.updateServiceProvider(req.params["id"] as string, name);
  res.status(200).json({ serviceProvider: sp });
}

export async function handleDeleteServiceProvider(req: Request, res: Response): Promise<void> {
  await companySvc.deleteServiceProvider(req.params["id"] as string, req.user!.id);
  res.status(200).json({ message: "Service Provider deleted" });
}

// ── HR Manager ──

export async function handleCreateHRManager(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      name: z.string().trim().min(1),
      companyId: z.string(),
      email: z.string().trim().optional().nullable(),
      phone: z.string().trim().optional().nullable(),
    })
    .parse(req.body);
  const hr = await companySvc.createHRManager(body);
  res.status(201).json({ hrManager: hr });
}

export async function handleListHRManagers(req: Request, res: Response): Promise<void> {
  const companyId = req.params["companyId"] as string;
  const hrs = await companySvc.listHRManagersByCompany(companyId);
  res.status(200).json({ hrManagers: hrs });
}

export async function handleUpdateHRManager(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      name: z.string().trim().min(1).optional(),
      email: z.string().trim().optional().nullable(),
      phone: z.string().trim().optional().nullable(),
    })
    .parse(req.body);
  const hr = await companySvc.updateHRManager(req.params["id"] as string, body);
  res.status(200).json({ hrManager: hr });
}

export async function handleDeleteHRManager(req: Request, res: Response): Promise<void> {
  await companySvc.deleteHRManager(req.params["id"] as string, req.user!.id);
  res.status(200).json({ message: "HR Manager deleted" });
}
