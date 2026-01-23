import { SetMetadata } from '@nestjs/common';

export const META_PERMISSIONS = 'permissions';

export const PermissionProtected = (...args: string[]) => {
  return SetMetadata(META_PERMISSIONS, args);
};
