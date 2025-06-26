import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';

interface newTicketDto {
  type: TicketType;
  companyId: number;
}

interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

@Controller('api/v1/tickets')
export class TicketsController {
  @Get()
  async findAll() {
    return await Ticket.findAll({ include: [Company, User] });
  }

  @Post()
  async create(@Body() newTicketDto: newTicketDto) {
    const { type, companyId } = newTicketDto;

    // Determine category and required roles upfront
    let category: TicketCategory;
    let primaryRole: UserRole;
    let fallbackRole: UserRole | null = null;

    if (type === TicketType.managementReport) {
      category = TicketCategory.accounting;
      primaryRole = UserRole.accountant;
    } else if (type === TicketType.strikeOff) {
      category = TicketCategory.management;
      primaryRole = UserRole.director;
    } else {
      // registrationAddressChange
      category = TicketCategory.corporate;
      primaryRole = UserRole.corporateSecretary;
      fallbackRole = UserRole.director;
    }

    // OPTIMIZATION 1: Single query to get all needed data
    // Get users and existing tickets in one parallel execution
    const [users, existingTickets] = await Promise.all([
      // Get all relevant users for this company
      User.findAll({
        where: {
          companyId,
          role: fallbackRole ? [primaryRole, fallbackRole] : primaryRole,
        },
        order: [['createdAt', 'DESC']],
      }),
      // Get existing tickets only when needed
      type === TicketType.registrationAddressChange ||
      type === TicketType.strikeOff
        ? Ticket.findAll({
            where: {
              companyId,
              status: TicketStatus.open,
              ...(type === TicketType.registrationAddressChange && {
                type: TicketType.registrationAddressChange,
              }),
            },
          })
        : Promise.resolve([]),
    ]);

    // OPTIMIZATION 2: Process validation logic without additional queries
    // Check for duplicate registrationAddressChange tickets
    if (type === TicketType.registrationAddressChange) {
      const duplicateTicket = existingTickets.find(
        (ticket) => ticket.type === TicketType.registrationAddressChange,
      );
      if (duplicateTicket) {
        throw new ConflictException(
          'A registrationAddressChange ticket already exists for this company',
        );
      }
    }

    // Find assignees with the primary role
    let assignees = users.filter((user) => user.role === primaryRole);
    let selectedRole = primaryRole;

    // Special handling for registrationAddressChange - fallback to Director
    if (
      type === TicketType.registrationAddressChange &&
      !assignees.length &&
      fallbackRole
    ) {
      assignees = users.filter((user) => user.role === fallbackRole);
      selectedRole = fallbackRole;
    }

    // Check if we found any assignees
    if (!assignees.length) {
      const roleMessage =
        type === TicketType.registrationAddressChange
          ? 'corporateSecretary or director'
          : primaryRole;
      throw new ConflictException(
        `Cannot find user with role ${roleMessage} to create a ticket`,
      );
    }

    // Check for multiple users where not allowed
    if (
      (selectedRole === UserRole.corporateSecretary ||
        selectedRole === UserRole.director) &&
      assignees.length > 1
    ) {
      throw new ConflictException(
        `Multiple users with role ${selectedRole}. Cannot create a ticket`,
      );
    }

    const assignee = assignees[0];

    // OPTIMIZATION 3: Use transaction for strikeOff to ensure atomicity and performance
    if (type === TicketType.strikeOff) {
      // Resolve all other active tickets and create new ticket in a single transaction
      const ticket = await Ticket.sequelize!.transaction(
        async (transaction) => {
          // Resolve existing tickets
          if (existingTickets.length > 0) {
            await Ticket.update(
              { status: TicketStatus.resolved },
              {
                where: {
                  id: existingTickets.map((t) => t.id),
                },
                transaction,
              },
            );
          }

          // Create new ticket
          return await Ticket.create(
            {
              companyId,
              assigneeId: assignee.id,
              category,
              type,
              status: TicketStatus.open,
            },
            { transaction },
          );
        },
      );

      return this.buildTicketDto(ticket);
    }

    // For non-strikeOff tickets, simple create
    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });

    return this.buildTicketDto(ticket);
  }

  private buildTicketDto(ticket: Ticket): TicketDto {
    return {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };
  }
}
