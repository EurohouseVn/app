import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    this.connectWithRetry();
  }

  private async connectWithRetry() {
    let retries = 10;
    while (retries > 0) {
      try {
        await this.$connect();
        console.log('Prisma database connected successfully.');
        break;
      } catch (err) {
        retries--;
        console.warn(`Prisma connection pending/retry (retries left: ${retries}):`, (err as Error).message);
        if (retries === 0) {
          console.error('Failed to connect to Prisma database after multiple attempts.');
        } else {
          await new Promise((res) => setTimeout(res, 2000));
        }
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
