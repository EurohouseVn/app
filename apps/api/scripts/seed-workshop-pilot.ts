import {
  PrismaClient,
  WorkshopInstallationStatus,
  WorkshopWorkOrderStatus,
  WorkshopWorkOrderType,
  WorkshopWorkspaceRole,
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.ALLOW_WORKSHOP_PILOT_SEED !== 'true') {
    throw new Error('Từ chối seed pilot. Đặt ALLOW_WORKSHOP_PILOT_SEED=true để xác nhận rõ môi trường thử nghiệm.');
  }

  const organizationCode = process.env.PILOT_ORG_CODE || 'XUONG-01';
  const organization = await prisma.organization.findUnique({ where: { code: organizationCode } });
  if (!organization || organization.type !== 'FACTORY') {
    throw new Error(`Không tìm thấy CSSX pilot hợp lệ với mã ${organizationCode}.`);
  }

  const actor = await prisma.user.findFirst({ where: { organizationId: organization.id }, orderBy: { createdAt: 'asc' } });
  if (!actor) throw new Error('CSSX pilot chưa có tài khoản để ghi nhận người tạo dữ liệu.');

  await prisma.workshopPilotConfig.upsert({
    where: { organizationId: organization.id },
    create: { organizationId: organization.id, active: true, survey: true, inventory: true, shopFloor: true, quality: true, installation: true, warranty: true, enabledAt: new Date(), updatedById: actor.id },
    update: { active: true, survey: true, inventory: true, shopFloor: true, quality: true, installation: true, warranty: true, enabledAt: new Date(), disabledAt: null, updatedById: actor.id },
  });

  await prisma.workshopRoleAssignment.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: actor.id } },
    create: { organizationId: organization.id, userId: actor.id, role: WorkshopWorkspaceRole.OWNER, active: true, assignedById: actor.id },
    update: { role: WorkshopWorkspaceRole.OWNER, active: true, assignedById: actor.id },
  });

  const warehouse = await prisma.workshopWarehouse.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'PILOT-WH' } },
    create: { organizationId: organization.id, code: 'PILOT-WH', name: 'Kho pilot CSSX', address: organization.address || '' },
    update: { name: 'Kho pilot CSSX', active: true },
  });
  await prisma.workshopWarehouseLocation.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: 'PILOT-RACK-A1' } },
    create: { organizationId: organization.id, warehouseId: warehouse.id, code: 'PILOT-RACK-A1', name: 'Kệ pilot A1', locationType: 'RACK' },
    update: { name: 'Kệ pilot A1', active: true },
  });

  const worker = await prisma.workshopWorker.findFirst({ where: { organizationId: organization.id, name: 'Thợ lắp đặt pilot' } })
    ?? await prisma.workshopWorker.create({ data: { organizationId: organization.id, name: 'Thợ lắp đặt pilot', roleName: 'Thợ lắp đặt', payType: 'DAILY', active: true } });
  const team = await prisma.workshopTeam.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'PILOT-INSTALL' } },
    create: { organizationId: organization.id, code: 'PILOT-INSTALL', name: 'Đội lắp đặt pilot', teamType: 'INSTALLATION' },
    update: { name: 'Đội lắp đặt pilot', teamType: 'INSTALLATION', active: true },
  });
  await prisma.workshopTeamMember.upsert({
    where: { teamId_workerId: { teamId: team.id, workerId: worker.id } },
    create: { teamId: team.id, workerId: worker.id, roleName: 'INSTALLER' },
    update: { roleName: 'INSTALLER', leftAt: null },
  });

  await prisma.workshopMachine.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'PILOT-CUT-01' } },
    create: { organizationId: organization.id, code: 'PILOT-CUT-01', name: 'Máy cắt hai đầu pilot', machineType: 'DOUBLE_HEAD_SAW', kerfMm: 4.5, minimumCutMm: 280, maximumStockMm: 6500, angleCapabilities: [45, 90], note: 'Dữ liệu pilot, không dùng để suy diễn công thức sản xuất.' },
    update: { active: true, kerfMm: 4.5, minimumCutMm: 280, maximumStockMm: 6500 },
  });
  await prisma.workshopSupplier.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'PILOT-SUP' } },
    create: { organizationId: organization.id, code: 'PILOT-SUP', name: 'Nhà cung cấp pilot', leadTimeDays: 2, deliveryNotes: 'Chỉ phục vụ kịch bản UAT.' },
    update: { name: 'Nhà cung cấp pilot', leadTimeDays: 2, status: 'ACTIVE' },
  });

  const project = await prisma.project.upsert({
    where: { code: 'PILOT-CT-001' },
    create: { code: 'PILOT-CT-001', name: 'Công trình pilot Workshop OS', organizationId: organization.id, ownerId: actor.id, customerName: 'Khách hàng pilot', customerPhone: '0900000000', address: 'Bình Tân, TP.HCM', status: 'IN_PROGRESS', startDate: new Date() },
    update: { name: 'Công trình pilot Workshop OS', organizationId: organization.id, ownerId: actor.id, address: 'Bình Tân, TP.HCM', status: 'IN_PROGRESS' },
  });
  const workOrder = await prisma.workshopWorkOrder.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'PILOT-WO-QC' } },
    create: { organizationId: organization.id, code: 'PILOT-WO-QC', type: WorkshopWorkOrderType.QC, status: WorkshopWorkOrderStatus.READY, title: 'Kiểm tra bộ cửa pilot', projectId: project.id, instructions: 'Thực hiện đủ checklist và chụp ảnh nếu FAIL/REWORK.', createdById: actor.id },
    update: { title: 'Kiểm tra bộ cửa pilot', projectId: project.id, status: WorkshopWorkOrderStatus.READY },
  });

  const qcTemplate = await prisma.workshopQcTemplate.upsert({
    where: { organizationId_code_version: { organizationId: organization.id, code: 'PILOT-QC', version: 1 } },
    create: {
      organizationId: organization.id, code: 'PILOT-QC', name: 'QC cửa hoàn thiện pilot', appliesTo: 'WORK_ORDER', version: 1,
      items: { create: [
        { checkKey: 'DIMENSION', label: 'Kích thước đúng hồ sơ', required: true, sortOrder: 0 },
        { checkKey: 'SURFACE', label: 'Bề mặt không trầy xước', required: true, sortOrder: 1 },
        { checkKey: 'OPERATION', label: 'Đóng mở vận hành ổn định', required: true, sortOrder: 2 },
      ] },
    },
    update: { name: 'QC cửa hoàn thiện pilot', active: true },
  });

  const scheduledStart = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const installation = await prisma.workshopInstallationJob.upsert({
    where: { organizationId_code: { organizationId: organization.id, code: 'PILOT-INSTALL-01' } },
    create: {
      organizationId: organization.id, code: 'PILOT-INSTALL-01', projectId: project.id, teamId: team.id, scheduledStart,
      status: WorkshopInstallationStatus.SCHEDULED, openingIds: ['PILOT-OPENING-01', 'PILOT-OPENING-02'],
      materialsChecklist: [{ label: 'Nhôm và phụ kiện', required: true, checked: false }, { label: 'Kính', required: true, checked: false }, { label: 'Vật tư lắp đặt', required: true, checked: false }],
      toolsChecklist: [{ label: 'Máy khoan', required: true, checked: false }, { label: 'Thước đo', required: true, checked: false }, { label: 'Dụng cụ bảo hộ', required: true, checked: false }],
      requiredQcTemplateId: qcTemplate.id, requiredPhotoCount: 2, requiresCustomerSignature: true, customerName: 'Khách hàng pilot', createdById: actor.id,
    },
    update: { projectId: project.id, teamId: team.id, requiredQcTemplateId: qcTemplate.id, requiredPhotoCount: 2, requiresCustomerSignature: true },
  });

  const asset = await prisma.workshopWarrantyAsset.upsert({
    where: { organizationId_assetCode: { organizationId: organization.id, assetCode: 'PILOT-WA-001' } },
    create: { organizationId: organization.id, assetCode: 'PILOT-WA-001', projectId: project.id, installationJobId: installation.id, installerTeamId: team.id, installedAt: new Date(), warrantyMonths: 24, expiresAt: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000), metadata: { pilot: true } },
    update: { projectId: project.id, installationJobId: installation.id, installerTeamId: team.id, status: 'ACTIVE' },
  });
  await prisma.workshopQrIdentity.upsert({
    where: { organizationId_entityType_entityId: { organizationId: organization.id, entityType: 'WARRANTY_ASSET', entityId: asset.id } },
    create: { organizationId: organization.id, publicId: '822002ba-4a9e-4721-ad5a-f8e45713a57e', entityType: 'WARRANTY_ASSET', entityId: asset.id, createdById: actor.id },
    update: { active: true },
  });

  console.log(JSON.stringify({ organization: organization.code, actor: actor.email, warehouse: warehouse.code, team: team.code, project: project.code, workOrder: workOrder.code, installation: installation.code, warrantyAsset: asset.assetCode }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
