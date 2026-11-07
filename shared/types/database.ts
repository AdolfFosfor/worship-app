/**
 * Supabase Database types (snake_case) — mirror of SQL migration.
 */
export type DbMemberRole = 'administrator' | 'worship_leader' | 'musician'

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface DbWorkspace {
  id: string
  name: string
  invite_code: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DbWorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: DbMemberRole
  display_name: string | null
  created_at: string
}

export interface DbSong {
  id: string
  workspace_id: string
  title: string
  key: string
  chords: string | null
  lyrics: string | null
  youtube_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DbSetlist {
  id: string
  workspace_id: string
  title: string
  service_date: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DbSetlistItem {
  id: string
  setlist_id: string
  song_id: string
  position: number
  key: string | null
}

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: DbWorkspace
        Insert: {
          id?: string
          name: string
          invite_code: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          invite_code?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: DbWorkspaceMember
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role: DbMemberRole
          display_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: DbMemberRole
          display_name?: string | null
          created_at?: string
        }
        Relationships: []
      }
      songs: {
        Row: DbSong
        Insert: {
          id?: string
          workspace_id: string
          title: string
          key?: string
          chords?: string | null
          lyrics?: string | null
          youtube_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          key?: string
          chords?: string | null
          lyrics?: string | null
          youtube_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      setlists: {
        Row: DbSetlist
        Insert: {
          id?: string
          workspace_id: string
          title: string
          service_date: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          title?: string
          service_date?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      setlist_items: {
        Row: DbSetlistItem
        Insert: {
          id?: string
          setlist_id: string
          song_id: string
          position: number
          key?: string | null
        }
        Update: {
          id?: string
          setlist_id?: string
          song_id?: string
          position?: number
          key?: string | null
        }
        Relationships: []
      }
      telegram_accounts: {
        Row: {
          telegram_id: number
          user_id: string
          created_at: string
        }
        Insert: {
          telegram_id: number
          user_id: string
          created_at?: string
        }
        Update: {
          telegram_id?: number
          user_id?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_workspace: {
        Args: {
          p_name: string
          p_display_name?: string | null
        }
        Returns: DbWorkspace
      }
      join_workspace_by_invite: {
        Args: {
          p_code: string
          p_display_name?: string | null
        }
        Returns: DbWorkspace
      }
    }
    Enums: {
      member_role: DbMemberRole
    }
    CompositeTypes: Record<string, never>
  }
}
