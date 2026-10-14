import { ForbiddenException } from '@nestjs/common';

export type InventoryOwnerType = 'COMPANY_STOCK' | 'NPP_STOCK' | 'USER_STOCK' | 'WORKSHOP_STOCK';
export type InventoryMutationActor = { actorId: string; role: string; organizationId?: string };

export function assertInventoryMutationAllowed(
  actor: InventoryMutationActor,
  ownerType: InventoryOwnerType,
  ownerId: string,
) {
  if (ownerType === 'COMPANY_STOCK') {
    if (actor.role !== 'ADMIN' && actor.role !== 'STAFF') {
      throw new ForbiddenException('Only company administrators may mutate company stock.');
    }
    return;
  }
  if (ownerType === 'NPP_STOCK') {
    if (actor.role !== 'NPP' || !actor.organizationId || actor.organizationId !== ownerId) {
      throw new ForbiddenException('A distributor may mutate only its own inventory.');
    }
    return;
  }
  if (ownerType === 'USER_STOCK') {
    if (actor.actorId !== ownerId) throw new ForbiddenException('A user may mutate only its own inventory.');
    return;
  }
  if (ownerType === 'WORKSHOP_STOCK') {
    if (actor.role === 'ADMIN' || actor.role === 'STAFF') return;
    if (!actor.organizationId || actor.organizationId !== ownerId) {
      throw new ForbiddenException('A workshop user may mutate only its organization inventory.');
    }
    return;
  }
  throw new ForbiddenException('Unsupported inventory owner.');
}
