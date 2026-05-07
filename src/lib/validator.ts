import { z } from 'zod';
import { OrderData, ValidationError } from '@/types';

// Phone validation regex (Chinese mobile numbers)
const phoneRegex = /^1[3-9]\d{9}$/;

// Order schema for validation
const orderSchema = z.object({
  externalCode: z.string().optional(),
  senderName: z.string().min(1, '发件人姓名不能为空'),
  senderPhone: z.string().regex(phoneRegex, '发件人电话格式错误（需为11位手机号）'),
  senderAddress: z.string().min(1, '发件人地址不能为空'),
  receiverName: z.string().min(1, '收件人姓名不能为空'),
  receiverPhone: z.string().regex(phoneRegex, '收件人电话格式错误（需为11位手机号）'),
  receiverAddress: z.string().min(1, '收件人地址不能为空'),
  weight: z.string().min(1, '重量不能为空').refine(v => !isNaN(Number(v)) && Number(v) > 0, '重量必须为正数'),
  quantity: z.string().min(1, '件数不能为空').refine(v => !isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) > 0, '件数必须为正整数'),
  tempZone: z.enum(['常温', '冷藏', '冷冻'], '温层必须为：常温、冷藏或冷冻'),
  note: z.string().optional(),
});

// Validate a single order
export function validateOrder(data: Record<string, unknown>, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Try to parse each field
  try {
    // Convert weight and quantity to strings for validation
    if (data.weight !== undefined && data.weight !== null) {
      data.weight = String(data.weight).trim();
    }
    
    if (data.quantity !== undefined && data.quantity !== null) {
      data.quantity = String(data.quantity).trim();
    }
    
    // Validate tempZone
    if (data.tempZone !== undefined) {
      const tempZone = String(data.tempZone).trim();
      if (!['常温', '冷藏', '冷冻'].includes(tempZone)) {
        errors.push({ row: rowIndex, field: 'tempZone', value: data.tempZone, message: '温层必须为：常温、冷藏或冷冻' });
      } else {
        data.tempZone = tempZone as '常温' | '冷藏' | '冷冻';
      }
    }
    
    // Validate using zod
    const result = orderSchema.safeParse(data);
    
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          row: rowIndex,
          field: issue.path[0] as string,
          value: data[issue.path[0] as string],
          message: issue.message,
        });
      }
    }
  } catch (error) {
    errors.push({ row: rowIndex, field: 'unknown', value: data, message: '验证异常' });
  }
  
  return errors;
}

// Validate batch of orders
export function validateOrders(
  orders: Record<string, unknown>[]
): { validOrders: OrderData[]; errors: ValidationError[] } {
  const validOrders: OrderData[] = [];
  const allErrors: ValidationError[] = [];
  
  for (let i = 0; i < orders.length; i++) {
    const errors = validateOrder(orders[i], i + 1);
    
    if (errors.length === 0) {
      validOrders.push(orders[i] as unknown as OrderData);
    } else {
      allErrors.push(...errors);
    }
  }
  
  // Check for duplicate external codes within batch
  const externalCodes = new Map<string, number>();
  for (let i = 0; i < orders.length; i++) {
    const code = orders[i].externalCode as string | undefined;
    if (code && code.trim()) {
      if (externalCodes.has(code)) {
        allErrors.push({
          row: i + 1,
          field: 'externalCode',
          value: code,
          message: `外部编码重复：与第 ${externalCodes.get(code)} 行重复`,
        });
      } else {
        externalCodes.set(code, i + 1);
      }
    }
  }
  
  return { validOrders, errors: allErrors };
}

// Format errors for display
export function formatErrors(errors: ValidationError[]): string[] {
  return errors.map(e => `第 ${e.row} 行，${getFieldName(e.field)}：${e.message}`);
}

// Get Chinese field name
function getFieldName(field: string): string {
  const fieldNames: Record<string, string> = {
    externalCode: '外部编码',
    senderName: '发件人姓名',
    senderPhone: '发件人电话',
    senderAddress: '发件人地址',
    receiverName: '收件人姓名',
    receiverPhone: '收件人电话',
    receiverAddress: '收件人地址',
    weight: '重量',
    quantity: '件数',
    tempZone: '温层',
    note: '备注',
  };
  return fieldNames[field] || field;
}
