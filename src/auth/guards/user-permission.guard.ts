import { Reflector } from '@nestjs/core';
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { Observable } from 'rxjs';
import { User } from 'src/users/entities/user.entity';
import { META_PERMISSIONS } from '../decorators/permission-protected.decorator';

@Injectable()
export class UserPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const validPermissions: string[] = this.reflector.get(
      META_PERMISSIONS,
      context.getHandler(),
    );

    if (!validPermissions) return true;
    if (validPermissions.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user as User;
    if (!user) throw new BadRequestException('Usuario no encontrado');

    if (user.rol.name == 'Administrador') return true;

    if (user.rol.status === false)
      throw new ForbiddenException(
        'Tu rol de usuario esta desactivado actualmente',
      );

    const hasPermission = validPermissions.some((validPermission) =>
      user.rol.permissions.includes(validPermission),
    );

    if (hasPermission) return true;

    throw new ForbiddenException(
      `User: ${user.name} no tiene los permisos necesarios`,
    );
  }
}
