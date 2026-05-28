import { BookableResource, type IBookableResourceDocument } from '../models/BookableResource.js';
import { Booking, type IBookingDocument } from '../models/Booking.js';
import { AppError } from '../utils/errors.js';

export class BookingService {
  async createResource(data: {
    name: string;
    type: 'room' | 'vehicle' | 'equipment' | 'other';
    description?: string;
    capacity?: number;
  }): Promise<IBookableResourceDocument> {
    return BookableResource.create({ ...data, active: true });
  }

  async listResources(activeOnly = true): Promise<IBookableResourceDocument[]> {
    const filter: Record<string, unknown> = {};
    if (activeOnly) filter['active'] = true;
    return BookableResource.find(filter).sort({ name: 1 });
  }

  async updateResource(
    id: string,
    data: Partial<{ name: string; type: string; description: string; capacity: number; active: boolean }>
  ): Promise<IBookableResourceDocument> {
    const resource = await BookableResource.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!resource) throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    return resource;
  }

  async checkConflict(
    resourceId: string,
    startTime: Date,
    endTime: Date,
    excludeId?: string
  ): Promise<IBookingDocument | null> {
    const filter: Record<string, unknown> = {
      resource: resourceId,
      status: 'confirmed',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    };
    if (excludeId) filter['_id'] = { $ne: excludeId };
    return Booking.findOne(filter);
  }

  async createBooking(
    data: {
      resource: string;
      event?: string;
      title: string;
      startTime: Date;
      endTime: Date;
      notes?: string;
    },
    bookedBy: string
  ): Promise<IBookingDocument> {
    const resource = await BookableResource.findById(data.resource);
    if (!resource) throw new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    if (!resource.active) throw new AppError('Resource is not active', 400, 'RESOURCE_INACTIVE');

    const conflict = await this.checkConflict(data.resource, data.startTime, data.endTime);
    if (conflict) throw new AppError('Time slot conflicts with an existing booking', 409, 'BOOKING_CONFLICT');

    return Booking.create({ ...data, bookedBy, status: 'confirmed' });
  }

  async findBookings(query: {
    resource?: string;
    from?: Date;
    to?: Date;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    bookings: IBookingDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: Record<string, unknown> = {};

    if (query.resource) filter['resource'] = query.resource;
    if (query.status) filter['status'] = query.status;
    if (query.from) filter['startTime'] = { ...((filter['startTime'] as object) || {}), $gte: query.from };
    if (query.to) filter['startTime'] = { ...((filter['startTime'] as object) || {}), $lte: query.to };

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .populate('resource', 'name type')
        .sort({ startTime: 1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Booking.countDocuments(filter),
    ]);

    return { bookings, total, page, totalPages: Math.ceil(total / limit) };
  }

  async cancelBooking(id: string, userId: string, userRole: string): Promise<IBookingDocument> {
    const booking = await Booking.findById(id);
    if (!booking) throw new AppError('Booking not found', 404, 'BOOKING_NOT_FOUND');
    const isOwner = booking.bookedBy.toString() === userId;
    const isPrivileged = userRole === 'admin' || userRole === 'pastor';
    if (!isOwner && !isPrivileged) {
      throw new AppError('Only the booking owner or an admin can cancel', 403, 'FORBIDDEN');
    }
    booking.status = 'cancelled';
    await booking.save();
    return booking;
  }
}

export const bookingService = new BookingService();
