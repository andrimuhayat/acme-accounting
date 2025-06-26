'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Index for finding users by company and role (most common query)
    await queryInterface.addIndex('users', ['companyId', 'role'], {
      name: 'idx_users_company_role'
    });

    // Index for finding tickets by company and status (for strikeOff resolution)
    await queryInterface.addIndex('tickets', ['companyId', 'status'], {
      name: 'idx_tickets_company_status'
    });

    // Index for finding duplicate registrationAddressChange tickets
    await queryInterface.addIndex('tickets', ['companyId', 'type', 'status'], {
      name: 'idx_tickets_company_type_status'
    });

    // Index for user creation date ordering
    await queryInterface.addIndex('users', ['companyId', 'createdAt'], {
      name: 'idx_users_company_created'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('users', 'idx_users_company_role');
    await queryInterface.removeIndex('tickets', 'idx_tickets_company_status');
    await queryInterface.removeIndex('tickets', 'idx_tickets_company_type_status');
    await queryInterface.removeIndex('users', 'idx_users_company_created');
  }
};
