import { Resource, type IResourceDocument } from '../models/Resource.js';
import { AppError } from '../utils/errors.js';

interface ResourceQuery {
  category?: string;
  search?: string;
  language?: string;
  page: number;
  limit: number;
}

interface PaginatedResult {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface NearbyFilters {
  category?: string;
  page: number;
  limit: number;
}

export class ResourceService {
  async create(data: Record<string, unknown>, createdBy: string): Promise<IResourceDocument> {
    const docData: Record<string, unknown> = {
      ...data,
      submittedBy: createdBy,
      approved: true, // Admin/pastor create = auto-approved
      lastVerified: new Date(),
      verifiedBy: createdBy,
    };

    // Convert lat/lng to GeoJSON if location provided
    if (data['location']) {
      const loc = data['location'] as { lat: number; lng: number };
      docData['location'] = {
        type: 'Point',
        coordinates: [loc.lng, loc.lat],
      };
    }

    const resource = await Resource.create(docData);
    return resource;
  }

  async findById(id: string): Promise<IResourceDocument> {
    const resource = await Resource.findById(id);
    if (!resource) {
      throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    }
    return resource;
  }

  async findAll(query: ResourceQuery): Promise<PaginatedResult> {
    const filter: Record<string, unknown> = {};

    if (query.category) {
      filter['category'] = query.category;
    }
    if (query.language) {
      filter['languages'] = query.language;
    }
    if (query.search) {
      filter['$text'] = { $search: query.search };
    }

    const [data, total] = await Promise.all([
      Resource.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      Resource.countDocuments(filter),
    ]);

    return {
      data: data.map(r => r.toJSON()),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findPublic(query: ResourceQuery): Promise<PaginatedResult> {
    const filter: Record<string, unknown> = { approved: true };

    if (query.category) {
      filter['category'] = query.category;
    }
    if (query.language) {
      filter['languages'] = query.language;
    }
    if (query.search) {
      filter['$text'] = { $search: query.search };
    }

    const [data, total] = await Promise.all([
      Resource.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      Resource.countDocuments(filter),
    ]);

    return {
      data: data.map(r => r.toJSON()),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async update(id: string, data: Record<string, unknown>, updatedBy: string): Promise<IResourceDocument> {
    const resource = await Resource.findById(id);
    if (!resource) {
      throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    }

    // Convert lat/lng to GeoJSON if location provided
    if (data['location']) {
      const loc = data['location'] as { lat: number; lng: number };
      data['location'] = {
        type: 'Point',
        coordinates: [loc.lng, loc.lat],
      };
    }

    // Update lastVerified on any edit
    data['lastVerified'] = new Date();
    data['verifiedBy'] = updatedBy;

    Object.assign(resource, data);
    await resource.save();
    return resource;
  }

  async delete(id: string): Promise<void> {
    const resource = await Resource.findById(id);
    if (!resource) {
      throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    }
    await Resource.deleteOne({ _id: id });
  }

  async verify(id: string, verifiedBy: string): Promise<IResourceDocument> {
    const resource = await Resource.findById(id);
    if (!resource) {
      throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    }

    resource.lastVerified = new Date();
    resource.verifiedBy = verifiedBy as any;
    await resource.save();
    return resource;
  }

  async findStale(daysThreshold: number, limit = 100): Promise<IResourceDocument[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysThreshold);

    return Resource.find({
      approved: true,
      lastVerified: { $lt: cutoff },
    }).sort({ lastVerified: 1 }).limit(limit).exec();
  }

  async search(searchText: string, filters?: { category?: string; language?: string }, limit = 50): Promise<IResourceDocument[]> {
    const filter: Record<string, unknown> = {
      approved: true,
      $text: { $search: searchText },
    };

    if (filters?.category) {
      filter['category'] = filters.category;
    }
    if (filters?.language) {
      filter['languages'] = filters.language;
    }

    return Resource.find(filter).limit(limit).exec();
  }

  async findNearby(
    lat: number,
    lng: number,
    maxDistanceKm: number,
    filters?: NearbyFilters
  ): Promise<PaginatedResult> {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    const filter: Record<string, unknown> = {
      approved: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: maxDistanceKm * 1000, // Convert km to meters
        },
      },
    };

    if (filters?.category) {
      filter['category'] = filters.category;
    }

    // $near doesn't work with countDocuments, so we fetch all and count
    const data = await Resource.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    // For total count with $near, use a capped count to avoid loading entire collection
    const countFilter = { ...filter };
    const allMatches = await Resource.find(countFilter).select('_id').limit(1000).exec();
    const total = allMatches.length;

    return {
      data: data.map(r => r.toJSON()),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findFeatured(): Promise<IResourceDocument[]> {
    return Resource.find({ approved: true, featured: true })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
  }
}
