import { Pool } from "pg";
import { Admin, IAdminsModel } from "../types/admins";

function toAdmin(row: any): Admin {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.password_hash,
    passwordExpiresAt: row.password_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresAdminsModel implements IAdminsModel {
  constructor(private pool: Pool) {}

  async create(input: { username: string, passwordHash: string, passwordExpiresAt: string | null }): Promise<Admin> {
    const now = new Date().toISOString();
    const { rows } = await this.pool.query(
      `INSERT INTO admins (id, username, password_hash, password_expires_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING *`,
      [crypto.randomUUID(), input.username, input.passwordHash, input.passwordExpiresAt, now]
    );
    return toAdmin(rows[0]);
  }

  async getByUsername(username: string): Promise<Admin | null> {
    const { rows } = await this.pool.query(`SELECT * FROM admins WHERE username = $1`, [username]);
    return rows[0] ? toAdmin(rows[0]) : null;
  }

  async list(): Promise<Array<Admin>> {
    const { rows } = await this.pool.query(`SELECT * FROM admins ORDER BY created_at`);
    return rows.map(toAdmin);
  }

  async updatePassword(username: string, input: { passwordHash: string, passwordExpiresAt: string | null }): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      `UPDATE admins SET password_hash = $2, password_expires_at = $3, updated_at = $4 WHERE username = $1`,
      [username, input.passwordHash, input.passwordExpiresAt, new Date().toISOString()]
    );
    return (rowCount ?? 0) > 0;
  }

  async delete(username: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(`DELETE FROM admins WHERE username = $1`, [username]);
    return (rowCount ?? 0) > 0;
  }
}
