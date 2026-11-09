import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import {
  EUROHOUSE_FEATURE_KEYS,
  featureCapability,
  type EurohouseAccessView,
  type EurohouseFeatureKey,
  type EurohouseInviteView,
} from '@eurohouse/types';
import { PrismaService } from '../../prisma/prisma.service';

export type EurohouseAccessActor = {
  userId: string;
  role: string;
  organizationId?: string;
};

export const EUROHOUSE_ACCESS_OPTIONS = Symbol('EUROHOUSE_ACCESS_OPTIONS');
type EurohouseAccessOptions = { now?: () => Date; randomCode?: () => string };

function hashCode(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

@Injectable()
export class EurohouseAccessService {
  private readonly now: () => Date;
  private readonly randomCode: () => string;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(EUROHOUSE_ACCESS_OPTIONS) options?: EurohouseAccessOptions,
  ) {
    this.now = options?.now ?? (() => new Date());
    this.randomCode =
      options?.randomCode ?? (() => `EH-${randomBytes(15).toString('base64url').toUpperCase()}`);
  }

  async getCapability(organizationId: string | undefined, featureKey: EurohouseFeatureKey) {
    if (!organizationId) return featureCapability('LOCKED', featureKey);
    const grant = await this.prisma.eurohouseFeatureGrant.findUnique({
      where: { organizationId_featureKey: { organizationId, featureKey } },
    });
    const status =
      grant?.status === 'ACTIVE' ? 'ACTIVE' : grant?.status === 'REVOKED' ? 'REVOKED' : 'LOCKED';
    return featureCapability(status, featureKey);
  }

  async getAccessView(organizationId?: string): Promise<EurohouseAccessView> {
    const locked = {
      FORMULA_CUTTING: featureCapability('LOCKED', 'FORMULA_CUTTING'),
      EUROHOUSE_ORDERING: featureCapability('LOCKED', 'EUROHOUSE_ORDERING'),
    };
    if (!organizationId) return { organizationId: '', features: locked };
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { managedByNpp: true, eurohouseFeatureGrants: true },
    });
    if (!organization) return { organizationId, features: locked };
    const features = { ...locked };
    for (const grant of organization.eurohouseFeatureGrants) {
      features[grant.featureKey] = featureCapability(grant.status, grant.featureKey);
    }
    return {
      organizationId,
      nppOrganizationId: organization.managedByNppId ?? undefined,
      nppOrganizationName: organization.managedByNpp?.name ?? undefined,
      features,
    };
  }

  async createInvite(
    actor: EurohouseAccessActor,
    targetOrganizationId: string,
    featureKeys: readonly EurohouseFeatureKey[],
  ): Promise<{ invite: EurohouseInviteView; plainCode: string }> {
    const selectedFeatures = this.validateFeatureKeys(featureKeys);
    const nppOrganizationId = this.nppScope(actor);
    return this.prisma.$transaction(async (tx) => {
      const target = await this.requireVerifiedFactory(
        tx,
        await tx.organization.findUnique({ where: { id: targetOrganizationId } }),
      );
      if (target.managedByNppId && target.managedByNppId !== nppOrganizationId) {
        throw new BadRequestException('TRANSFER_REQUIRES_ADMIN');
      }
      const plainCode = this.randomCode();
      const now = this.now();
      const invite = await tx.eurohouseInvite.create({
        data: {
          codeHash: hashCode(plainCode),
          codePrefix: plainCode.slice(0, 5),
          codeLast4: plainCode.slice(-4),
          featureKeys: selectedFeatures,
          nppOrganizationId,
          targetOrganizationId,
          createdByUserId: actor.userId,
          status: 'ACTIVE',
          expiresAt: new Date(now.getTime() + 30 * 86_400_000),
        },
      });
      await tx.eurohouseAccessAudit.create({
        data: {
          organizationId: targetOrganizationId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          action: 'INVITE_CREATED',
          toNppOrganizationId: nppOrganizationId,
          eurohouseInviteId: invite.id,
          metadata: { featureKeys: selectedFeatures },
        },
      });
      return { invite: this.inviteView(invite), plainCode };
    });
  }

  async redeemInvite(
    actor: EurohouseAccessActor,
    plainCode: string,
  ): Promise<EurohouseAccessView> {
    if (!actor.organizationId) throw new ForbiddenException('FACTORY_ORGANIZATION_REQUIRED');
    await this.prisma.$transaction(async (tx) => {
      const invite = await tx.eurohouseInvite.findUnique({
        where: { codeHash: hashCode(plainCode) },
        include: { nppOrganization: true },
      });
      if (!invite) throw new BadRequestException('INVITE_INVALID');
      if (invite.status !== 'ACTIVE') {
        throw new BadRequestException(invite.status === 'USED' ? 'INVITE_USED' : 'INVITE_INVALID');
      }
      if (invite.expiresAt.getTime() <= this.now().getTime()) {
        throw new BadRequestException('INVITE_EXPIRED');
      }
      if (invite.targetOrganizationId !== actor.organizationId) {
        throw new BadRequestException('INVITE_TARGET_MISMATCH');
      }
      const target = await this.requireVerifiedFactory(
        tx,
        await tx.organization.findUnique({ where: { id: actor.organizationId } }),
      );
      if (target.managedByNppId && target.managedByNppId !== invite.nppOrganizationId) {
        throw new BadRequestException('TRANSFER_REQUIRES_ADMIN');
      }

      const claimed = await tx.eurohouseInvite.updateMany({
        where: { id: invite.id, status: 'ACTIVE' },
        data: { status: 'USED', usedAt: this.now(), usedByUserId: actor.userId },
      });
      if (claimed.count !== 1) throw new BadRequestException('INVITE_USED');

      await tx.organization.update({
        where: { id: actor.organizationId },
        data: { managedByNppId: invite.nppOrganizationId },
      });
      for (const featureKey of this.validateFeatureKeys(invite.featureKeys)) {
        await tx.eurohouseFeatureGrant.upsert({
          where: { organizationId_featureKey: { organizationId: actor.organizationId, featureKey } },
          create: {
            organizationId: actor.organizationId,
            featureKey,
            status: 'ACTIVE',
            nppOrganizationId: invite.nppOrganizationId,
            source: 'NPP_INVITE',
            activatedByUserId: actor.userId,
            activatedAt: this.now(),
          },
          update: {
            status: 'ACTIVE',
            nppOrganizationId: invite.nppOrganizationId,
            source: 'NPP_INVITE',
            activatedByUserId: actor.userId,
            activatedAt: this.now(),
            revokedByUserId: null,
            revokedAt: null,
            revokeReason: null,
          },
        });
      }
      await tx.eurohouseAccessAudit.create({
        data: {
          organizationId: actor.organizationId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          action: 'INVITE_REDEEMED',
          toNppOrganizationId: invite.nppOrganizationId,
          eurohouseInviteId: invite.id,
          metadata: { featureKeys: invite.featureKeys },
        },
      });
    });
    return this.getAccessView(actor.organizationId);
  }

  async activateFeature(
    actor: EurohouseAccessActor,
    targetOrganizationId: string,
    featureKey: EurohouseFeatureKey,
    requestedNppOrganizationId?: string,
  ): Promise<EurohouseAccessView> {
    this.validateFeatureKeys([featureKey]);
    await this.prisma.$transaction(async (tx) => {
      const target = await this.requireVerifiedFactory(
        tx,
        await tx.organization.findUnique({ where: { id: targetOrganizationId } }),
      );
      const internal = this.isInternalActor(actor);
      const nppOrganizationId = internal
        ? requestedNppOrganizationId ?? target.managedByNppId ?? undefined
        : this.nppScope(actor);
      await this.assertNppOrganization(tx, nppOrganizationId);
      if (target.managedByNppId && target.managedByNppId !== nppOrganizationId) {
        throw new BadRequestException('TRANSFER_REQUIRES_ADMIN');
      }
      await tx.organization.update({
        where: { id: targetOrganizationId },
        data: { managedByNppId: nppOrganizationId },
      });
      await tx.eurohouseFeatureGrant.upsert({
        where: { organizationId_featureKey: { organizationId: targetOrganizationId, featureKey } },
        create: {
          organizationId: targetOrganizationId,
          featureKey,
          status: 'ACTIVE',
          nppOrganizationId,
          source: internal ? 'ADMIN_DIRECT' : 'NPP_DIRECT',
          activatedByUserId: actor.userId,
          activatedAt: this.now(),
        },
        update: {
          status: 'ACTIVE',
          nppOrganizationId,
          source: internal ? 'ADMIN_DIRECT' : 'NPP_DIRECT',
          activatedByUserId: actor.userId,
          activatedAt: this.now(),
          revokedByUserId: null,
          revokedAt: null,
          revokeReason: null,
        },
      });
      await tx.eurohouseAccessAudit.create({
        data: {
          organizationId: targetOrganizationId,
          featureKey,
          actorUserId: actor.userId,
          actorRole: actor.role,
          action: 'DIRECT_ACTIVATED',
          toNppOrganizationId: nppOrganizationId,
        },
      });
    });
    return this.getAccessView(targetOrganizationId);
  }

  async revokeFeature(
    actor: EurohouseAccessActor,
    targetOrganizationId: string,
    featureKey: EurohouseFeatureKey,
    reason: string,
  ): Promise<EurohouseAccessView> {
    this.validateFeatureKeys([featureKey]);
    if (!reason.trim()) throw new BadRequestException('REVOKE_REASON_REQUIRED');
    await this.prisma.$transaction(async (tx) => {
      const target = await this.requireVerifiedFactory(
        tx,
        await tx.organization.findUnique({ where: { id: targetOrganizationId } }),
      );
      if (!this.isInternalActor(actor) && target.managedByNppId !== this.nppScope(actor)) {
        throw new ForbiddenException('EUROHOUSE_ACCESS_FORBIDDEN');
      }
      const grant = await tx.eurohouseFeatureGrant.findUnique({
        where: { organizationId_featureKey: { organizationId: targetOrganizationId, featureKey } },
      });
      if (!grant) throw new BadRequestException('FEATURE_NOT_ACTIVE');
      await tx.eurohouseFeatureGrant.update({
        where: { organizationId_featureKey: { organizationId: targetOrganizationId, featureKey } },
        data: {
          status: 'REVOKED',
          revokedByUserId: actor.userId,
          revokedAt: this.now(),
          revokeReason: reason.trim(),
        },
      });
      await tx.eurohouseAccessAudit.create({
        data: {
          organizationId: targetOrganizationId,
          featureKey,
          actorUserId: actor.userId,
          actorRole: actor.role,
          action: 'REVOKED',
          fromNppOrganizationId: target.managedByNppId,
          metadata: { reason: reason.trim() },
        },
      });
    });
    return this.getAccessView(targetOrganizationId);
  }

  async transferNpp(
    actor: EurohouseAccessActor,
    targetOrganizationId: string,
    nextNppOrganizationId: string,
    reason: string,
  ): Promise<EurohouseAccessView> {
    if (!this.isInternalActor(actor)) throw new ForbiddenException('ADMIN_REQUIRED');
    if (!reason.trim()) throw new BadRequestException('TRANSFER_REASON_REQUIRED');
    await this.prisma.$transaction(async (tx) => {
      const target = await this.requireVerifiedFactory(
        tx,
        await tx.organization.findUnique({ where: { id: targetOrganizationId } }),
      );
      await this.assertNppOrganization(tx, nextNppOrganizationId);
      await tx.organization.update({
        where: { id: targetOrganizationId },
        data: { managedByNppId: nextNppOrganizationId },
      });
      await tx.eurohouseFeatureGrant.updateMany({
        where: { organizationId: targetOrganizationId },
        data: { nppOrganizationId: nextNppOrganizationId },
      });
      await tx.eurohouseAccessAudit.create({
        data: {
          organizationId: targetOrganizationId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          action: 'NPP_TRANSFERRED',
          fromNppOrganizationId: target.managedByNppId,
          toNppOrganizationId: nextNppOrganizationId,
          metadata: { reason: reason.trim() },
        },
      });
    });
    return this.getAccessView(targetOrganizationId);
  }

  private validateFeatureKeys(featureKeys: readonly EurohouseFeatureKey[]) {
    if (!featureKeys.length) throw new BadRequestException('FEATURE_KEYS_REQUIRED');
    const valid = new Set<string>(EUROHOUSE_FEATURE_KEYS);
    if (featureKeys.some((key) => !valid.has(key))) {
      throw new BadRequestException('FEATURE_KEY_INVALID');
    }
    return Array.from(new Set(featureKeys));
  }

  private nppScope(actor: EurohouseAccessActor) {
    if (actor.role !== 'NPP' || !actor.organizationId) {
      throw new ForbiddenException('NPP_REQUIRED');
    }
    return actor.organizationId;
  }

  private isInternalActor(actor: EurohouseAccessActor) {
    return actor.role === 'ADMIN' || actor.role === 'STAFF';
  }

  private async assertNppOrganization(tx: any, organizationId?: string) {
    if (!organizationId) throw new BadRequestException('NPP_ORGANIZATION_REQUIRED');
    const organization = await tx.organization.findUnique({ where: { id: organizationId } });
    if (!organization || organization.type !== 'NPP') {
      throw new BadRequestException('NPP_ORGANIZATION_REQUIRED');
    }
  }

  private async requireVerifiedFactory(tx: any, target: any) {
    if (!target || target.type !== 'FACTORY') throw new BadRequestException('FACTORY_NOT_FOUND');
    const verifiedUser = await tx.user.findFirst({
      where: {
        organizationId: target.id,
        role: { in: ['FACTORY', 'DAILY'] },
        verifiedAt: { not: null },
      },
      select: { id: true },
    });
    if (!verifiedUser) throw new BadRequestException('FACTORY_NOT_VERIFIED');
    return target;
  }

  private inviteView(invite: any): EurohouseInviteView {
    return {
      id: invite.id,
      codePrefix: invite.codePrefix,
      codeLast4: invite.codeLast4,
      status: invite.status,
      featureKeys: invite.featureKeys,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
      targetOrganizationId: invite.targetOrganizationId,
    };
  }
}
