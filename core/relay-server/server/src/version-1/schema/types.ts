
// src/types.ts

export interface AdminRow {
  id: string;
  username: string;
  password_hash: string;
  password_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchmakerRow {
  id: string;
  name: string;
  public_key: string;
  registered_at: string;
  status: 'active' | 'suspended';
  updated_at: string;
}

export interface RoomStatsRow {
  room_id: string;
  matchmaker_id: string;

  full_config_hash: string;
  engine_id: string;
  engine_version: string;
  roster_hash: string;
  
  user_ids: string;  // JSON string: ["user1", "user2"]
  user_count: number;

  webhook_room_complete: string;
  webhhook_room_failed: string | null;

  created_at: string;
  finished_at: string | null;

  status: 'active' | 'completed' | 'failed';
  failed_reason: string | null;
  failed_user: string | null;

}

// Helper type for parsed user_ids
export interface RoomStatsWithUsers extends Omit<RoomStatsRow, 'user_ids'> {
  user_ids: string[];
}

// User statistics result
export interface UserStats {
  user_id: string;
  total_games: number;
  completed_games: number;
  failed_games: number;
  avg_messages: number;
  total_playtime_seconds: number;
}

