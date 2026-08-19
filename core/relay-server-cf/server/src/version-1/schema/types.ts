
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

export interface GameCoordinatorRow {
  id: string;
  name: string;
  success_webhook_url: string;
  failure_webhook_url: string | null;
  api_key_encrypted: string;
  api_key_preview: string;
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
  
  machine_ids: string;  // JSON string: ["machine1", "machine2"]
  machine_count: number;

  webhook_room_complete: string;
  webhhook_room_failed: string | null;

  created_at: string;
  finished_at: string | null;

  status: 'active' | 'completed' | 'failed';
  failed_reason: string | null;
  failed_machine: string | null;

}

// Helper type for parsed machine_ids
export interface RoomStatsWithMachines extends Omit<RoomStatsRow, 'machine_ids'> {
  machine_ids: string[];
}

// Machine statistics result
export interface MachineStats {
  machine_id: string;
  total_games: number;
  completed_games: number;
  failed_games: number;
  avg_messages: number;
  total_playtime_seconds: number;
}

