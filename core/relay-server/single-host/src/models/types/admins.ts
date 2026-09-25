export type Admin = {
  id: string;
  username: string;
  passwordHash: string;
  passwordExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export interface IAdminsModel {
  create(input: { username: string, passwordHash: string, passwordExpiresAt: string | null }): Promise<Admin>;
  getByUsername(username: string): Promise<Admin | null>;
  list(): Promise<Array<Admin>>;
  updatePassword(username: string, input: { passwordHash: string, passwordExpiresAt: string | null }): Promise<boolean>;
  delete(username: string): Promise<boolean>;
}
