import { PipeTransform, BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export class ZodBody<T> implements PipeTransform {
  constructor(private schema: z.Schema<T>) {}
  transform(value: unknown) {
    const r = this.schema.safeParse(value);
    if (!r.success) {
      throw new BadRequestException(z.treeifyError(r.error));
    }
    return r.data;
  }
}
