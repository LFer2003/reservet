import * as repository from './tables.repository.js';
import type { RestaurantTable, TableStatus } from './tables.repository.js';

export class TableValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TableValidationError';
  }
}

export async function listTables(): Promise<RestaurantTable[]> {
  return repository.findAll();
}

export async function createTable(name: unknown, capacity: unknown): Promise<RestaurantTable> {
  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new TableValidationError('El nombre es obligatorio');
  }

  if (name.trim().length > 80) {
    throw new TableValidationError('El nombre no puede superar 80 caracteres');
  }

  if (
    typeof capacity !== 'number' ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 20
  ) {
    throw new TableValidationError('La capacidad debe ser un entero entre 1 y 20');
  }

  return repository.create(name.trim(), capacity);
}

export async function changeTableStatus(
  id: unknown,
  status: unknown,
): Promise<RestaurantTable | null> {
  if (typeof id !== 'string' || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    throw new TableValidationError('El identificador debe ser un entero positivo');
  }

  const validStatuses: TableStatus[] = ['available', 'occupied', 'out_of_service'];

  if (typeof status !== 'string' || !validStatuses.includes(status as TableStatus)) {
    throw new TableValidationError('El estado no es válido');
  }

  // PostgreSQL integer no puede contener IDs mayores: son mesas inexistentes.
  if (Number(id) > 2147483647) return null;
  return repository.updateStatus(Number(id), status as TableStatus);
}
