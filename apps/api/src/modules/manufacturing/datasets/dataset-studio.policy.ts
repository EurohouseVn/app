import { ForbiddenException } from '@nestjs/common';
import type { JwtUser } from '../../../auth/current-user.decorator';

export function assertDatasetStudioActor(user: JwtUser | undefined): asserts user is JwtUser {
  if (!user || user.role !== 'ADMIN') {
    throw new ForbiddenException('Dataset Studio is restricted to Admin technical staff.');
  }
}

export function assertDatasetOwnership(user: JwtUser, ownerOrganizationId: string | null): void {
  assertDatasetStudioActor(user);
  if (user.isCeo) return;
  if ((user.organizationId ?? null) !== ownerOrganizationId) {
    throw new ForbiddenException('This dataset belongs to another organization.');
  }
}

export function datasetOwnerForCreate(user: JwtUser, requestedOwner?: string | null): string | null {
  assertDatasetStudioActor(user);
  if (user.isCeo) return requestedOwner ?? null;
  return user.organizationId ?? null;
}
