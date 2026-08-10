import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateRoleDto {
  name: string;
  description?: string;
  permissions?: string[];
}

interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissions?: string[];
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createRoleDto: CreateRoleDto) {
    const exists = await this.prisma.role.findUnique({
      where: { name: createRoleDto.name },
    });
    if (exists) {
      throw new ConflictException('Tên chức danh này đã tồn tại.');
    }

    const permissionsJson = JSON.stringify(createRoleDto.permissions || []);
    const role = await this.prisma.role.create({
      data: {
        name: createRoleDto.name,
        description: createRoleDto.description,
        permissions: permissionsJson,
      },
    });

    return this.mapRole(role);
  }

  async findAll() {
    const roles = await this.prisma.role.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return roles.map(this.mapRoleWithCount);
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });
    if (!role) {
      throw new NotFoundException('Không tìm thấy chức danh.');
    }
    return this.mapRole(role);
  }

  async update(id: string, updateRoleDto: UpdateRoleDto) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Không tìm thấy chức danh.');
    }

    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const exists = await this.prisma.role.findUnique({
        where: { name: updateRoleDto.name },
      });
      if (exists) {
        throw new ConflictException('Tên chức danh này đã tồn tại.');
      }
    }

    let permissionsJson: string | undefined;
    if (updateRoleDto.permissions) {
      permissionsJson = JSON.stringify(updateRoleDto.permissions);
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        name: updateRoleDto.name,
        description: updateRoleDto.description,
        ...(permissionsJson !== undefined ? { permissions: permissionsJson } : {}),
      },
    });

    return this.mapRole(updated);
  }

  async remove(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) {
      throw new NotFoundException('Không tìm thấy chức danh.');
    }

    if (role._count.users > 0) {
      throw new ConflictException('Không thể xóa chức danh đang có nhân sự sử dụng.');
    }

    await this.prisma.role.delete({ where: { id } });
    return { success: true, message: 'Đã xóa chức danh.' };
  }

  private mapRole(role: any) {
    let perms = [];
    try {
      perms = JSON.parse(role.permissions || '[]');
    } catch {}
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions: perms,
      createdAt: role.createdAt,
    };
  }

  private mapRoleWithCount = (role: any) => {
    return {
      ...this.mapRole(role),
      userCount: role._count?.users || 0,
    };
  };
}
