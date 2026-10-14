import { Injectable } from '@nestjs/common';
import type { CutRequest } from '../../quotations/cutting-optimizer.service';
import { CuttingOptimizerService } from '../../quotations/cutting-optimizer.service';

@Injectable()
export class LegacyBfdCuttingAdapter {
  constructor(private readonly legacy: CuttingOptimizerService) {}

  optimize(userId: string, requests: CutRequest[]) {
    return this.legacy.optimizeCuts(userId, requests);
  }
}
