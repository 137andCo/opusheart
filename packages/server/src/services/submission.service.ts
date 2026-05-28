import { ResourceSubmission, type IResourceSubmissionDocument } from '../models/ResourceSubmission.js';
import { Resource } from '../models/Resource.js';
import { AppError } from '../utils/errors.js';

interface SubmissionQuery {
  status?: string;
  page: number;
  limit: number;
}

interface SubmitterInfo {
  submitterName: string;
  submitterEmail: string;
  submittedBy?: string; // User ID if authenticated
}

interface PaginatedResult {
  data: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class SubmissionService {
  async submit(data: Record<string, unknown>, submitterInfo: SubmitterInfo): Promise<IResourceSubmissionDocument> {
    const docData: Record<string, unknown> = {
      ...data,
      submitterName: submitterInfo.submitterName,
      submitterEmail: submitterInfo.submitterEmail,
      status: 'pending',
    };

    if (submitterInfo.submittedBy) {
      docData['submittedBy'] = submitterInfo.submittedBy;
    }

    // Convert lat/lng to GeoJSON if location provided
    if (data['location']) {
      const loc = data['location'] as { lat: number; lng: number };
      docData['location'] = {
        type: 'Point',
        coordinates: [loc.lng, loc.lat],
      };
    }

    const submission = await ResourceSubmission.create(docData);
    return submission;
  }

  async findPending(): Promise<IResourceSubmissionDocument[]> {
    return ResourceSubmission.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(500)
      .exec();
  }

  async approve(id: string, reviewerId: string): Promise<IResourceSubmissionDocument> {
    const submission = await ResourceSubmission.findById(id);
    if (!submission) {
      throw new AppError('Submission not found', 404, 'SUBMISSION_NOT_FOUND');
    }
    if (submission.status !== 'pending') {
      throw new AppError('Submission already reviewed', 400, 'ALREADY_REVIEWED');
    }

    // Create a Resource from the submission
    const resourceData: Record<string, unknown> = {
      name: submission.name,
      description: submission.description,
      category: submission.category,
      subcategory: submission.subcategory,
      provider: submission.provider,
      eligibility: submission.eligibility,
      hours: submission.hours,
      phone: submission.phone,
      email: submission.email,
      website: submission.website,
      address: submission.address,
      languages: submission.languages,
      tags: submission.tags,
      approved: true,
      featured: false,
      lastVerified: new Date(),
      verifiedBy: reviewerId,
      submittedBy: reviewerId, // Attribute to reviewer since submitter may be anonymous
    };

    // Preserve GeoJSON location if present
    if (submission.location) {
      resourceData['location'] = submission.location;
    }

    await Resource.create(resourceData);

    // Update submission status
    submission.status = 'approved';
    submission.reviewedBy = reviewerId as any;
    submission.reviewedAt = new Date();
    await submission.save();

    return submission;
  }

  async reject(id: string, reviewerId: string, notes: string): Promise<IResourceSubmissionDocument> {
    const submission = await ResourceSubmission.findById(id);
    if (!submission) {
      throw new AppError('Submission not found', 404, 'SUBMISSION_NOT_FOUND');
    }
    if (submission.status !== 'pending') {
      throw new AppError('Submission already reviewed', 400, 'ALREADY_REVIEWED');
    }

    submission.status = 'rejected';
    submission.reviewedBy = reviewerId as any;
    submission.reviewedAt = new Date();
    submission.reviewNotes = notes;
    await submission.save();

    return submission;
  }

  async findAll(query: SubmissionQuery): Promise<PaginatedResult> {
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter['status'] = query.status;
    }

    const [data, total] = await Promise.all([
      ResourceSubmission.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .exec(),
      ResourceSubmission.countDocuments(filter),
    ]);

    return {
      data: data.map(s => s.toJSON()),
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }
}
