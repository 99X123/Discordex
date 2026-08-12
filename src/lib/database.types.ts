// Auto-generated Supabase database types
// Execute: npx supabase gen types typescript --project-id SEU_PROJETO_ID > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          status: 'online' | 'idle' | 'dnd' | 'offline';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          avatar_url?: string | null;
          bio?: string | null;
          status?: 'online' | 'idle' | 'dnd' | 'offline';
        };
        Update: {
          username?: string;
          display_name?: string;
          avatar_url?: string | null;
          bio?: string | null;
          status?: 'online' | 'idle' | 'dnd' | 'offline';
        };
        Relationships: [];
      };
      servers: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          icon_url: string | null;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          description?: string | null;
          icon_url?: string | null;
          owner_id: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          icon_url?: string | null;
          owner_id?: string;
        };
        Relationships: [];
      };
      server_members: {
        Row: {
          id: string;
          server_id: string;
          user_id: string;
          nickname: string | null;
          joined_at: string;
          timeout_until: string | null;
        };
        Insert: {
          server_id: string;
          user_id: string;
          nickname?: string | null;
        };
        Update: {
          nickname?: string | null;
          timeout_until?: string | null;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          server_id: string;
          name: string;
          color: string;
          position: number;
          permissions: number;
          created_at: string;
        };
        Insert: {
          server_id: string;
          name: string;
          color?: string;
          position?: number;
          permissions?: number;
        };
        Update: {
          name?: string;
          color?: string;
          position?: number;
          permissions?: number;
        };
        Relationships: [];
      };
      role_members: {
        Row: { role_id: string; user_id: string };
        Insert: { role_id: string; user_id: string };
        Update: never;
        Relationships: [];
      };
      channels: {
        Row: {
          id: string;
          server_id: string;
          name: string;
          type: 'text' | 'voice' | 'category';
          description: string | null;
          position: number;
          parent_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          server_id: string;
          name: string;
          type: 'text' | 'voice' | 'category';
          description?: string | null;
          position?: number;
          parent_id?: string | null;
        };
        Update: {
          name?: string;
          description?: string | null;
          position?: number;
          parent_id?: string | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          channel_id: string;
          author_id: string;
          content: string;
          reply_to: string | null;
          edited: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          channel_id: string;
          author_id: string;
          content: string;
          reply_to?: string | null;
        };
        Update: {
          content?: string;
          edited?: boolean;
        };
        Relationships: [];
      };
      message_reactions: {
        Row: {
          id: string;
          message_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          emoji: string;
        };
        Update: never;
        Relationships: [];
      };
      direct_message_channels: {
        Row: {
          id: string;
          user1_id: string;
          user2_id: string;
          created_at: string;
        };
        Insert: {
          user1_id: string;
          user2_id: string;
        };
        Update: never;
        Relationships: [];
      };
      direct_messages: {
        Row: {
          id: string;
          channel_id: string;
          author_id: string;
          content: string;
          reply_to: string | null;
          edited: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          channel_id: string;
          author_id: string;
          content: string;
          reply_to?: string | null;
        };
        Update: {
          content?: string;
          edited?: boolean;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          receiver_id: string;
          status: 'pending' | 'accepted' | 'declined' | 'blocked';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          requester_id: string;
          receiver_id: string;
          status?: 'pending' | 'accepted' | 'declined' | 'blocked';
        };
        Update: {
          status?: 'pending' | 'accepted' | 'declined' | 'blocked';
        };
        Relationships: [];
      };
      blocks: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: { blocker_id: string; blocked_id: string };
        Update: never;
        Relationships: [];
      };
      invites: {
        Row: {
          id: string;
          server_id: string;
          creator_id: string;
          code: string;
          max_uses: number | null;
          uses: number;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          server_id: string;
          creator_id: string;
          max_uses?: number | null;
          expires_at?: string | null;
        };
        Update: { uses?: number };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'mention' | 'dm' | 'friend_request' | 'invite' | 'system';
          reference_id: string | null;
          data: Json | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          type: 'mention' | 'dm' | 'friend_request' | 'invite' | 'system';
          reference_id?: string | null;
          data?: Json | null;
        };
        Update: { read?: boolean };
        Relationships: [];
      };
      voice_states: {
        Row: {
          id: string;
          channel_id: string;
          user_id: string;
          joined_at: string;
          muted: boolean;
          deafened: boolean;
          camera_enabled: boolean;
          screen_sharing: boolean;
        };
        Insert: {
          channel_id: string;
          user_id: string;
          muted?: boolean;
          deafened?: boolean;
          camera_enabled?: boolean;
          screen_sharing?: boolean;
        };
        Update: {
          muted?: boolean;
          deafened?: boolean;
          camera_enabled?: boolean;
          screen_sharing?: boolean;
        };
        Relationships: [];
      };
      server_bans: {
        Row: {
          id: string;
          server_id: string;
          user_id: string;
          banned_by: string | null;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          server_id: string;
          user_id: string;
          banned_by?: string | null;
          reason?: string | null;
        };
        Update: {
          banned_by?: string | null;
          reason?: string | null;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          id: string;
          user_id: string;
          bucket: string;
          window_start: string;
          request_count: number;
        };
        Insert: {
          user_id: string;
          bucket: string;
          window_start?: string;
          request_count?: number;
        };
        Update: {
          request_count?: number;
        };
        Relationships: [];
      };
      webrtc_signals: {
        Row: {
          id: string;
          channel_id: string;
          from_user: string;
          to_user: string;
          type: 'offer' | 'answer' | 'ice-candidate';
          payload: Json;
          created_at: string;
        };
        Insert: {
          channel_id: string;
          from_user: string;
          to_user: string;
          type: 'offer' | 'answer' | 'ice-candidate';
          payload: Json;
        };
        Update: never;
        Relationships: [];
      };
      app_admins: {
        Row: {
          user_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      user_has_permission: {
        Args: { p_user_id: string; p_server_id: string; p_permission: number };
        Returns: boolean;
      };
      create_server_with_defaults: {
        Args: { p_name: string; p_description?: string | null };
        Returns: string;
      };
      create_server_invite: {
        Args: { p_server_id: string; p_max_uses?: number | null };
        Returns: Json;
      };
      join_server_with_invite: {
        Args: { p_code: string };
        Returns: Json;
      };
      kick_member: {
        Args: { p_server_id: string; p_target_id: string };
        Returns: Json;
      };
      ban_member: {
        Args: { p_server_id: string; p_target_id: string; p_reason?: string | null };
        Returns: Json;
      };
      timeout_member: {
        Args: { p_server_id: string; p_target_id: string; p_minutes: number };
        Returns: Json;
      };
      get_or_create_dm_channel: {
        Args: { p_other_user: string };
        Returns: string;
      };
      is_app_admin: {
        Args: { p_user_id?: string };
        Returns: boolean;
      };
      list_registered_accounts: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          status: 'online' | 'idle' | 'dnd' | 'offline';
          created_at: string;
          updated_at: string;
          is_admin: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
