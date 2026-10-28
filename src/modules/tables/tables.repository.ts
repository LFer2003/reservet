import { pool } from '../../shared/database.js';

export type TableStatus = 'available' | 'occupied' | 'out_of_service';

export interface RestaurantTable {
  id: number;
  name: string;
  capacity: number;
  status: TableStatus;
  created_at: Date;
}

interface TableRow {
  id: number;
  name: string;
  capacity: number;
  status: TableStatus;
  created_at: Date;
}

export async function findAll(): Promise<RestaurantTable[]> {
  const result = await pool.query<TableRow>(
    `SELECT id, name, capacity, status, created_at
     FROM restaurant_tables
     ORDER BY id`,
  );

  return result.rows;
}

export async function create(name: string, capacity: number): Promise<RestaurantTable> {
  const result = await pool.query<TableRow>(
    `INSERT INTO restaurant_tables (name, capacity)
     VALUES ($1, $2)
     RETURNING id, name, capacity, status, created_at`,
    [name, capacity],
  );

  return result.rows[0]!;
}

export async function updateStatus(
  id: number,
  status: TableStatus,
): Promise<RestaurantTable | null> {
  const result = await pool.query<TableRow>(
    `UPDATE restaurant_tables
     SET status = $1
     WHERE id = $2
     RETURNING id, name, capacity, status, created_at`,
    [status, id],
  );

  return result.rows[0] ?? null;
}
