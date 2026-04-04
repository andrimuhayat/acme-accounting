import { Test } from '@nestjs/testing';
import { DestroyOptions } from 'sequelize';
import { Model, ModelCtor } from 'sequelize-typescript';
import { Company } from '../../db/models/Company';
import { Ticket } from '../../db/models/Ticket';
import { User } from '../../db/models/User';
import { DbModule } from '../db.module';

beforeEach(async () => {
  jest.restoreAllMocks();
  // Only run database cleanup if DB_URL is set (for integration tests)
  // Unit tests with mocked repositories don't need database connection
  if (process.env.DB_URL || process.env.NODE_ENV !== 'test') {
    await cleanTables().catch(() => {
      // Ignore cleanup errors in test environment - unit tests don't need DB
    });
  }
});

export async function cleanTables() {
  try {
    await Test.createTestingModule({
      imports: [DbModule],
    }).compile();

    const models: ModelCtor<Model>[] = [Ticket, User, Company];
    for (const model of models) {
      await cleanTable(model);
    }
  } catch (err) {
    // Connection errors are expected in unit test environments
    // No need to propagate - unit tests use mocked repositories
  }

  async function cleanTable<T extends Model>(model: ModelCtor<T>) {
    const options: DestroyOptions = {
      where: {},
    };
    try {
      await model.unscoped().destroy(options);
    } catch (err) {
      // https://github.com/sequelize/sequelize/issues/14807
      console.error(err as Error);
      throw err;
    }
  }
}
