import { BadRequestException, ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { formulaCapabilityFromStatus, type FormulaAccessView, type FormulaInviteView } from '@eurohouse/types';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeIdentity } from '../../auth/identity-normalization';
import { EurohouseAccessService } from '../eurohouse-access/eurohouse-access.service';

export type FormulaAccessActor = {
  userId: string;
  role: string;
  organizationId?: string;
};

export const FORMULA_ACCESS_OPTIONS = Symbol('FORMULA_ACCESS_OPTIONS');
type FormulaAccessOptions = { now?: () => Date; randomCode?: () => string };

function codeHash(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

@Injectable()
export class FormulaAccessService {
  private readonly now: () => Date;
  private readonly randomCode: () => string;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(FORMULA_ACCESS_OPTIONS) options?: FormulaAccessOptions,
    @Optional() private readonly eurohouseAccess?: EurohouseAccessService,
  ) {
    this.now = options?.now ?? (() => new Date());
    this.randomCode = options?.randomCode ?? (() => `EH-${randomBytes(15).toString('base64url').toUpperCase()}`);
  }

  async getCapability(organizationId?: string) {
    if (this.eurohouseAccess) {
      const { featureKey: _featureKey, ...capability } = await this.eurohouseAccess.getCapability(
        organizationId,
        'FORMULA_CUTTING',
      );
      return capability;
    }
    if (!organizationId) return formulaCapabilityFromStatus('LOCKED');
    const grant = await this.prisma.formulaAccessGrant.findUnique({ where: { organizationId } });
    return formulaCapabilityFromStatus(grant?.status === 'ACTIVE' ? 'ACTIVE' : grant?.status === 'REVOKED' ? 'REVOKED' : 'LOCKED');
  }

  async getAccessView(organizationId?: string): Promise<FormulaAccessView> {
    if (this.eurohouseAccess) {
      return this.formulaView(await this.eurohouseAccess.getAccessView(organizationId));
    }
    if (!organizationId) return { organizationId: '', status: 'LOCKED', capability: formulaCapabilityFromStatus('LOCKED') };
    const grant = await this.prisma.formulaAccessGrant.findUnique({
      where: { organizationId },
      include: { nppOrganization: true, activatedBy: true },
    });
    if (!grant) return { organizationId, status: 'LOCKED', capability: formulaCapabilityFromStatus('LOCKED') };
    return this.accessView(grant);
  }

  async searchAccounts(actor: FormulaAccessActor, search: string) {
    const nppOrganizationId = this.nppScope(actor);
    let identity;
    try { identity = normalizeIdentity(search); } catch { throw new BadRequestException('INVALID_IDENTIFIER'); }
    const users = await this.prisma.user.findMany({
      where: {
        role: 'FACTORY',
        verifiedAt: { not: null },
        ...(identity.kind === 'EMAIL' ? { emailNormalized: identity.normalized } : { phoneNormalized: identity.normalized }),
      },
      include: { organization: { include: { formulaAccessGrant: true } } },
      take: 10,
    });
    return users
      .filter((user) => user.organization)
      .map((user) => ({
        organizationId: user.organization!.id,
        organizationName: user.organization!.name,
        province: user.organization!.province ?? undefined,
        email: user.email,
        phone: user.phoneNormalized ?? user.phone,
        relationship: user.organization!.managedByNppId === nppOrganizationId ? 'MANAGED' : user.organization!.managedByNppId ? 'OTHER_NPP' : 'UNASSIGNED',
        status: user.organization!.formulaAccessGrant?.status ?? 'LOCKED',
      }));
  }

  async listInvites(actor: FormulaAccessActor) {
    const nppOrganizationId = this.nppScope(actor);
    const rows = await this.prisma.formulaInvite.findMany({ where: { nppOrganizationId }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((row) => this.inviteView(row));
  }

  async adminList(filters: { status?: string; nppOrganizationId?: string }) {
    const organizations = await this.prisma.organization.findMany({
      where: {
        type: 'FACTORY',
        ...(filters.nppOrganizationId ? { managedByNppId: filters.nppOrganizationId } : {}),
      },
      include: {
        managedByNpp: true,
        formulaAccessGrant: { include: { nppOrganization: true, activatedBy: true, revokedBy: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return organizations
      .map((organization) => {
        const grant = organization.formulaAccessGrant;
        return {
          organizationId: organization.id,
          organizationName: organization.name,
          province: organization.province ?? undefined,
          status: grant?.status ?? 'LOCKED',
          nppOrganizationId: grant?.nppOrganizationId ?? organization.managedByNppId ?? undefined,
          nppOrganizationName: grant?.nppOrganization?.name ?? organization.managedByNpp?.name ?? undefined,
          source: grant?.source,
          activatedAt: grant?.activatedAt?.toISOString(),
          activatedByName: grant?.activatedBy?.displayName,
          revokedAt: grant?.revokedAt?.toISOString(),
          revokeReason: grant?.revokeReason ?? undefined,
          updatedAt: (grant?.updatedAt ?? organization.updatedAt).toISOString(),
        };
      })
      .filter((row) => !filters.status || row.status === filters.status);
  }

  audit(organizationId: string) {
    return this.prisma.formulaAccessAudit.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async createInvite(actor: FormulaAccessActor, targetOrganizationId: string) {
    if (this.eurohouseAccess) {
      return this.eurohouseAccess.createInvite(actor, targetOrganizationId, ['FORMULA_CUTTING']);
    }
    const nppOrganizationId = this.nppScope(actor);
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.organization.findUnique({ where: { id: targetOrganizationId } });
      this.assertFactory(target);
      if (target.managedByNppId && target.managedByNppId !== nppOrganizationId) {
        throw new BadRequestException('TRANSFER_REQUIRES_ADMIN');
      }
      const plainCode = this.randomCode();
      const now = this.now();
      const invite = await tx.formulaInvite.create({
        data: {
          codeHash: codeHash(plainCode),
          codePrefix: plainCode.slice(0, 5),
          codeLast4: plainCode.slice(-4),
          nppOrganizationId,
          targetOrganizationId,
          createdByUserId: actor.userId,
          status: 'ACTIVE',
          expiresAt: new Date(now.getTime() + 30 * 86_400_000),
        },
      });
      await tx.formulaAccessAudit.create({
        data: { organizationId: targetOrganizationId, actorUserId: actor.userId, actorRole: actor.role, action: 'INVITE_CREATED', toNppOrganizationId: nppOrganizationId, formulaInviteId: invite.id },
      });
      return { invite: this.inviteView(invite), plainCode };
    });
  }

  async redeemInvite(actor: FormulaAccessActor, plainCode: string): Promise<FormulaAccessView> {
    if (this.eurohouseAccess) {
      return this.formulaView(await this.eurohouseAccess.redeemInvite(actor, plainCode));
    }
    if (!actor.organizationId) throw new ForbiddenException('FACTORY_ORGANIZATION_REQUIRED');
    return this.prisma.$transaction(async (tx) => {
      const invite = await tx.formulaInvite.findUnique({ where: { codeHash: codeHash(plainCode) }, include: { nppOrganization: true } });
      if (!invite) throw new BadRequestException('INVITE_INVALID');
      if (invite.status !== 'ACTIVE') throw new BadRequestException(invite.status === 'USED' ? 'INVITE_USED' : 'INVITE_INVALID');
      if (invite.expiresAt.getTime() <= this.now().getTime()) throw new BadRequestException('INVITE_EXPIRED');
      if (invite.targetOrganizationId !== actor.organizationId) throw new BadRequestException('INVITE_TARGET_MISMATCH');
      const target = await tx.organization.findUnique({ where: { id: actor.organizationId } });
      this.assertFactory(target);
      if (target.managedByNppId && target.managedByNppId !== invite.nppOrganizationId) throw new BadRequestException('TRANSFER_REQUIRES_ADMIN');

      const claimed = await tx.formulaInvite.updateMany({
        where: { id: invite.id, status: 'ACTIVE' },
        data: { status: 'USED', usedAt: this.now(), usedByUserId: actor.userId },
      });
      if (claimed.count !== 1) throw new BadRequestException('INVITE_USED');
      await tx.organization.update({ where: { id: actor.organizationId }, data: { managedByNppId: invite.nppOrganizationId } });
      const grant = await tx.formulaAccessGrant.upsert({
        where: { organizationId: actor.organizationId },
        create: { organizationId: actor.organizationId, status: 'ACTIVE', nppOrganizationId: invite.nppOrganizationId, source: 'NPP_INVITE', activatedByUserId: actor.userId, activatedAt: this.now() },
        update: { status: 'ACTIVE', nppOrganizationId: invite.nppOrganizationId, source: 'NPP_INVITE', activatedByUserId: actor.userId, activatedAt: this.now(), revokedByUserId: null, revokedAt: null, revokeReason: null },
      });
      await tx.formulaAccessAudit.create({
        data: { organizationId: actor.organizationId, actorUserId: actor.userId, actorRole: actor.role, action: 'INVITE_REDEEMED', toNppOrganizationId: invite.nppOrganizationId, formulaInviteId: invite.id },
      });
      return this.accessView(grant, invite.nppOrganization?.name);
    });
  }

  async activateDirect(actor: FormulaAccessActor, targetOrganizationId: string, requestedNppOrganizationId?: string) {
    if (this.eurohouseAccess) {
      return this.formulaView(
        await this.eurohouseAccess.activateFeature(
          actor,
          targetOrganizationId,
          'FORMULA_CUTTING',
          requestedNppOrganizationId,
        ),
      );
    }
    const internalActor = this.isInternalActor(actor);
    const nppOrganizationId = internalActor ? requestedNppOrganizationId : this.nppScope(actor);
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.organization.findUnique({ where: { id: targetOrganizationId } });
      this.assertFactory(target);
      await this.assertNppOrganization(tx, nppOrganizationId);
      if (target.managedByNppId && target.managedByNppId !== nppOrganizationId) throw new BadRequestException('TRANSFER_REQUIRES_ADMIN');
      if (nppOrganizationId) await tx.organization.update({ where: { id: targetOrganizationId }, data: { managedByNppId: nppOrganizationId } });
      const grant = await tx.formulaAccessGrant.upsert({
        where: { organizationId: targetOrganizationId },
        create: { organizationId: targetOrganizationId, status: 'ACTIVE', nppOrganizationId, source: internalActor ? 'ADMIN_DIRECT' : 'NPP_DIRECT', activatedByUserId: actor.userId, activatedAt: this.now() },
        update: { status: 'ACTIVE', nppOrganizationId, source: internalActor ? 'ADMIN_DIRECT' : 'NPP_DIRECT', activatedByUserId: actor.userId, activatedAt: this.now(), revokedByUserId: null, revokedAt: null, revokeReason: null },
      });
      await tx.formulaAccessAudit.create({ data: { organizationId: targetOrganizationId, actorUserId: actor.userId, actorRole: actor.role, action: 'DIRECT_ACTIVATED', toNppOrganizationId: nppOrganizationId } });
      return this.accessView(grant);
    });
  }

  async revoke(actor: FormulaAccessActor, targetOrganizationId: string, reason: string) {
    if (this.eurohouseAccess) {
      return this.formulaView(
        await this.eurohouseAccess.revokeFeature(
          actor,
          targetOrganizationId,
          'FORMULA_CUTTING',
          reason,
        ),
      );
    }
    if (!reason.trim()) throw new BadRequestException('REVOKE_REASON_REQUIRED');
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.organization.findUnique({ where: { id: targetOrganizationId } });
      this.assertFactory(target);
      if (!this.isInternalActor(actor) && target.managedByNppId !== this.nppScope(actor)) throw new ForbiddenException('FORMULA_ACCESS_FORBIDDEN');
      const grant = await tx.formulaAccessGrant.update({ where: { organizationId: targetOrganizationId }, data: { status: 'REVOKED', revokedByUserId: actor.userId, revokedAt: this.now(), revokeReason: reason.trim() } });
      await tx.formulaInvite.updateMany({ where: { targetOrganizationId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: this.now() } });
      await tx.formulaAccessAudit.create({ data: { organizationId: targetOrganizationId, actorUserId: actor.userId, actorRole: actor.role, action: 'REVOKED', fromNppOrganizationId: target.managedByNppId, metadata: { reason: reason.trim() } } });
      return this.accessView(grant);
    });
  }

  async transferNpp(actor: FormulaAccessActor, targetOrganizationId: string, nextNppOrganizationId: string, reason: string) {
    if (this.eurohouseAccess) {
      return this.formulaView(
        await this.eurohouseAccess.transferNpp(
          actor,
          targetOrganizationId,
          nextNppOrganizationId,
          reason,
        ),
      );
    }
    if (!this.isInternalActor(actor)) throw new ForbiddenException('ADMIN_REQUIRED');
    if (!reason.trim()) throw new BadRequestException('TRANSFER_REASON_REQUIRED');
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.organization.findUnique({ where: { id: targetOrganizationId } });
      this.assertFactory(target);
      await this.assertNppOrganization(tx, nextNppOrganizationId);
      await tx.organization.update({ where: { id: targetOrganizationId }, data: { managedByNppId: nextNppOrganizationId } });
      const grant = await tx.formulaAccessGrant.upsert({
        where: { organizationId: targetOrganizationId },
        create: { organizationId: targetOrganizationId, status: 'ACTIVE', nppOrganizationId: nextNppOrganizationId, source: 'ADMIN_DIRECT', activatedByUserId: actor.userId, activatedAt: this.now() },
        update: { nppOrganizationId: nextNppOrganizationId },
      });
      await tx.formulaAccessAudit.create({ data: { organizationId: targetOrganizationId, actorUserId: actor.userId, actorRole: actor.role, action: 'NPP_TRANSFERRED', fromNppOrganizationId: target.managedByNppId, toNppOrganizationId: nextNppOrganizationId, metadata: { reason: reason.trim() } } });
      return this.accessView(grant);
    });
  }

  private nppScope(actor: FormulaAccessActor) {
    if (actor.role !== 'NPP' || !actor.organizationId) throw new ForbiddenException('NPP_REQUIRED');
    return actor.organizationId;
  }

  private isInternalActor(actor: FormulaAccessActor) {
    return actor.role === 'ADMIN' || actor.role === 'STAFF';
  }

  private async assertNppOrganization(tx: any, organizationId?: string) {
    if (!organizationId) return;
    const organization = await tx.organization.findUnique({ where: { id: organizationId } });
    if (!organization || organization.type !== 'NPP') throw new BadRequestException('NPP_ORGANIZATION_REQUIRED');
  }

  private assertFactory(target: any): asserts target {
    if (!target || target.type !== 'FACTORY') throw new BadRequestException('FACTORY_NOT_FOUND');
  }

  private inviteView(invite: any): FormulaInviteView {
    return { id: invite.id, codePrefix: invite.codePrefix, codeLast4: invite.codeLast4, status: invite.status, expiresAt: invite.expiresAt.toISOString(), createdAt: invite.createdAt.toISOString(), targetOrganizationId: invite.targetOrganizationId };
  }

  private accessView(grant: any, nppOrganizationName?: string): FormulaAccessView {
    const status = grant.status === 'ACTIVE' ? 'ACTIVE' : 'REVOKED';
    return { organizationId: grant.organizationId, status, capability: formulaCapabilityFromStatus(status), nppOrganizationId: grant.nppOrganizationId ?? undefined, nppOrganizationName: nppOrganizationName ?? grant.nppOrganization?.name, source: grant.source, activatedAt: grant.activatedAt?.toISOString(), activatedByName: grant.activatedBy?.displayName, revokedAt: grant.revokedAt?.toISOString(), revokeReason: grant.revokeReason ?? undefined };
  }

  private formulaView(view: Awaited<ReturnType<EurohouseAccessService['getAccessView']>>): FormulaAccessView {
    const capability = view.features.FORMULA_CUTTING;
    const { featureKey: _featureKey, ...legacyCapability } = capability;
    return {
      organizationId: view.organizationId,
      status: capability.status,
      capability: legacyCapability,
      nppOrganizationId: view.nppOrganizationId,
      nppOrganizationName: view.nppOrganizationName,
    };
  }
}
