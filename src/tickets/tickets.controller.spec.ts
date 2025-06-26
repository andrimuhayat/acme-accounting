import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';
import { DbModule } from '../db.module';
import { TicketsController } from './tickets.controller';

describe('TicketsController', () => {
  let controller: TicketsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      imports: [DbModule],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  it('should be defined', async () => {
    expect(controller).toBeDefined();

    const res = await controller.findAll();
    console.log(res);
  });

  describe('create', () => {
    describe('managementReport', () => {
      it('creates managementReport ticket', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.managementReport,
        });

        expect(ticket.category).toBe(TicketCategory.accounting);
        expect(ticket.assigneeId).toBe(user.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there are multiple accountants, assign the last one', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });
        const user2 = await User.create({
          name: 'Test User',
          role: UserRole.accountant,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.managementReport,
        });

        expect(ticket.category).toBe(TicketCategory.accounting);
        expect(ticket.assigneeId).toBe(user2.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there is no accountant, throw', async () => {
        const company = await Company.create({ name: 'test' });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.managementReport,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Cannot find user with role accountant to create a ticket`,
          ),
        );
      });
    });

    describe('registrationAddressChange', () => {
      it('creates registrationAddressChange ticket', async () => {
        const company = await Company.create({ name: 'test' });
        const user = await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        expect(ticket.category).toBe(TicketCategory.corporate);
        expect(ticket.assigneeId).toBe(user.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there are multiple secretaries, throw', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });
        await User.create({
          name: 'Test User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Multiple users with role corporateSecretary. Cannot create a ticket`,
          ),
        );
      });

      it('if there is no secretary, throw', async () => {
        const company = await Company.create({ name: 'test' });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Cannot find user with role corporateSecretary or director to create a ticket`,
          ),
        );
      });

      it('if there is no secretary but there is a director, assign to director', async () => {
        const company = await Company.create({ name: 'test' });
        const director = await User.create({
          name: 'Director User',
          role: UserRole.director,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        expect(ticket.category).toBe(TicketCategory.corporate);
        expect(ticket.assigneeId).toBe(director.id);
        expect(ticket.status).toBe(TicketStatus.open);
      });

      it('if there are multiple directors, throw error', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Director 1',
          role: UserRole.director,
          companyId: company.id,
        });
        await User.create({
          name: 'Director 2',
          role: UserRole.director,
          companyId: company.id,
        });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Multiple users with role director. Cannot create a ticket`,
          ),
        );
      });

      it('if duplicate registrationAddressChange ticket exists, throw error', async () => {
        const company = await Company.create({ name: 'test' });
        const secretary = await User.create({
          name: 'Secretary User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });

        // Create first ticket
        await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        // Try to create duplicate
        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ).rejects.toEqual(
          new ConflictException(
            'A registrationAddressChange ticket already exists for this company',
          ),
        );
      });
    });

    describe('strikeOff', () => {
      it('creates strikeOff ticket and assigns to director', async () => {
        const company = await Company.create({ name: 'test' });
        const director = await User.create({
          name: 'Director User',
          role: UserRole.director,
          companyId: company.id,
        });

        const ticket = await controller.create({
          companyId: company.id,
          type: TicketType.strikeOff,
        });

        expect(ticket.category).toBe(TicketCategory.management);
        expect(ticket.assigneeId).toBe(director.id);
        expect(ticket.status).toBe(TicketStatus.open);
        expect(ticket.type).toBe(TicketType.strikeOff);
      });

      it('if there are multiple directors, throw error', async () => {
        const company = await Company.create({ name: 'test' });
        await User.create({
          name: 'Director 1',
          role: UserRole.director,
          companyId: company.id,
        });
        await User.create({
          name: 'Director 2',
          role: UserRole.director,
          companyId: company.id,
        });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.strikeOff,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Multiple users with role director. Cannot create a ticket`,
          ),
        );
      });

      it('if there is no director, throw error', async () => {
        const company = await Company.create({ name: 'test' });

        await expect(
          controller.create({
            companyId: company.id,
            type: TicketType.strikeOff,
          }),
        ).rejects.toEqual(
          new ConflictException(
            `Cannot find user with role director to create a ticket`,
          ),
        );
      });

      it('resolves all other active tickets when creating strikeOff', async () => {
        const company = await Company.create({ name: 'test' });
        const accountant = await User.create({
          name: 'Accountant User',
          role: UserRole.accountant,
          companyId: company.id,
        });
        const secretary = await User.create({
          name: 'Secretary User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });
        const director = await User.create({
          name: 'Director User',
          role: UserRole.director,
          companyId: company.id,
        });

        // Create some active tickets
        const managementTicket = await controller.create({
          companyId: company.id,
          type: TicketType.managementReport,
        });
        const addressTicket = await controller.create({
          companyId: company.id,
          type: TicketType.registrationAddressChange,
        });

        // Create strikeOff ticket
        const strikeOffTicket = await controller.create({
          companyId: company.id,
          type: TicketType.strikeOff,
        });

        // Check that previous tickets are resolved
        const allTickets = await Ticket.findAll({
          where: { companyId: company.id },
        });

        const resolvedTickets = allTickets.filter(
          (t) => t.status === TicketStatus.resolved,
        );
        const openTickets = allTickets.filter(
          (t) => t.status === TicketStatus.open,
        );

        expect(resolvedTickets).toHaveLength(2);
        expect(openTickets).toHaveLength(1);
        expect(openTickets[0].type).toBe(TicketType.strikeOff);
      });
    });

    describe('performance optimizations', () => {
      it('should handle multiple ticket creations efficiently', async () => {
        const company = await Company.create({
          name: 'Performance Test Company',
        });

        // Create users for different roles
        const accountant = await User.create({
          name: 'Accountant User',
          role: UserRole.accountant,
          companyId: company.id,
        });
        const secretary = await User.create({
          name: 'Secretary User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });
        const director = await User.create({
          name: 'Director User',
          role: UserRole.director,
          companyId: company.id,
        });

        const startTime = Date.now();

        // Create multiple tickets to test performance
        const tickets = await Promise.all([
          controller.create({
            companyId: company.id,
            type: TicketType.managementReport,
          }),
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ]);

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        // Should complete reasonably fast (less than 1 second for integration test)
        expect(executionTime).toBeLessThan(1000);
        expect(tickets).toHaveLength(2);
        expect(tickets[0].type).toBe(TicketType.managementReport);
        expect(tickets[1].type).toBe(TicketType.registrationAddressChange);
      });

      it('should efficiently resolve multiple tickets with strikeOff', async () => {
        const company = await Company.create({
          name: 'StrikeOff Performance Test',
        });

        const accountant = await User.create({
          name: 'Accountant User',
          role: UserRole.accountant,
          companyId: company.id,
        });
        const secretary = await User.create({
          name: 'Secretary User',
          role: UserRole.corporateSecretary,
          companyId: company.id,
        });
        const director = await User.create({
          name: 'Director User',
          role: UserRole.director,
          companyId: company.id,
        });

        // Create multiple active tickets
        await Promise.all([
          controller.create({
            companyId: company.id,
            type: TicketType.managementReport,
          }),
          controller.create({
            companyId: company.id,
            type: TicketType.registrationAddressChange,
          }),
        ]);

        const startTime = Date.now();

        // Create strikeOff ticket (should resolve others efficiently)
        const strikeOffTicket = await controller.create({
          companyId: company.id,
          type: TicketType.strikeOff,
        });

        const endTime = Date.now();
        const executionTime = endTime - startTime;

        // Should complete efficiently using transaction
        expect(executionTime).toBeLessThan(500);
        expect(strikeOffTicket.type).toBe(TicketType.strikeOff);

        // Verify all other tickets are resolved
        const allTickets = await Ticket.findAll({
          where: { companyId: company.id },
        });

        const resolvedCount = allTickets.filter(
          (t) => t.status === TicketStatus.resolved,
        ).length;
        const openCount = allTickets.filter(
          (t) => t.status === TicketStatus.open,
        ).length;

        expect(resolvedCount).toBe(2);
        expect(openCount).toBe(1);
      });
    });
  });
});
