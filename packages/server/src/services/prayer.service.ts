import { PrayerRequest, type IPrayerRequestDocument } from '../models/PrayerRequest.js';
import { PrayerResponse, type IPrayerResponseDocument } from '../models/PrayerResponse.js';
import { AppError } from '../utils/errors.js';
import type { CreatePrayerInput, UpdatePrayerInput } from '@opusheart/shared/schemas/prayer.schema.js';

export class PrayerService {
  async create(data: CreatePrayerInput, submittedBy: string): Promise<IPrayerRequestDocument> {
    const request = await PrayerRequest.create({ ...data, submittedBy });
    return request;
  }

  async findById(id: string): Promise<IPrayerRequestDocument> {
    const request = await PrayerRequest.findById(id);
    if (!request) throw new AppError('Prayer request not found', 404, 'PRAYER_NOT_FOUND');
    return request;
  }

  async findAll(query: {
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    prayerRequests: IPrayerRequestDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = {};

    if (query.category) filter['category'] = query.category;
    if (query.status) filter['status'] = query.status;

    const [prayerRequests, total] = await Promise.all([
      PrayerRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      PrayerRequest.countDocuments(filter),
    ]);

    return { prayerRequests, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findCongregation(query: {
    category?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    prayerRequests: Record<string, unknown>[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    // Public prayer wall: both 'congregation' and 'mesh' requests are meant to be
    // seen publicly. 'mesh' is intentionally federated across instances so people
    // anywhere can pray over the request — that is the point of the feature.
    const filter: Record<string, unknown> = {
      visibility: { $in: ['congregation', 'mesh'] },
      status: 'active',
    };

    if (query.category) filter['category'] = query.category;

    const [prayerRequests, total] = await Promise.all([
      PrayerRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      PrayerRequest.countDocuments(filter),
    ]);

    // Strip submittedBy from anonymous requests
    const sanitized = prayerRequests.map((pr) => {
      const json = pr.toJSON() as unknown as Record<string, unknown>;
      if (json['anonymous']) {
        delete json['submittedBy'];
      }
      return json;
    });

    return { prayerRequests: sanitized, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findForPastor(query: {
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    prayerRequests: IPrayerRequestDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.findAll(query);
  }

  async findMine(userId: string, query: {
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    prayerRequests: IPrayerRequestDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = { submittedBy: userId };

    if (query.category) filter['category'] = query.category;
    if (query.status) filter['status'] = query.status;

    const [prayerRequests, total] = await Promise.all([
      PrayerRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      PrayerRequest.countDocuments(filter),
    ]);

    return { prayerRequests, total, page, totalPages: Math.ceil(total / limit) };
  }

  async update(id: string, data: UpdatePrayerInput): Promise<IPrayerRequestDocument> {
    const request = await PrayerRequest.findById(id);
    if (!request) throw new AppError('Prayer request not found', 404, 'PRAYER_NOT_FOUND');
    Object.assign(request, data);
    await request.save();
    return request;
  }

  async delete(id: string): Promise<void> {
    const request = await PrayerRequest.findById(id);
    if (!request) throw new AppError('Prayer request not found', 404, 'PRAYER_NOT_FOUND');
    await request.deleteOne();
  }

  async pray(requestId: string, userId: string): Promise<IPrayerResponseDocument> {
    const request = await PrayerRequest.findById(requestId);
    if (!request) throw new AppError('Prayer request not found', 404, 'PRAYER_NOT_FOUND');

    const response = await PrayerResponse.create({
      prayerRequestId: requestId,
      userId,
      type: 'prayed',
    });

    await PrayerRequest.findByIdAndUpdate(requestId, { $inc: { prayerCount: 1 } });

    return response;
  }

  async respond(requestId: string, userId: string, message: string): Promise<IPrayerResponseDocument> {
    const request = await PrayerRequest.findById(requestId);
    if (!request) throw new AppError('Prayer request not found', 404, 'PRAYER_NOT_FOUND');

    const response = await PrayerResponse.create({
      prayerRequestId: requestId,
      userId,
      type: 'message',
      message,
    });

    return response;
  }

  async findResponses(requestId: string): Promise<IPrayerResponseDocument[]> {
    const request = await PrayerRequest.findById(requestId);
    if (!request) throw new AppError('Prayer request not found', 404, 'PRAYER_NOT_FOUND');

    return PrayerResponse.find({ prayerRequestId: requestId }).sort({ createdAt: -1 }).limit(200);
  }
}

export const prayerService = new PrayerService();
