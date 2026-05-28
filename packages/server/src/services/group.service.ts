import { Group, type IGroupDocument } from '../models/Group.js';
import { AppError } from '../utils/errors.js';
import type { CreateGroupInput, UpdateGroupInput } from '@opusheart/shared/schemas/group.schema.js';

export class GroupService {
  async create(data: CreateGroupInput, createdBy: string): Promise<IGroupDocument> {
    const group = await Group.create({
      ...data,
      createdBy,
      members: [{ userId: createdBy, role: 'leader', joinedAt: new Date() }],
    });
    return group;
  }

  async findById(id: string): Promise<IGroupDocument> {
    const group = await Group.findById(id);
    if (!group) throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
    return group;
  }

  async findAll(query: {
    type?: string;
    visibility?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{
    groups: IGroupDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = {};

    if (query.type) filter['type'] = query.type;
    if (query.visibility) filter['visibility'] = query.visibility;
    if (query.active !== undefined) filter['active'] = query.active;

    const [groups, total] = await Promise.all([
      Group.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
      Group.countDocuments(filter),
    ]);

    return { groups, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findPublicDirectory(query: {
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    groups: IGroupDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.findAll({ ...query, visibility: 'public', active: true });
  }

  async update(id: string, data: UpdateGroupInput): Promise<IGroupDocument> {
    const group = await Group.findById(id);
    if (!group) throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
    Object.assign(group, data);
    await group.save();
    return group;
  }

  async delete(id: string): Promise<void> {
    const group = await Group.findById(id);
    if (!group) throw new AppError('Group not found', 404, 'GROUP_NOT_FOUND');
    await group.deleteOne();
  }

  async join(groupId: string, userId: string): Promise<IGroupDocument> {
    const group = await this.findById(groupId);

    if (!group.active) {
      throw new AppError('Group is inactive', 400, 'GROUP_INACTIVE');
    }
    if (group.visibility === 'invite_only') {
      throw new AppError('Group is invite only', 403, 'INVITE_ONLY');
    }
    if (group.members.some(m => m.userId.toString() === userId)) {
      throw new AppError('Already a member', 409, 'ALREADY_MEMBER');
    }
    const effectiveMax = group.maxMembers ? Math.min(group.maxMembers, 1000) : 1000;
    if (group.members.length >= effectiveMax) {
      throw new AppError('Group is full', 409, 'GROUP_FULL');
    }

    group.members.push({ userId: userId as any, role: 'member', joinedAt: new Date() });
    await group.save();
    return group;
  }

  async leave(groupId: string, userId: string): Promise<IGroupDocument> {
    const group = await this.findById(groupId);

    const idx = group.members.findIndex(m => m.userId.toString() === userId);
    if (idx === -1) throw new AppError('Not a member', 404, 'NOT_MEMBER');

    group.members.splice(idx, 1);
    await group.save();
    return group;
  }

  async invite(groupId: string, userId: string): Promise<IGroupDocument> {
    const group = await this.findById(groupId);

    if (group.members.some(m => m.userId.toString() === userId)) {
      throw new AppError('Already a member', 409, 'ALREADY_MEMBER');
    }
    const effectiveMax = group.maxMembers ? Math.min(group.maxMembers, 1000) : 1000;
    if (group.members.length >= effectiveMax) {
      throw new AppError('Group is full', 409, 'GROUP_FULL');
    }

    group.members.push({ userId: userId as any, role: 'member', joinedAt: new Date() });
    await group.save();
    return group;
  }

  async promoteMember(groupId: string, userId: string): Promise<IGroupDocument> {
    const group = await this.findById(groupId);

    const member = group.members.find(m => m.userId.toString() === userId);
    if (!member) throw new AppError('Not a member', 404, 'NOT_MEMBER');

    member.role = 'leader';
    await group.save();
    return group;
  }

  async addMaterial(
    groupId: string,
    material: { title: string; type: 'document' | 'link' | 'video' | 'file'; url: string },
    uploadedBy: string,
  ): Promise<IGroupDocument> {
    const group = await this.findById(groupId);

    if (group.materials.length >= 500) {
      throw new AppError('Material limit reached for this group', 409, 'MATERIAL_LIMIT');
    }
    group.materials.push({
      ...material,
      uploadedBy: uploadedBy as any,
      uploadedAt: new Date(),
    });
    await group.save();
    return group;
  }

  async removeMaterial(groupId: string, materialId: string): Promise<IGroupDocument> {
    const group = await this.findById(groupId);

    const idx = group.materials.findIndex(m => (m as any)._id?.toString() === materialId);
    if (idx === -1) throw new AppError('Material not found', 404, 'MATERIAL_NOT_FOUND');

    group.materials.splice(idx, 1);
    await group.save();
    return group;
  }

  async findByUser(userId: string): Promise<IGroupDocument[]> {
    return Group.find({
      'members.userId': userId,
      active: true,
    }).sort({ name: 1 }).limit(100);
  }
}

export const groupService = new GroupService();
