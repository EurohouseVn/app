import { SetMetadata } from '@nestjs/common';

export const MODULE_KEY = 'moduleKey';

/** Yêu cầu quyền truy cập module (RBAC nội bộ). CEO luôn được phép. */
export const RequireModule = (moduleKey: string) => SetMetadata(MODULE_KEY, moduleKey);

export const CEO_ONLY_KEY = 'ceoOnly';

/** Chỉ CEO mới được gọi (quản lý user, phòng ban, phân quyền). */
export const CeoOnly = () => SetMetadata(CEO_ONLY_KEY, true);
