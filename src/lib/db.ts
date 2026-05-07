import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Order operations
export interface OrderRecord {
  id: string;
  externalCode?: string | null;
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  weight: string;
  quantity: string;
  tempZone: string;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
  batchId: string;
}

export interface ImportRecord {
  id: string;
  filename: string;
  sheetName: string;
  totalRows: number;
  successCount: number;
  failCount: number;
  createdAt: Date;
  batchId: string;
}

export interface TemplateRule {
  id: string;
  fingerprint: string;
  mapping: Record<string, string>;
  headers: string[];
  createdAt: Date;
  updatedAt: Date;
}

// Save order
export async function saveOrder(order: Omit<OrderRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<OrderRecord> {
  return prisma.order.create({
    data: order,
  });
}

// Get order by ID
export async function getOrder(id: string): Promise<OrderRecord | null> {
  return prisma.order.findUnique({ where: { id } });
}

// Get order by external code
export async function getOrderByExternalCode(externalCode: string): Promise<OrderRecord | null> {
  return prisma.order.findUnique({ where: { externalCode } });
}

// Get all orders with pagination and search
export async function getOrders(options?: {
  page?: number;
  pageSize?: number;
  search?: string;
  searchField?: string;
}): Promise<{ orders: OrderRecord[]; total: number }> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;
  const search = options?.search;
  const searchField = options?.searchField || 'receiverName';

  const where = search
    ? {
        [searchField]: {
          contains: search,
          mode: 'insensitive' as const,
        },
      }
    : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
}

// Save import record
export async function saveImportRecord(record: Omit<ImportRecord, 'id' | 'createdAt'>): Promise<ImportRecord> {
  return prisma.importRecord.create({
    data: record,
  });
}

// Get import records with pagination
export async function getImportRecords(options?: {
  page?: number;
  pageSize?: number;
}): Promise<{ imports: ImportRecord[]; total: number }> {
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 20;

  const [imports, total] = await Promise.all([
    prisma.importRecord.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.importRecord.count(),
  ]);

  return { imports, total };
}

// Save template rule
export async function saveTemplateRule(rule: Omit<TemplateRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<TemplateRule> {
  const existing = await prisma.templateRule.findUnique({
    where: { fingerprint: rule.fingerprint },
  });

  if (existing) {
    const updated = await prisma.templateRule.update({
      where: { fingerprint: rule.fingerprint },
      data: {
        mapping: JSON.stringify(rule.mapping),
        headers: JSON.stringify(rule.headers),
      },
    });
    return {
      ...updated,
      mapping: JSON.parse(updated.mapping),
      headers: JSON.parse(updated.headers),
    };
  }

  const created = await prisma.templateRule.create({
    data: {
      fingerprint: rule.fingerprint,
      mapping: JSON.stringify(rule.mapping),
      headers: JSON.stringify(rule.headers),
    },
  });
  return {
    ...created,
    mapping: JSON.parse(created.mapping),
    headers: JSON.parse(created.headers),
  };
}

// Get template rule by fingerprint
export async function getTemplateRule(fingerprint: string): Promise<TemplateRule | null> {
  const rule = await prisma.templateRule.findUnique({
    where: { fingerprint },
  });

  if (!rule) return null;

  return {
    ...rule,
    mapping: JSON.parse(rule.mapping),
    headers: JSON.parse(rule.headers),
  };
}

// Check if external code exists
export async function checkExternalCodeExists(externalCode: string): Promise<OrderRecord | null> {
  return getOrderByExternalCode(externalCode);
}

// Batch check external codes
export async function batchCheckExternalCodes(codes: string[]): Promise<Map<string, OrderRecord | null>> {
  const results = new Map<string, OrderRecord | null>();
  
  const orders = await prisma.order.findMany({
    where: {
      externalCode: { in: codes.filter(c => c) },
    },
  });

  for (const code of codes) {
    const order = orders.find(o => o.externalCode === code);
    results.set(code, order || null);
  }

  return results;
}

// Health check
export async function dbHealthCheck(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}