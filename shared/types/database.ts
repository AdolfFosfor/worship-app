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
  role_title: string | null
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface DbSong {
  id: string
  workspace_id: string
  title: string
  artist?: string | null
  key: string
  /** Capo fret; chords are shapes played with this capo. */
  capo: number
  /** Optional tempo in BPM (null/absent when unset). */
  bpm?: number | null
  types?: string[] | null
  themes?: string[] | null
  time_signature?: string | null
  /** Generated concert key. Present after migration 014. */
  sounding_key?: string | null
  chords: string | null
  chord_chart?: Json | null
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
          role_title?: string | null
          display_name?: string | null
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: DbMemberRole
          role_title?: string | null
          display_name?: string | null
          avatar_url?: string | null
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
          artist?: string | null
          key?: string
          capo?: number
          bpm?: number | null
          types?: string[]
          themes?: string[]
          time_signature?: string | null
          chords?: string | null
          chord_chart?: Json | null
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
          artist?: string | null
          key?: string
          capo?: number
          bpm?: number | null
          types?: string[]
          themes?: string[]
          time_signature?: string | null
          chords?: string | null
          chord_chart?: Json | null
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
      update_my_display_name: {
        Args: {
          p_name: string
        }
        Returns: string
      }
      repertoire_pulse_summary: {
        Args: {
          p_workspace_id: string
          p_from: string
          p_today: string
        }
        Returns: import('./repertoire').DbRepertoirePulseSummary
      }
      repertoire_pulse_songs: {
        Args: {
          p_workspace_id: string
          p_from: string
          p_today: string
        }
        Returns: import('./repertoire').DbRepertoireSongStat[]
      }
      repertoire_song_detail: {
        Args: {
          p_workspace_id: string
          p_song_id: string
          p_today: string
        }
        Returns: import('./repertoire').DbRepertoireSongDetail | null
      }
      song_activity_ids: {
        Args: {
          p_workspace_id: string
          p_kinds: string[]
          p_today: string
        }
        Returns: string[]
      }
      song_library_facets: {
        Args: {
          p_workspace_id: string
        }
        Returns: {
          themes: string[]
          timeSignatures: string[]
        }
      }
    }
    Enums: {
      member_role: DbMemberRole
    }
    CompositeTypes: Record<string, never>
  }
}
