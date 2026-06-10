import { z } from 'zod';

const auditSchema = z.object({
  action: z.string(),
  method: z.string(),
  url: z.string(),
  userId: z.number().optional(),
  requestBody: z.string().optional(),
  responseStatus: z.number().optional(),
});

export const auditSchema = auditSchema;
