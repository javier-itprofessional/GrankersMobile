export const Q = {
  and: jest.fn((...args: unknown[]) => ({ $and: args })),
  where: jest.fn((col: string, val: unknown) => ({ $where: { col, val } })),
  eq: jest.fn((v: unknown) => ({ $eq: v })),
  lt: jest.fn((v: unknown) => ({ $lt: v })),
  notEq: jest.fn((v: unknown) => ({ $notEq: v })),
};

export class Model {
  id = 'mock-id';
}

export class Database {
  get = jest.fn();
  write = jest.fn();
}

export default Database;
