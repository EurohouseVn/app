import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtUser } from '../../auth/current-user.decorator';

@Injectable()
export class ProductionService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Quản lý Khuôn đùn (Die Shop)
  async getDies() {
    return this.prisma.die.findMany({
      include: { profile: { select: { name: true, code: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createDie(data: any) {
    return this.prisma.die.create({
      data: {
        code: data.code,
        profileId: data.profileId,
        maintenanceAlert: data.maintenanceAlert || 500,
        location: data.location || ''
      }
    });
  }

  // 2. Lệnh Sản Xuất (Work Orders)
  async getWorkOrders() {
    return this.prisma.workOrder.findMany({
      include: {
        profile: { select: { name: true, code: true } },
        die: { select: { code: true } },
        steps: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createWorkOrder(user: JwtUser, data: any) {
    const wo = await this.prisma.workOrder.create({
      data: {
        code: data.code || `WO-${Date.now().toString().slice(-6)}`,
        profileId: data.profileId,
        dieId: data.dieId || null,
        targetKg: data.targetKg,
        colorCode: data.colorCode || '',
        createdById: user.sub,
        status: 'PENDING'
      }
    });

    // Tạo sẵn 4 công đoạn (Routing)
    const steps = ['EXTRUSION', 'AGING', 'COATING', 'PACKING'];
    for (const step of steps) {
      await this.prisma.workOrderStep.create({
        data: {
          workOrderId: wo.id,
          stepName: step,
          status: 'PENDING'
        }
      });
    }

    return wo;
  }

  // 3. Shop floor (Cập nhật tiến độ tại xưởng)
  async getPendingSteps(stepName: string) {
    // Tìm các WO đang chạy mà công đoạn này đang PENDING hoặc IN_PROGRESS
    return this.prisma.workOrderStep.findMany({
      where: {
        stepName,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        workOrder: { status: { in: ['PENDING', 'IN_PROGRESS'] } }
      },
      include: {
        workOrder: {
          include: {
            profile: { select: { name: true, code: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async startStep(stepId: string, data: any) {
    const step = await this.prisma.workOrderStep.findUnique({ where: { id: stepId }, include: { workOrder: true } });
    if (!step) throw new BadRequestException('Không tìm thấy công đoạn');

    if (step.workOrder.status === 'PENDING') {
      await this.prisma.workOrder.update({ where: { id: step.workOrder.id }, data: { status: 'IN_PROGRESS' } });
    }

    return this.prisma.workOrderStep.update({
      where: { id: stepId },
      data: {
        status: 'IN_PROGRESS',
        machineCode: data.machineCode || '',
        workerName: data.workerName || '',
        startedAt: new Date()
      }
    });
  }

  async completeStep(stepId: string, data: any) {
    const step = await this.prisma.workOrderStep.findUnique({ where: { id: stepId }, include: { workOrder: true } });
    if (!step) throw new BadRequestException('Không tìm thấy công đoạn');

    const updatedStep = await this.prisma.workOrderStep.update({
      where: { id: stepId },
      data: {
        status: 'COMPLETED',
        inputKg: data.inputKg || 0,
        outputKg: data.outputKg || 0,
        scrapKg: data.scrapKg || 0,
        completedAt: new Date(),
        note: data.note || ''
      }
    });

    // Nếu đây là công đoạn đùn ép (EXTRUSION), cập nhật số lần đùn của khuôn
    if (step.stepName === 'EXTRUSION' && step.workOrder.dieId) {
      await this.prisma.die.update({
        where: { id: step.workOrder.dieId },
        data: {
          totalExtrusions: { increment: 1 },
          totalKg: { increment: updatedStep.outputKg }
        }
      });
    }

    // Cập nhật lại Scrap & Actual của WO
    const allSteps = await this.prisma.workOrderStep.findMany({ where: { workOrderId: step.workOrderId } });
    const totalScrap = allSteps.reduce((sum, s) => sum + s.scrapKg, 0);
    
    const packingStep = allSteps.find(s => s.stepName === 'PACKING');
    let actualKg = step.workOrder.actualKg;
    if (packingStep && packingStep.status === 'COMPLETED') {
      actualKg = packingStep.outputKg; // Khối lượng đóng gói cuối cùng
      // Nếu đóng gói hoàn thành -> WO hoàn thành
      await this.prisma.workOrder.update({
        where: { id: step.workOrderId },
        data: { status: 'COMPLETED', actualKg, scrapKg: totalScrap }
      });
    } else {
      await this.prisma.workOrder.update({
        where: { id: step.workOrderId },
        data: { scrapKg: totalScrap }
      });
    }

    return updatedStep;
  }

  // 4. Dashboard
  async getDashboardStats() {
    const wos = await this.prisma.workOrder.findMany({ where: { status: 'COMPLETED' } });
    const totalActual = wos.reduce((sum, w) => sum + w.actualKg, 0);
    const totalScrap = wos.reduce((sum, w) => sum + w.scrapKg, 0);
    
    // Yield = actual / (actual + scrap) * 100
    const totalInput = totalActual + totalScrap;
    const yieldRate = totalInput > 0 ? (totalActual / totalInput) * 100 : 0;

    const activeWosCount = await this.prisma.workOrder.count({ where: { status: 'IN_PROGRESS' } });
    const diesRequiringMaintenance = await this.prisma.die.count({
      where: {
        totalExtrusions: { gte: this.prisma.die.fields.maintenanceAlert }
      }
    });

    return {
      yieldRate,
      totalActual,
      totalScrap,
      activeWosCount,
      diesRequiringMaintenance
    };
  }
}
