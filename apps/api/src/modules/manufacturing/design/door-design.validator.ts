import { BadRequestException, Injectable } from '@nestjs/common';
import { assertMaterialRole } from '../material-roles';
import type { CanonicalDoorDesignRevision } from './door-design.types';

export interface DoorDesignValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

@Injectable()
export class DoorDesignValidator {
  validate(design: CanonicalDoorDesignRevision): DoorDesignValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!design.id?.trim()) errors.push('Revision ID is required.');
    if (!design.designStableKey?.trim()) errors.push('Design stable key is required.');
    if (!Number.isInteger(design.revisionNumber) || design.revisionNumber < 1)
      errors.push('Revision number must be a positive integer.');
    if (!Number.isFinite(design.widthMm) || design.widthMm < 200 || design.widthMm > 20000)
      errors.push('Width must be between 200 and 20000 mm.');
    if (!Number.isFinite(design.heightMm) || design.heightMm < 200 || design.heightMm > 20000)
      errors.push('Height must be between 200 and 20000 mm.');
    if (!Number.isInteger(design.leafCount) || design.leafCount < 0 || design.leafCount > 20)
      errors.push('Leaf count must be an integer between 0 and 20.');

    const components = [
      ...design.openings,
      ...design.panels,
      ...design.members,
      ...design.connections,
      ...design.glazingPanels,
      ...design.hardwareIntent,
    ];
    const seen = new Set<string>();
    for (const component of components) {
      if (!component.id?.trim()) errors.push('Every component must have a stable ID.');
      else if (seen.has(component.id)) errors.push(`Duplicate component ID: ${component.id}.`);
      else seen.add(component.id);
    }

    const openingIds = new Set(design.openings.map((opening) => opening.id));
    const panelIds = new Set(design.panels.map((panel) => panel.id));
    for (const panel of design.panels) {
      if (panel.openingId && !openingIds.has(panel.openingId))
        errors.push(`Panel ${panel.id} references unknown opening ${panel.openingId}.`);
      if (panel.parentPanelId && !panelIds.has(panel.parentPanelId))
        errors.push(`Panel ${panel.id} references unknown parent ${panel.parentPanelId}.`);
      if (panel.parentPanelId === panel.id)
        errors.push(`Panel ${panel.id} cannot be its own parent.`);
    }
    for (const glazing of design.glazingPanels) {
      if (glazing.panelId && !panelIds.has(glazing.panelId))
        errors.push(`Glazing ${glazing.id} references unknown panel ${glazing.panelId}.`);
    }
    for (const connection of design.connections) {
      if (!seen.has(connection.fromComponentId))
        errors.push(
          `Connection ${connection.id} has unknown source ${connection.fromComponentId}.`,
        );
      if (!seen.has(connection.toComponentId))
        errors.push(`Connection ${connection.id} has unknown target ${connection.toComponentId}.`);
    }
    for (const member of design.members) {
      try {
        assertMaterialRole(member.role);
      } catch {
        errors.push(`Member ${member.id} uses unknown role ${member.role}.`);
      }
      if (!Number.isFinite(member.geometry.lengthMm) || member.geometry.lengthMm <= 0)
        errors.push(`Member ${member.id} must have a positive length.`);
    }
    for (const hardware of design.hardwareIntent) {
      try {
        assertMaterialRole(hardware.role);
      } catch {
        errors.push(`Hardware ${hardware.id} uses unknown role ${hardware.role}.`);
      }
      if (!Number.isFinite(hardware.quantity) || hardware.quantity <= 0)
        errors.push(`Hardware ${hardware.id} must have a positive quantity.`);
    }
    if (design.openings.length === 0) warnings.push('Design has no explicit opening topology.');
    if (design.panels.length === 0) warnings.push('Design has no panels.');
    return { valid: errors.length === 0, errors, warnings };
  }

  assertValid(design: CanonicalDoorDesignRevision): DoorDesignValidationResult {
    const result = this.validate(design);
    if (!result.valid)
      throw new BadRequestException({
        message: 'Invalid DoorDesign revision.',
        errors: result.errors,
      });
    return result;
  }
}
