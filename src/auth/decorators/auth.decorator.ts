import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { RoleProtected } from './role-protected.decorator';

import { UserRoleGuard } from '../guards/user-role.guard';
import { ValidRoles } from '../dto/valid-roles.interface';
import { PermissionProtected } from './permission-protected.decorator';
import { UserPermissionGuard } from '../guards/user-permission.guard';

export function Auth(...roles: ValidRoles[]) {
  return applyDecorators(
    RoleProtected(...roles),

    UseGuards(AuthGuard(), UserRoleGuard),
  );
}

export function AuthPermissions(...permissions: string[]) {
  return applyDecorators(
    PermissionProtected(...permissions),

    UseGuards(AuthGuard(), UserPermissionGuard),
  );
}
