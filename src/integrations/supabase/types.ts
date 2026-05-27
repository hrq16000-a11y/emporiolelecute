export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      access_request_notifications: {
        Row: {
          admin_count: number
          created_at: string
          details: Json
          error_message: string | null
          id: string
          requested_at: string | null
          requester_email: string | null
          requester_id: string | null
          sent_count: number
          status: string
        }
        Insert: {
          admin_count?: number
          created_at?: string
          details?: Json
          error_message?: string | null
          id?: string
          requested_at?: string | null
          requester_email?: string | null
          requester_id?: string | null
          sent_count?: number
          status?: string
        }
        Update: {
          admin_count?: number
          created_at?: string
          details?: Json
          error_message?: string | null
          id?: string
          requested_at?: string | null
          requester_email?: string | null
          requester_id?: string | null
          sent_count?: number
          status?: string
        }
        Relationships: []
      }
      admin_access_requests: {
        Row: {
          created_at: string
          id: string
          rejection_reason: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_email: string | null
          status: string
          updated_at: string
          user_email_snapshot: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          status?: string
          updated_at?: string
          user_email_snapshot?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rejection_reason?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          status?: string
          updated_at?: string
          user_email_snapshot?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_usage_aggregates: {
        Row: {
          client_ts: string
          id: string
          payload: Json
          received_at: string
          session_id: string
          total_events: number
          version: string
        }
        Insert: {
          client_ts: string
          id?: string
          payload: Json
          received_at?: string
          session_id: string
          total_events?: number
          version?: string
        }
        Update: {
          client_ts?: string
          id?: string
          payload?: Json
          received_at?: string
          session_id?: string
          total_events?: number
          version?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author: string | null
          authority_contribution: number
          content: string | null
          cover_image: string | null
          cover_image_alt: string | null
          created_at: string
          excerpt: string | null
          faqs: Json
          featured: boolean
          id: string
          is_indexed: boolean
          is_published: boolean
          meta_description: string | null
          meta_title: string | null
          position: number
          published_at: string | null
          reading_time: number | null
          related_categories: string[]
          related_occasions: string[]
          related_products: string[]
          related_segments: string[]
          related_tags: string[]
          related_themes: string[]
          slug: string
          title: string
          topical_score: number
          updated_at: string
        }
        Insert: {
          author?: string | null
          authority_contribution?: number
          content?: string | null
          cover_image?: string | null
          cover_image_alt?: string | null
          created_at?: string
          excerpt?: string | null
          faqs?: Json
          featured?: boolean
          id?: string
          is_indexed?: boolean
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          position?: number
          published_at?: string | null
          reading_time?: number | null
          related_categories?: string[]
          related_occasions?: string[]
          related_products?: string[]
          related_segments?: string[]
          related_tags?: string[]
          related_themes?: string[]
          slug: string
          title: string
          topical_score?: number
          updated_at?: string
        }
        Update: {
          author?: string | null
          authority_contribution?: number
          content?: string | null
          cover_image?: string | null
          cover_image_alt?: string | null
          created_at?: string
          excerpt?: string | null
          faqs?: Json
          featured?: boolean
          id?: string
          is_indexed?: boolean
          is_published?: boolean
          meta_description?: string | null
          meta_title?: string | null
          position?: number
          published_at?: string | null
          reading_time?: number | null
          related_categories?: string[]
          related_occasions?: string[]
          related_products?: string[]
          related_segments?: string[]
          related_tags?: string[]
          related_themes?: string[]
          slug?: string
          title?: string
          topical_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          description_seo: string | null
          external_ref: string
          faqs: Json
          h1_override: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_draft: boolean
          is_indexed: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          position: number
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_seo?: string | null
          external_ref: string
          faqs?: Json
          h1_override?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_draft?: boolean
          is_indexed?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          position?: number
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_seo?: string | null
          external_ref?: string
          faqs?: Json
          h1_override?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_draft?: boolean
          is_indexed?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      collection_products: {
        Row: {
          added_at: string
          collection_id: string
          position: number
          product_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          position?: number
          product_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          home_position: number
          id: string
          image_url: string | null
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          position: number
          show_on_home: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          home_position?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          position?: number
          show_on_home?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          home_position?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          position?: number
          show_on_home?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      combination_pages_registry: {
        Row: {
          auto_discovered: boolean
          cannibalization_risk: string
          canonical_path: string | null
          confidence_score: number
          created_at: string
          discovery_payload: Json
          discovery_status: string
          discovery_type: string | null
          editorial_content: string | null
          faqs: Json
          generated_slug: string | null
          has_custom_meta: boolean
          has_editorial: boolean
          has_faq: boolean
          id: string
          internal_links_count: number
          is_indexable: boolean
          last_authority_refresh: string | null
          last_evaluated_at: string | null
          meta_description: string | null
          meta_title: string | null
          path: string
          primary_slug: string
          primary_type: string
          product_count: number
          products_count: number
          quality_score: number
          readiness_score: number
          secondary_slug: string
          secondary_type: string
          seo_score: number
          thin_content_risk: boolean
          topical_coverage: number
          updated_at: string
        }
        Insert: {
          auto_discovered?: boolean
          cannibalization_risk?: string
          canonical_path?: string | null
          confidence_score?: number
          created_at?: string
          discovery_payload?: Json
          discovery_status?: string
          discovery_type?: string | null
          editorial_content?: string | null
          faqs?: Json
          generated_slug?: string | null
          has_custom_meta?: boolean
          has_editorial?: boolean
          has_faq?: boolean
          id?: string
          internal_links_count?: number
          is_indexable?: boolean
          last_authority_refresh?: string | null
          last_evaluated_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          path: string
          primary_slug: string
          primary_type: string
          product_count?: number
          products_count?: number
          quality_score?: number
          readiness_score?: number
          secondary_slug: string
          secondary_type: string
          seo_score?: number
          thin_content_risk?: boolean
          topical_coverage?: number
          updated_at?: string
        }
        Update: {
          auto_discovered?: boolean
          cannibalization_risk?: string
          canonical_path?: string | null
          confidence_score?: number
          created_at?: string
          discovery_payload?: Json
          discovery_status?: string
          discovery_type?: string | null
          editorial_content?: string | null
          faqs?: Json
          generated_slug?: string | null
          has_custom_meta?: boolean
          has_editorial?: boolean
          has_faq?: boolean
          id?: string
          internal_links_count?: number
          is_indexable?: boolean
          last_authority_refresh?: string | null
          last_evaluated_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          path?: string
          primary_slug?: string
          primary_type?: string
          product_count?: number
          products_count?: number
          quality_score?: number
          readiness_score?: number
          secondary_slug?: string
          secondary_type?: string
          seo_score?: number
          thin_content_risk?: boolean
          topical_coverage?: number
          updated_at?: string
        }
        Relationships: []
      }
      contact_migration_audit: {
        Row: {
          created_at: string
          id: string
          message: string | null
          performed_by: string | null
          performed_by_email: string | null
          source_id: string | null
          source_kind: string
          status: string
          target_customer_id: string | null
          target_email: string | null
          target_whatsapp: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          performed_by?: string | null
          performed_by_email?: string | null
          source_id?: string | null
          source_kind: string
          status: string
          target_customer_id?: string | null
          target_email?: string | null
          target_whatsapp?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          performed_by?: string | null
          performed_by_email?: string | null
          source_id?: string | null
          source_kind?: string
          status?: string
          target_customer_id?: string | null
          target_email?: string | null
          target_whatsapp?: string | null
        }
        Relationships: []
      }
      cookie_consent_config: {
        Row: {
          accept_label: string
          delay_ms: number
          id: string
          is_enabled: boolean
          message: string
          policy_label: string
          policy_url: string
          position: string
          reject_label: string
          show_icon: boolean
          title: string
          updated_at: string
          updated_by: string | null
          variant: string
        }
        Insert: {
          accept_label?: string
          delay_ms?: number
          id?: string
          is_enabled?: boolean
          message?: string
          policy_label?: string
          policy_url?: string
          position?: string
          reject_label?: string
          show_icon?: boolean
          title?: string
          updated_at?: string
          updated_by?: string | null
          variant?: string
        }
        Update: {
          accept_label?: string
          delay_ms?: number
          id?: string
          is_enabled?: boolean
          message?: string
          policy_label?: string
          policy_url?: string
          position?: string
          reject_label?: string
          show_icon?: boolean
          title?: string
          updated_at?: string
          updated_by?: string | null
          variant?: string
        }
        Relationships: []
      }
      cookie_consents: {
        Row: {
          accepted: boolean
          categories: Json
          created_at: string
          id: string
          ip: unknown
          user_agent: string | null
          visitor_id: string
        }
        Insert: {
          accepted: boolean
          categories?: Json
          created_at?: string
          id?: string
          ip?: unknown
          user_agent?: string | null
          visitor_id: string
        }
        Update: {
          accepted?: boolean
          categories?: Json
          created_at?: string
          id?: string
          ip?: unknown
          user_agent?: string | null
          visitor_id?: string
        }
        Relationships: []
      }
      coupon_uses: {
        Row: {
          coupon_id: string
          created_at: string
          discount_applied: number | null
          id: string
          order_id: string | null
          subtotal: number | null
        }
        Insert: {
          coupon_id: string
          created_at?: string
          discount_applied?: number | null
          id?: string
          order_id?: string | null
          subtotal?: number | null
        }
        Update: {
          coupon_id?: string
          created_at?: string
          discount_applied?: number | null
          id?: string
          order_id?: string | null
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_uses_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_uses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_uses: number | null
          min_subtotal: number
          updated_at: string
          used_count: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_subtotal?: number
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_subtotal?: number
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          source: string | null
          state: string | null
          status: string
          tags: string[] | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          state?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          source?: string | null
          state?: string | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          created_at: string
          email: string | null
          id: string
          internal_notes: string | null
          ip: string | null
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          status: string
          updated_at: string
          user_agent: string | null
          visitor_id: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          internal_notes?: string | null
          ip?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          visitor_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          internal_notes?: string | null
          ip?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
          visitor_id?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_visible: boolean | null
          position: number | null
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_visible?: boolean | null
          position?: number | null
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_visible?: boolean | null
          position?: number | null
          question?: string
          updated_at?: string
        }
        Relationships: []
      }
      hero_slides: {
        Row: {
          created_at: string
          cta_label: string | null
          cta_url: string | null
          display_mode: string
          id: string
          image_alt: string | null
          image_desktop_url: string | null
          image_mobile_url: string | null
          image_url: string | null
          is_visible: boolean
          position: number
          subtitle: string | null
          tagline: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          display_mode?: string
          id?: string
          image_alt?: string | null
          image_desktop_url?: string | null
          image_mobile_url?: string | null
          image_url?: string | null
          is_visible?: boolean
          position?: number
          subtitle?: string | null
          tagline?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          display_mode?: string
          id?: string
          image_alt?: string | null
          image_desktop_url?: string | null
          image_mobile_url?: string | null
          image_url?: string | null
          is_visible?: boolean
          position?: number
          subtitle?: string | null
          tagline?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      home_section_audit: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          section_key: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          section_key: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          section_key?: string
        }
        Relationships: []
      }
      home_sections: {
        Row: {
          component_name: string
          created_at: string
          description: string | null
          editable_props: Json
          id: string
          is_visible: boolean
          label: string
          position: number
          section_key: string
          updated_at: string
        }
        Insert: {
          component_name: string
          created_at?: string
          description?: string | null
          editable_props?: Json
          id?: string
          is_visible?: boolean
          label: string
          position?: number
          section_key: string
          updated_at?: string
        }
        Update: {
          component_name?: string
          created_at?: string
          description?: string | null
          editable_props?: Json
          id?: string
          is_visible?: boolean
          label?: string
          position?: number
          section_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      homepage_blocks: {
        Row: {
          block_key: string
          block_type: string
          content: Json | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_visible: boolean | null
          link_text: string | null
          link_url: string | null
          position: number | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          block_key: string
          block_type?: string
          content?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean | null
          link_text?: string | null
          link_url?: string | null
          position?: number | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          block_key?: string
          block_type?: string
          content?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean | null
          link_text?: string | null
          link_url?: string | null
          position?: number | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      instagram_embed_failures: {
        Row: {
          id: string
          ms_to_fallback: number | null
          occurred_at: string
          post_url: string | null
          route: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          ms_to_fallback?: number | null
          occurred_at?: string
          post_url?: string | null
          route?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          ms_to_fallback?: number | null
          occurred_at?: string
          post_url?: string | null
          route?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      instagram_feed_embeds: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          is_active: boolean
          position: number
          post_url: string
          preview_image_url: string | null
          updated_at: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          post_url: string
          preview_image_url?: string | null
          updated_at?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          post_url?: string
          preview_image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      instagram_post_attempts: {
        Row: {
          attempted_at: string
          error_message: string | null
          id: string
          image_url: string | null
          meta_used: string | null
          post_id: string
          source: string
          status: string
          title: string | null
        }
        Insert: {
          attempted_at?: string
          error_message?: string | null
          id?: string
          image_url?: string | null
          meta_used?: string | null
          post_id: string
          source?: string
          status: string
          title?: string | null
        }
        Update: {
          attempted_at?: string
          error_message?: string | null
          id?: string
          image_url?: string | null
          meta_used?: string | null
          post_id?: string
          source?: string
          status?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_post_attempts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "instagram_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_posts: {
        Row: {
          alt_text: string
          created_at: string
          extraction_error: string | null
          extraction_status: string
          id: string
          image_url: string
          is_visible: boolean
          last_extracted_at: string | null
          position: number
          post_url: string | null
          shortcode: string | null
          updated_at: string
        }
        Insert: {
          alt_text?: string
          created_at?: string
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          image_url: string
          is_visible?: boolean
          last_extracted_at?: string | null
          position?: number
          post_url?: string | null
          shortcode?: string | null
          updated_at?: string
        }
        Update: {
          alt_text?: string
          created_at?: string
          extraction_error?: string | null
          extraction_status?: string
          id?: string
          image_url?: string
          is_visible?: boolean
          last_extracted_at?: string | null
          position?: number
          post_url?: string | null
          shortcode?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      instagram_sync_history: {
        Row: {
          action: string
          details: Json
          error_message: string | null
          id: string
          ran_at: string
          selected_count: number | null
          source: string
          status: string
          synced_count: number
          triggered_by: string | null
        }
        Insert: {
          action?: string
          details?: Json
          error_message?: string | null
          id?: string
          ran_at?: string
          selected_count?: number | null
          source?: string
          status?: string
          synced_count?: number
          triggered_by?: string | null
        }
        Update: {
          action?: string
          details?: Json
          error_message?: string | null
          id?: string
          ran_at?: string
          selected_count?: number | null
          source?: string
          status?: string
          synced_count?: number
          triggered_by?: string | null
        }
        Relationships: []
      }
      kit_products: {
        Row: {
          created_at: string
          id: string
          kit_id: string
          position: number
          product_id: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          kit_id: string
          position?: number
          product_id: string
          quantity?: number
        }
        Update: {
          created_at?: string
          id?: string
          kit_id?: string
          position?: number
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "kit_products_kit_id_fkey"
            columns: ["kit_id"]
            isOneToOne: false
            referencedRelation: "kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kit_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      kits: {
        Row: {
          bundle_type: Database["public"]["Enums"]["kit_bundle_type"]
          created_at: string
          description: string | null
          estimated_savings: number | null
          external_ref: string
          home_position: number
          id: string
          image_url: string | null
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          position: number
          show_on_home: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          bundle_type?: Database["public"]["Enums"]["kit_bundle_type"]
          created_at?: string
          description?: string | null
          estimated_savings?: number | null
          external_ref: string
          home_position?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          position?: number
          show_on_home?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          bundle_type?: Database["public"]["Enums"]["kit_bundle_type"]
          created_at?: string
          description?: string | null
          estimated_savings?: number | null
          external_ref?: string
          home_position?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          position?: number
          show_on_home?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          created_at: string | null
          id: string
          is_external: boolean | null
          is_visible: boolean | null
          label: string
          menu_location: string
          page_id: string | null
          parent_id: string | null
          position: number | null
          url: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_external?: boolean | null
          is_visible?: boolean | null
          label: string
          menu_location: string
          page_id?: string | null
          parent_id?: string | null
          position?: number | null
          url?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_external?: boolean | null
          is_visible?: boolean | null
          label?: string
          menu_location?: string
          page_id?: string | null
          parent_id?: string | null
          position?: number | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      occasion_landings: {
        Row: {
          created_at: string
          faqs: Json
          gallery: Json
          h1: string
          hero_badge: string
          hero_subtitle: string
          id: string
          is_published: boolean
          occasion_slug: string
          og_image_alt: string | null
          og_image_url: string | null
          position: number
          related_route_slugs: string[]
          route_slug: string
          seo_copy: string
          seo_description: string
          seo_title: string
          social_proof_stats: Json
          testimonials: Json
          theme_accent: string
          updated_at: string
          whatsapp_message: string
        }
        Insert: {
          created_at?: string
          faqs?: Json
          gallery?: Json
          h1: string
          hero_badge: string
          hero_subtitle: string
          id?: string
          is_published?: boolean
          occasion_slug: string
          og_image_alt?: string | null
          og_image_url?: string | null
          position?: number
          related_route_slugs?: string[]
          route_slug: string
          seo_copy: string
          seo_description: string
          seo_title: string
          social_proof_stats?: Json
          testimonials?: Json
          theme_accent?: string
          updated_at?: string
          whatsapp_message: string
        }
        Update: {
          created_at?: string
          faqs?: Json
          gallery?: Json
          h1?: string
          hero_badge?: string
          hero_subtitle?: string
          id?: string
          is_published?: boolean
          occasion_slug?: string
          og_image_alt?: string | null
          og_image_url?: string | null
          position?: number
          related_route_slugs?: string[]
          route_slug?: string
          seo_copy?: string
          seo_description?: string
          seo_title?: string
          social_proof_stats?: Json
          testimonials?: Json
          theme_accent?: string
          updated_at?: string
          whatsapp_message?: string
        }
        Relationships: []
      }
      occasions: {
        Row: {
          created_at: string
          description: string | null
          description_seo: string | null
          external_ref: string
          faqs: Json
          h1_override: string | null
          id: string
          image_url: string | null
          is_draft: boolean
          is_indexed: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          position: number
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_seo?: string | null
          external_ref: string
          faqs?: Json
          h1_override?: string | null
          id?: string
          image_url?: string | null
          is_draft?: boolean
          is_indexed?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          position?: number
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_seo?: string | null
          external_ref?: string
          faqs?: Json
          h1_override?: string | null
          id?: string
          image_url?: string | null
          is_draft?: boolean
          is_indexed?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          personalization: string | null
          product_image: string | null
          product_name: string
          product_slug: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          personalization?: string | null
          product_image?: string | null
          product_name: string
          product_slug?: string | null
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          personalization?: string | null
          product_image?: string | null
          product_name?: string
          product_slug?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_cep: string
          address_city: string
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string
          address_street: string | null
          coupon_code: string | null
          created_at: string
          customer_email: string
          customer_name: string
          customer_phone: string
          discount_amount: number
          id: string
          notes: string | null
          order_code: string
          paid_at: string | null
          payment_id: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          shipped_at: string | null
          shipping_company: string | null
          shipping_days: string | null
          shipping_method: string
          shipping_price: number
          status: string
          subtotal: number
          total: number
          tracking_carrier: string | null
          tracking_code: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          address_cep: string
          address_city: string
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state: string
          address_street?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_email: string
          customer_name: string
          customer_phone: string
          discount_amount?: number
          id?: string
          notes?: string | null
          order_code: string
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipped_at?: string | null
          shipping_company?: string | null
          shipping_days?: string | null
          shipping_method: string
          shipping_price?: number
          status?: string
          subtotal: number
          total: number
          tracking_carrier?: string | null
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          address_cep?: string
          address_city?: string
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string
          address_street?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          discount_amount?: number
          id?: string
          notes?: string | null
          order_code?: string
          paid_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          shipped_at?: string | null
          shipping_company?: string | null
          shipping_days?: string | null
          shipping_method?: string
          shipping_price?: number
          status?: string
          subtotal?: number
          total?: number
          tracking_carrier?: string | null
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      page_versions: {
        Row: {
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          page_id: string | null
          seo_description: string | null
          seo_title: string | null
          version_number: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          page_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          version_number?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          page_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "page_versions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          internal_notes: string | null
          published_at: string | null
          seo_canonical: string | null
          seo_description: string | null
          seo_nofollow: boolean | null
          seo_noindex: boolean | null
          seo_title: string | null
          slug: string
          status: string | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          published_at?: string | null
          seo_canonical?: string | null
          seo_description?: string | null
          seo_nofollow?: boolean | null
          seo_noindex?: boolean | null
          seo_title?: string | null
          slug: string
          status?: string | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          published_at?: string | null
          seo_canonical?: string | null
          seo_description?: string | null
          seo_nofollow?: boolean | null
          seo_noindex?: boolean | null
          seo_title?: string | null
          slug?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      pdp_badge_events: {
        Row: {
          badge_label: string | null
          created_at: string
          event_name: string
          id: string
          position: string | null
          product_id: string | null
          product_slug: string | null
          session_id: string | null
          source: string
          tone: string | null
          user_agent: string | null
        }
        Insert: {
          badge_label?: string | null
          created_at?: string
          event_name: string
          id?: string
          position?: string | null
          product_id?: string | null
          product_slug?: string | null
          session_id?: string | null
          source?: string
          tone?: string | null
          user_agent?: string | null
        }
        Update: {
          badge_label?: string | null
          created_at?: string
          event_name?: string
          id?: string
          position?: string | null
          product_id?: string | null
          product_slug?: string | null
          session_id?: string | null
          source?: string
          tone?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdp_badge_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pdp_funnel_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          meta: Json | null
          personalized: boolean | null
          product_slug: string | null
          quantity: number | null
          session_id: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          meta?: Json | null
          personalized?: boolean | null
          product_slug?: string | null
          quantity?: number | null
          session_id?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          meta?: Json | null
          personalized?: boolean | null
          product_slug?: string | null
          quantity?: number | null
          session_id?: string | null
          source?: string | null
        }
        Relationships: []
      }
      pdp_section_audit: {
        Row: {
          action: string
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          section_key: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          section_key: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          section_key?: string
        }
        Relationships: []
      }
      pdp_sections: {
        Row: {
          created_at: string
          description: string | null
          editable_props: Json
          id: string
          is_visible: boolean
          label: string
          position: number
          section_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          editable_props?: Json
          id?: string
          is_visible?: boolean
          label: string
          position?: number
          section_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          editable_props?: Json
          id?: string
          is_visible?: boolean
          label?: string
          position?: number
          section_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_faqs: {
        Row: {
          answer: string
          created_at: string
          id: string
          is_active: boolean
          position: number
          product_id: string
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          product_id: string
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          is_active?: boolean
          position?: number
          product_id?: string
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_faqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_occasions: {
        Row: {
          occasion_id: string
          product_id: string
        }
        Insert: {
          occasion_id: string
          product_id: string
        }
        Update: {
          occasion_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_occasions_occasion_id_fkey"
            columns: ["occasion_id"]
            isOneToOne: false
            referencedRelation: "occasions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_occasions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          author_name: string
          comment: string | null
          created_at: string
          external_review_id: string | null
          id: string
          images: string[]
          is_featured: boolean
          is_verified: boolean
          is_visible: boolean
          position: number
          product_id: string
          rating: number
          review_date: string | null
          source: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          author_name: string
          comment?: string | null
          created_at?: string
          external_review_id?: string | null
          id?: string
          images?: string[]
          is_featured?: boolean
          is_verified?: boolean
          is_visible?: boolean
          position?: number
          product_id: string
          rating: number
          review_date?: string | null
          source?: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          author_name?: string
          comment?: string | null
          created_at?: string
          external_review_id?: string | null
          id?: string
          images?: string[]
          is_featured?: boolean
          is_verified?: boolean
          is_visible?: boolean
          position?: number
          product_id?: string
          rating?: number
          review_date?: string | null
          source?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_segments: {
        Row: {
          product_id: string
          segment_id: string
        }
        Insert: {
          product_id: string
          segment_id: string
        }
        Update: {
          product_id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_segments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_segments_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      product_slugs: {
        Row: {
          created_at: string
          hit_count: number
          id: string
          is_active: boolean
          is_primary: boolean
          last_hit_at: string | null
          product_id: string
          slug: string
          slug_normalized: string
          source: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hit_count?: number
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_hit_at?: string | null
          product_id: string
          slug: string
          slug_normalized: string
          source?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hit_count?: number
          id?: string
          is_active?: boolean
          is_primary?: boolean
          last_hit_at?: string | null
          product_id?: string
          slug?: string
          slug_normalized?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_slugs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          product_id: string
          tag_id: string
        }
        Insert: {
          product_id: string
          tag_id: string
        }
        Update: {
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge: string | null
          category_id: string | null
          created_at: string
          description: string | null
          editorial_content: string | null
          external_ref: string
          featured_weight: number
          features: string[] | null
          google_product_category: string | null
          height_cm: number | null
          id: string
          images: string[] | null
          is_active: boolean | null
          keywords: string[] | null
          length_cm: number | null
          long_description: string | null
          min_quantity: number | null
          name: string
          original_price: number | null
          pdp_badge_override: Json | null
          personalization_enabled: boolean | null
          personalization_label: string | null
          personalization_placeholder: string | null
          pix_discount: number | null
          price: number
          production_days: number | null
          production_speed: string | null
          rating: number | null
          requires_shipping: boolean
          search_text: string | null
          seo_noindex: boolean
          show_min_quantity: boolean
          show_quick_summary: boolean
          slug: string
          updated_at: string
          weight: number | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          badge?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          editorial_content?: string | null
          external_ref: string
          featured_weight?: number
          features?: string[] | null
          google_product_category?: string | null
          height_cm?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          keywords?: string[] | null
          length_cm?: number | null
          long_description?: string | null
          min_quantity?: number | null
          name: string
          original_price?: number | null
          pdp_badge_override?: Json | null
          personalization_enabled?: boolean | null
          personalization_label?: string | null
          personalization_placeholder?: string | null
          pix_discount?: number | null
          price: number
          production_days?: number | null
          production_speed?: string | null
          rating?: number | null
          requires_shipping?: boolean
          search_text?: string | null
          seo_noindex?: boolean
          show_min_quantity?: boolean
          show_quick_summary?: boolean
          slug: string
          updated_at?: string
          weight?: number | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          badge?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          editorial_content?: string | null
          external_ref?: string
          featured_weight?: number
          features?: string[] | null
          google_product_category?: string | null
          height_cm?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          keywords?: string[] | null
          length_cm?: number | null
          long_description?: string | null
          min_quantity?: number | null
          name?: string
          original_price?: number | null
          pdp_badge_override?: Json | null
          personalization_enabled?: boolean | null
          personalization_label?: string | null
          personalization_placeholder?: string | null
          pix_discount?: number | null
          price?: number
          production_days?: number | null
          production_speed?: string | null
          rating?: number | null
          requires_shipping?: boolean
          search_text?: string | null
          seo_noindex?: boolean
          show_min_quantity?: boolean
          show_quick_summary?: boolean
          slug?: string
          updated_at?: string
          weight?: number | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_change_audit: {
        Row: {
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          cep: string | null
          city: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          cep?: string | null
          city?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          cep?: string | null
          city?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      redirects: {
        Row: {
          created_at: string
          from_path: string
          hits: number
          id: string
          is_active: boolean
          notes: string | null
          status_code: number
          to_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_path: string
          hits?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          status_code?: number
          to_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_path?: string
          hits?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          status_code?: number
          to_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      reserved_slugs: {
        Row: {
          slug: string
        }
        Insert: {
          slug: string
        }
        Update: {
          slug?: string
        }
        Relationships: []
      }
      review_import_audit: {
        Row: {
          created_at: string
          elo7_buyer_name: string | null
          elo7_comment: string | null
          elo7_image_url: string | null
          elo7_product_name: string | null
          elo7_product_slug: string | null
          elo7_raw: Json
          elo7_review_date: string | null
          elo7_sentiment: string | null
          feedback_id: string
          id: string
          import_batch_id: string
          imported_review_id: string | null
          manual_product_id: string | null
          manual_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewed_by_email: string | null
          suggested_confidence: number | null
          suggested_method: string | null
          suggested_product_id: string | null
          suggested_product_name: string | null
          updated_at: string
          visual_notes: string | null
        }
        Insert: {
          created_at?: string
          elo7_buyer_name?: string | null
          elo7_comment?: string | null
          elo7_image_url?: string | null
          elo7_product_name?: string | null
          elo7_product_slug?: string | null
          elo7_raw?: Json
          elo7_review_date?: string | null
          elo7_sentiment?: string | null
          feedback_id: string
          id?: string
          import_batch_id: string
          imported_review_id?: string | null
          manual_product_id?: string | null
          manual_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          suggested_confidence?: number | null
          suggested_method?: string | null
          suggested_product_id?: string | null
          suggested_product_name?: string | null
          updated_at?: string
          visual_notes?: string | null
        }
        Update: {
          created_at?: string
          elo7_buyer_name?: string | null
          elo7_comment?: string | null
          elo7_image_url?: string | null
          elo7_product_name?: string | null
          elo7_product_slug?: string | null
          elo7_raw?: Json
          elo7_review_date?: string | null
          elo7_sentiment?: string | null
          feedback_id?: string
          id?: string
          import_batch_id?: string
          imported_review_id?: string | null
          manual_product_id?: string | null
          manual_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewed_by_email?: string | null
          suggested_confidence?: number | null
          suggested_method?: string | null
          suggested_product_id?: string | null
          suggested_product_name?: string | null
          updated_at?: string
          visual_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_import_audit_manual_product_id_fkey"
            columns: ["manual_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_import_audit_suggested_product_id_fkey"
            columns: ["suggested_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      role_promotion_audit: {
        Row: {
          created_at: string
          id: string
          message: string | null
          promoted_by: string | null
          promoted_by_email: string | null
          role: string
          status: string
          target_email: string
          target_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          promoted_by?: string | null
          promoted_by_email?: string | null
          role: string
          status: string
          target_email: string
          target_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          promoted_by?: string | null
          promoted_by_email?: string | null
          role?: string
          status?: string
          target_email?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      search_boosts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          product_id: string
          term: string
          term_normalized: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id: string
          term: string
          term_normalized: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          product_id?: string
          term?: string
          term_normalized?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "search_boosts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      search_query_log: {
        Row: {
          created_at: string
          id: string
          result_count: number
          suggestion: string | null
          term_normalized: string
          term_raw: string
        }
        Insert: {
          created_at?: string
          id?: string
          result_count?: number
          suggestion?: string | null
          term_normalized: string
          term_raw: string
        }
        Update: {
          created_at?: string
          id?: string
          result_count?: number
          suggestion?: string | null
          term_normalized?: string
          term_raw?: string
        }
        Relationships: []
      }
      search_synonyms: {
        Row: {
          active: boolean
          aliases: string[]
          boost_score: number
          canonical_term: string
          created_at: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          aliases?: string[]
          boost_score?: number
          canonical_term: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          aliases?: string[]
          boost_score?: number
          canonical_term?: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      segments: {
        Row: {
          created_at: string
          description: string | null
          description_seo: string | null
          faqs: Json
          h1_override: string | null
          id: string
          image_url: string | null
          is_draft: boolean
          is_indexed: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_seo?: string | null
          faqs?: Json
          h1_override?: string | null
          id?: string
          image_url?: string | null
          is_draft?: boolean
          is_indexed?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_seo?: string | null
          faqs?: Json
          h1_override?: string | null
          id?: string
          image_url?: string | null
          is_draft?: boolean
          is_indexed?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_adaptive_memory: {
        Row: {
          adaptation_velocity: number
          adaptive_score: number
          collapse_risk: number
          compounding_score: number
          created_at: string
          created_by: string | null
          dependency_risk: number
          detected_patterns: Json
          entity_id: string | null
          entity_type: string | null
          id: string
          intelligence_snapshot: Json
          memory_type: string
          recommendations: Json
          recovery_potential: number
          resilience_score: number
          saturation_score: number
          semantic_drift: number
          semantic_entropy: number
          strategic_pressure: number
          sustainability_score: number
          volatility_score: number
        }
        Insert: {
          adaptation_velocity?: number
          adaptive_score?: number
          collapse_risk?: number
          compounding_score?: number
          created_at?: string
          created_by?: string | null
          dependency_risk?: number
          detected_patterns?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          intelligence_snapshot?: Json
          memory_type: string
          recommendations?: Json
          recovery_potential?: number
          resilience_score?: number
          saturation_score?: number
          semantic_drift?: number
          semantic_entropy?: number
          strategic_pressure?: number
          sustainability_score?: number
          volatility_score?: number
        }
        Update: {
          adaptation_velocity?: number
          adaptive_score?: number
          collapse_risk?: number
          compounding_score?: number
          created_at?: string
          created_by?: string | null
          dependency_risk?: number
          detected_patterns?: Json
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          intelligence_snapshot?: Json
          memory_type?: string
          recommendations?: Json
          recovery_potential?: number
          resilience_score?: number
          saturation_score?: number
          semantic_drift?: number
          semantic_entropy?: number
          strategic_pressure?: number
          sustainability_score?: number
          volatility_score?: number
        }
        Relationships: []
      }
      seo_causality_registry: {
        Row: {
          affected_layers: Json | null
          causality_strength: number | null
          created_at: string
          description: string | null
          event_type: string | null
          id: string
          propagation_depth: number | null
          propagation_risk: number | null
          source_layer: string | null
        }
        Insert: {
          affected_layers?: Json | null
          causality_strength?: number | null
          created_at?: string
          description?: string | null
          event_type?: string | null
          id?: string
          propagation_depth?: number | null
          propagation_risk?: number | null
          source_layer?: string | null
        }
        Update: {
          affected_layers?: Json | null
          causality_strength?: number | null
          created_at?: string
          description?: string | null
          event_type?: string | null
          id?: string
          propagation_depth?: number | null
          propagation_risk?: number | null
          source_layer?: string | null
        }
        Relationships: []
      }
      seo_check_runs: {
        Row: {
          alert_error: string | null
          alert_sent: boolean
          checks: Json
          errors: number
          id: string
          passed: number
          ran_at: string
          source: string
          total: number
          warnings: number
        }
        Insert: {
          alert_error?: string | null
          alert_sent?: boolean
          checks?: Json
          errors?: number
          id?: string
          passed?: number
          ran_at?: string
          source?: string
          total?: number
          warnings?: number
        }
        Update: {
          alert_error?: string | null
          alert_sent?: boolean
          checks?: Json
          errors?: number
          id?: string
          passed?: number
          ran_at?: string
          source?: string
          total?: number
          warnings?: number
        }
        Relationships: []
      }
      seo_civilization_snapshots: {
        Row: {
          adaptive_evolution: number
          authority_distribution: number
          authority_legacy: number
          civilization_integrity: number
          civilization_score: number
          collapse_resistance: number
          continuity_depth: number
          created_at: string
          ecosystem_survivability: number
          entropy_absorption: number
          execution_sustainability: number
          existential_durability: number
          governance_stability: number
          id: string
          long_term_compounding: number
          notes: string | null
          operational_durability: number
          recovery_persistence: number
          semantic_coherence: number
          semantic_continuity: number
          semantic_stability: number
          strategic_longevity: number
          strategic_memory_strength: number
          systemic_harmony: number
          systemic_resilience: number
        }
        Insert: {
          adaptive_evolution?: number
          authority_distribution?: number
          authority_legacy?: number
          civilization_integrity?: number
          civilization_score?: number
          collapse_resistance?: number
          continuity_depth?: number
          created_at?: string
          ecosystem_survivability?: number
          entropy_absorption?: number
          execution_sustainability?: number
          existential_durability?: number
          governance_stability?: number
          id?: string
          long_term_compounding?: number
          notes?: string | null
          operational_durability?: number
          recovery_persistence?: number
          semantic_coherence?: number
          semantic_continuity?: number
          semantic_stability?: number
          strategic_longevity?: number
          strategic_memory_strength?: number
          systemic_harmony?: number
          systemic_resilience?: number
        }
        Update: {
          adaptive_evolution?: number
          authority_distribution?: number
          authority_legacy?: number
          civilization_integrity?: number
          civilization_score?: number
          collapse_resistance?: number
          continuity_depth?: number
          created_at?: string
          ecosystem_survivability?: number
          entropy_absorption?: number
          execution_sustainability?: number
          existential_durability?: number
          governance_stability?: number
          id?: string
          long_term_compounding?: number
          notes?: string | null
          operational_durability?: number
          recovery_persistence?: number
          semantic_coherence?: number
          semantic_continuity?: number
          semantic_stability?: number
          strategic_longevity?: number
          strategic_memory_strength?: number
          systemic_harmony?: number
          systemic_resilience?: number
        }
        Relationships: []
      }
      seo_cluster_memory: {
        Row: {
          avg_authority: number
          avg_conversion: number
          avg_readiness: number
          avg_roi: number
          cluster_key: string
          concentration_risk: number
          created_at: string
          decline_velocity: number
          growth_velocity: number
          id: string
          orphan_rate: number
          saturation_score: number
          snapshot_date: string
          total_entities: number
        }
        Insert: {
          avg_authority?: number
          avg_conversion?: number
          avg_readiness?: number
          avg_roi?: number
          cluster_key: string
          concentration_risk?: number
          created_at?: string
          decline_velocity?: number
          growth_velocity?: number
          id?: string
          orphan_rate?: number
          saturation_score?: number
          snapshot_date?: string
          total_entities?: number
        }
        Update: {
          avg_authority?: number
          avg_conversion?: number
          avg_readiness?: number
          avg_roi?: number
          cluster_key?: string
          concentration_risk?: number
          created_at?: string
          decline_velocity?: number
          growth_velocity?: number
          id?: string
          orphan_rate?: number
          saturation_score?: number
          snapshot_date?: string
          total_entities?: number
        }
        Relationships: []
      }
      seo_cognitive_snapshots: {
        Row: {
          authority_confusion_score: number
          authority_signal_clarity: number
          blockers: Json
          cognitive_decay_risk: number
          cognitive_load_score: number
          cognitive_resilience_score: number
          cognitive_stability_score: number
          created_at: string
          decision_confidence_score: number
          decision_conflict_score: number
          decision_consistency_score: number
          decision_latency_score: number
          decision_synthesis_score: number
          decision_traceability_score: number
          governance_confusion_score: number
          id: string
          notes: string | null
          operational_signal_clarity: number
          orchestration_alignment: number
          orchestration_efficiency: number
          orchestration_entropy: number
          orchestration_fragmentation: number
          orchestration_noise: number
          orchestration_scalability_score: number
          recommendations: Json
          semantic_confusion_score: number
          semantic_signal_clarity: number
          strategic_confusion_score: number
          strategic_signal_clarity: number
          strategic_survival_projection: number
          summary: Json
          systemic_reasoning_score: number
          warnings: Json
        }
        Insert: {
          authority_confusion_score?: number
          authority_signal_clarity?: number
          blockers?: Json
          cognitive_decay_risk?: number
          cognitive_load_score?: number
          cognitive_resilience_score?: number
          cognitive_stability_score?: number
          created_at?: string
          decision_confidence_score?: number
          decision_conflict_score?: number
          decision_consistency_score?: number
          decision_latency_score?: number
          decision_synthesis_score?: number
          decision_traceability_score?: number
          governance_confusion_score?: number
          id?: string
          notes?: string | null
          operational_signal_clarity?: number
          orchestration_alignment?: number
          orchestration_efficiency?: number
          orchestration_entropy?: number
          orchestration_fragmentation?: number
          orchestration_noise?: number
          orchestration_scalability_score?: number
          recommendations?: Json
          semantic_confusion_score?: number
          semantic_signal_clarity?: number
          strategic_confusion_score?: number
          strategic_signal_clarity?: number
          strategic_survival_projection?: number
          summary?: Json
          systemic_reasoning_score?: number
          warnings?: Json
        }
        Update: {
          authority_confusion_score?: number
          authority_signal_clarity?: number
          blockers?: Json
          cognitive_decay_risk?: number
          cognitive_load_score?: number
          cognitive_resilience_score?: number
          cognitive_stability_score?: number
          created_at?: string
          decision_confidence_score?: number
          decision_conflict_score?: number
          decision_consistency_score?: number
          decision_latency_score?: number
          decision_synthesis_score?: number
          decision_traceability_score?: number
          governance_confusion_score?: number
          id?: string
          notes?: string | null
          operational_signal_clarity?: number
          orchestration_alignment?: number
          orchestration_efficiency?: number
          orchestration_entropy?: number
          orchestration_fragmentation?: number
          orchestration_noise?: number
          orchestration_scalability_score?: number
          recommendations?: Json
          semantic_confusion_score?: number
          semantic_signal_clarity?: number
          strategic_confusion_score?: number
          strategic_signal_clarity?: number
          strategic_survival_projection?: number
          summary?: Json
          systemic_reasoning_score?: number
          warnings?: Json
        }
        Relationships: []
      }
      seo_coherence_conflicts: {
        Row: {
          coherence_loss: number | null
          conflict_type: string | null
          contradiction_depth: number | null
          created_at: string
          explanation: string | null
          id: string
          source_layer: string | null
          suggested_resolution: string | null
          systemic_impact: number | null
          target_layer: string | null
        }
        Insert: {
          coherence_loss?: number | null
          conflict_type?: string | null
          contradiction_depth?: number | null
          created_at?: string
          explanation?: string | null
          id?: string
          source_layer?: string | null
          suggested_resolution?: string | null
          systemic_impact?: number | null
          target_layer?: string | null
        }
        Update: {
          coherence_loss?: number | null
          conflict_type?: string | null
          contradiction_depth?: number | null
          created_at?: string
          explanation?: string | null
          id?: string
          source_layer?: string | null
          suggested_resolution?: string | null
          systemic_impact?: number | null
          target_layer?: string | null
        }
        Relationships: []
      }
      seo_coherence_matrix_snapshots: {
        Row: {
          alignment_matrix: Json | null
          cognitive_consistency_score: number | null
          cognitive_fragmentation_risk: number | null
          coherence_map: Json | null
          coherence_matrix_score: number | null
          continuity_coherence_graph: Json | null
          continuity_coherence_score: number | null
          created_at: string
          execution_coherence_score: number | null
          governance_alignment_score: number | null
          governance_dissonance_risk: number | null
          id: string
          notes: string | null
          operational_alignment_score: number | null
          operational_dispersion_risk: number | null
          operational_dissonance_map: Json | null
          resilience_alignment_map: Json | null
          resilience_coherence_score: number | null
          semantic_coherence_score: number | null
          semantic_divergence_risk: number | null
          semantic_flow_map: Json | null
          snapshot_type: string
          strategic_alignment_score: number | null
          strategic_misalignment_risk: number | null
          systemic_coherence_score: number | null
        }
        Insert: {
          alignment_matrix?: Json | null
          cognitive_consistency_score?: number | null
          cognitive_fragmentation_risk?: number | null
          coherence_map?: Json | null
          coherence_matrix_score?: number | null
          continuity_coherence_graph?: Json | null
          continuity_coherence_score?: number | null
          created_at?: string
          execution_coherence_score?: number | null
          governance_alignment_score?: number | null
          governance_dissonance_risk?: number | null
          id?: string
          notes?: string | null
          operational_alignment_score?: number | null
          operational_dispersion_risk?: number | null
          operational_dissonance_map?: Json | null
          resilience_alignment_map?: Json | null
          resilience_coherence_score?: number | null
          semantic_coherence_score?: number | null
          semantic_divergence_risk?: number | null
          semantic_flow_map?: Json | null
          snapshot_type?: string
          strategic_alignment_score?: number | null
          strategic_misalignment_risk?: number | null
          systemic_coherence_score?: number | null
        }
        Update: {
          alignment_matrix?: Json | null
          cognitive_consistency_score?: number | null
          cognitive_fragmentation_risk?: number | null
          coherence_map?: Json | null
          coherence_matrix_score?: number | null
          continuity_coherence_graph?: Json | null
          continuity_coherence_score?: number | null
          created_at?: string
          execution_coherence_score?: number | null
          governance_alignment_score?: number | null
          governance_dissonance_risk?: number | null
          id?: string
          notes?: string | null
          operational_alignment_score?: number | null
          operational_dispersion_risk?: number | null
          operational_dissonance_map?: Json | null
          resilience_alignment_map?: Json | null
          resilience_coherence_score?: number | null
          semantic_coherence_score?: number | null
          semantic_divergence_risk?: number | null
          semantic_flow_map?: Json | null
          snapshot_type?: string
          strategic_alignment_score?: number | null
          strategic_misalignment_risk?: number | null
          systemic_coherence_score?: number | null
        }
        Relationships: []
      }
      seo_consciousness_fabric_snapshots: {
        Row: {
          adaptive_maturity_score: number | null
          adaptive_regression_score: number | null
          cognitive_fragmentation_score: number | null
          cognitive_stability_score: number | null
          consciousness_verdict: string | null
          created_at: string
          dominant_instability: string | null
          dominant_pattern: string | null
          evolutionary_awareness_score: number | null
          executive_awareness_score: number | null
          executive_dissonance_score: number | null
          existential_stability_score: number | null
          id: string
          longitudinal_consistency_score: number | null
          notes: string | null
          operational_coherence_score: number | null
          strategic_confusion_score: number | null
          strategic_consciousness_score: number | null
          strategic_identity_score: number | null
          systemic_clarity_score: number | null
          systemic_instability_score: number | null
        }
        Insert: {
          adaptive_maturity_score?: number | null
          adaptive_regression_score?: number | null
          cognitive_fragmentation_score?: number | null
          cognitive_stability_score?: number | null
          consciousness_verdict?: string | null
          created_at?: string
          dominant_instability?: string | null
          dominant_pattern?: string | null
          evolutionary_awareness_score?: number | null
          executive_awareness_score?: number | null
          executive_dissonance_score?: number | null
          existential_stability_score?: number | null
          id?: string
          longitudinal_consistency_score?: number | null
          notes?: string | null
          operational_coherence_score?: number | null
          strategic_confusion_score?: number | null
          strategic_consciousness_score?: number | null
          strategic_identity_score?: number | null
          systemic_clarity_score?: number | null
          systemic_instability_score?: number | null
        }
        Update: {
          adaptive_maturity_score?: number | null
          adaptive_regression_score?: number | null
          cognitive_fragmentation_score?: number | null
          cognitive_stability_score?: number | null
          consciousness_verdict?: string | null
          created_at?: string
          dominant_instability?: string | null
          dominant_pattern?: string | null
          evolutionary_awareness_score?: number | null
          executive_awareness_score?: number | null
          executive_dissonance_score?: number | null
          existential_stability_score?: number | null
          id?: string
          longitudinal_consistency_score?: number | null
          notes?: string | null
          operational_coherence_score?: number | null
          strategic_confusion_score?: number | null
          strategic_consciousness_score?: number | null
          strategic_identity_score?: number | null
          systemic_clarity_score?: number | null
          systemic_instability_score?: number | null
        }
        Relationships: []
      }
      seo_consciousness_memory: {
        Row: {
          adaptive_consciousness: number
          awareness_score: number
          cognitive_fatigue: number
          cognitive_load: number
          collapse_awareness: number
          consciousness_snapshot: Json
          consciousness_type: string
          created_at: string
          created_by: string | null
          detected_signals: Json
          entity_scope: string | null
          entropy_pressure: number
          evolutionary_coherence: number
          executive_summary: Json
          id: string
          intelligence_density: number
          meta_intelligence_score: number
          operational_consciousness: number
          resilience_awareness: number
          semantic_alignment: number
          semantic_confusion: number
          semantic_consciousness: number
          strategic_awareness: number
          strategic_clarity: number
          systemic_coherence: number
          systemic_instability: number
        }
        Insert: {
          adaptive_consciousness?: number
          awareness_score?: number
          cognitive_fatigue?: number
          cognitive_load?: number
          collapse_awareness?: number
          consciousness_snapshot?: Json
          consciousness_type: string
          created_at?: string
          created_by?: string | null
          detected_signals?: Json
          entity_scope?: string | null
          entropy_pressure?: number
          evolutionary_coherence?: number
          executive_summary?: Json
          id?: string
          intelligence_density?: number
          meta_intelligence_score?: number
          operational_consciousness?: number
          resilience_awareness?: number
          semantic_alignment?: number
          semantic_confusion?: number
          semantic_consciousness?: number
          strategic_awareness?: number
          strategic_clarity?: number
          systemic_coherence?: number
          systemic_instability?: number
        }
        Update: {
          adaptive_consciousness?: number
          awareness_score?: number
          cognitive_fatigue?: number
          cognitive_load?: number
          collapse_awareness?: number
          consciousness_snapshot?: Json
          consciousness_type?: string
          created_at?: string
          created_by?: string | null
          detected_signals?: Json
          entity_scope?: string | null
          entropy_pressure?: number
          evolutionary_coherence?: number
          executive_summary?: Json
          id?: string
          intelligence_density?: number
          meta_intelligence_score?: number
          operational_consciousness?: number
          resilience_awareness?: number
          semantic_alignment?: number
          semantic_confusion?: number
          semantic_consciousness?: number
          strategic_awareness?: number
          strategic_clarity?: number
          systemic_coherence?: number
          systemic_instability?: number
        }
        Relationships: []
      }
      seo_consolidation_snapshots: {
        Row: {
          compression_score: number | null
          consolidation_confidence: number | null
          created_at: string
          created_by: string | null
          executive_clarity_score: number | null
          executive_signal_quality: number | null
          id: string
          notes: string | null
          observability_efficiency: number | null
          operational_noise_score: number | null
          payload: Json | null
          redundancy_score: number | null
          signal_noise_ratio: number | null
          strategic_focus_score: number | null
          systemic_complexity_score: number | null
          telemetry_entropy_score: number | null
        }
        Insert: {
          compression_score?: number | null
          consolidation_confidence?: number | null
          created_at?: string
          created_by?: string | null
          executive_clarity_score?: number | null
          executive_signal_quality?: number | null
          id?: string
          notes?: string | null
          observability_efficiency?: number | null
          operational_noise_score?: number | null
          payload?: Json | null
          redundancy_score?: number | null
          signal_noise_ratio?: number | null
          strategic_focus_score?: number | null
          systemic_complexity_score?: number | null
          telemetry_entropy_score?: number | null
        }
        Update: {
          compression_score?: number | null
          consolidation_confidence?: number | null
          created_at?: string
          created_by?: string | null
          executive_clarity_score?: number | null
          executive_signal_quality?: number | null
          id?: string
          notes?: string | null
          observability_efficiency?: number | null
          operational_noise_score?: number | null
          payload?: Json | null
          redundancy_score?: number | null
          signal_noise_ratio?: number | null
          strategic_focus_score?: number | null
          systemic_complexity_score?: number | null
          telemetry_entropy_score?: number | null
        }
        Relationships: []
      }
      seo_continuum_snapshots: {
        Row: {
          authority_continuity_score: number | null
          authority_fragmentation_score: number | null
          continuity_break_risk_score: number | null
          continuity_strength_score: number | null
          continuum_verdict: string | null
          created_at: string
          dominant_continuity_signal: string | null
          dominant_decay_signal: string | null
          entropy_accumulation_score: number | null
          entropy_resistance_score: number | null
          execution_continuity_score: number | null
          execution_decay_score: number | null
          id: string
          notes: string | null
          operational_persistence_score: number | null
          resilience_continuity_score: number | null
          semantic_continuity_score: number | null
          semantic_instability_score: number | null
          strategic_continuum_score: number | null
          strategic_longevity_score: number | null
          systemic_persistence_score: number | null
        }
        Insert: {
          authority_continuity_score?: number | null
          authority_fragmentation_score?: number | null
          continuity_break_risk_score?: number | null
          continuity_strength_score?: number | null
          continuum_verdict?: string | null
          created_at?: string
          dominant_continuity_signal?: string | null
          dominant_decay_signal?: string | null
          entropy_accumulation_score?: number | null
          entropy_resistance_score?: number | null
          execution_continuity_score?: number | null
          execution_decay_score?: number | null
          id?: string
          notes?: string | null
          operational_persistence_score?: number | null
          resilience_continuity_score?: number | null
          semantic_continuity_score?: number | null
          semantic_instability_score?: number | null
          strategic_continuum_score?: number | null
          strategic_longevity_score?: number | null
          systemic_persistence_score?: number | null
        }
        Update: {
          authority_continuity_score?: number | null
          authority_fragmentation_score?: number | null
          continuity_break_risk_score?: number | null
          continuity_strength_score?: number | null
          continuum_verdict?: string | null
          created_at?: string
          dominant_continuity_signal?: string | null
          dominant_decay_signal?: string | null
          entropy_accumulation_score?: number | null
          entropy_resistance_score?: number | null
          execution_continuity_score?: number | null
          execution_decay_score?: number | null
          id?: string
          notes?: string | null
          operational_persistence_score?: number | null
          resilience_continuity_score?: number | null
          semantic_continuity_score?: number | null
          semantic_instability_score?: number | null
          strategic_continuum_score?: number | null
          strategic_longevity_score?: number | null
          systemic_persistence_score?: number | null
        }
        Relationships: []
      }
      seo_decision_lineage: {
        Row: {
          affected_engines: Json
          confidence_score: number
          conflict_probability: number
          created_at: string
          decision_summary: string | null
          decision_type: string | null
          id: string
          lineage_depth: number
          originating_engine: string | null
          reasoning_chain: Json
        }
        Insert: {
          affected_engines?: Json
          confidence_score?: number
          conflict_probability?: number
          created_at?: string
          decision_summary?: string | null
          decision_type?: string | null
          id?: string
          lineage_depth?: number
          originating_engine?: string | null
          reasoning_chain?: Json
        }
        Update: {
          affected_engines?: Json
          confidence_score?: number
          conflict_probability?: number
          created_at?: string
          decision_summary?: string | null
          decision_type?: string | null
          id?: string
          lineage_depth?: number
          originating_engine?: string | null
          reasoning_chain?: Json
        }
        Relationships: []
      }
      seo_engine_conflicts: {
        Row: {
          affected_entities: Json
          conflict_type: string
          created_at: string
          description: string | null
          engine_a: string
          engine_b: string
          id: string
          resolution_suggestion: string | null
          resolved: boolean
          severity: string
        }
        Insert: {
          affected_entities?: Json
          conflict_type: string
          created_at?: string
          description?: string | null
          engine_a: string
          engine_b: string
          id?: string
          resolution_suggestion?: string | null
          resolved?: boolean
          severity?: string
        }
        Update: {
          affected_entities?: Json
          conflict_type?: string
          created_at?: string
          description?: string | null
          engine_a?: string
          engine_b?: string
          id?: string
          resolution_suggestion?: string | null
          resolved?: boolean
          severity?: string
        }
        Relationships: []
      }
      seo_engine_registry: {
        Row: {
          complexity_score: number
          confidence_score: number
          created_at: string
          deprecated: boolean
          description: string | null
          domain: string | null
          engine_key: string
          engine_name: string
          id: string
          input_count: number
          maintenance_cost: number
          output_count: number
          overlap_risk: number
        }
        Insert: {
          complexity_score?: number
          confidence_score?: number
          created_at?: string
          deprecated?: boolean
          description?: string | null
          domain?: string | null
          engine_key: string
          engine_name: string
          id?: string
          input_count?: number
          maintenance_cost?: number
          output_count?: number
          overlap_risk?: number
        }
        Update: {
          complexity_score?: number
          confidence_score?: number
          created_at?: string
          deprecated?: boolean
          description?: string | null
          domain?: string | null
          engine_key?: string
          engine_name?: string
          id?: string
          input_count?: number
          maintenance_cost?: number
          output_count?: number
          overlap_risk?: number
        }
        Relationships: []
      }
      seo_entity_snapshots: {
        Row: {
          authority_score: number
          cannibalization_risk: string
          created_at: string
          editorial_size: number
          entity_id: string
          entity_name: string | null
          entity_slug: string | null
          entity_type: string
          faq_count: number
          id: string
          internal_links_count: number
          maturity_score: number
          metadata: Json
          orphan_risk: boolean
          readiness_score: number
          reviews_count: number
          semantic_connectivity: number
          snapshot_date: string
          thin_content_risk: boolean
          topical_coverage: number
        }
        Insert: {
          authority_score?: number
          cannibalization_risk?: string
          created_at?: string
          editorial_size?: number
          entity_id: string
          entity_name?: string | null
          entity_slug?: string | null
          entity_type: string
          faq_count?: number
          id?: string
          internal_links_count?: number
          maturity_score?: number
          metadata?: Json
          orphan_risk?: boolean
          readiness_score?: number
          reviews_count?: number
          semantic_connectivity?: number
          snapshot_date?: string
          thin_content_risk?: boolean
          topical_coverage?: number
        }
        Update: {
          authority_score?: number
          cannibalization_risk?: string
          created_at?: string
          editorial_size?: number
          entity_id?: string
          entity_name?: string | null
          entity_slug?: string | null
          entity_type?: string
          faq_count?: number
          id?: string
          internal_links_count?: number
          maturity_score?: number
          metadata?: Json
          orphan_risk?: boolean
          readiness_score?: number
          reviews_count?: number
          semantic_connectivity?: number
          snapshot_date?: string
          thin_content_risk?: boolean
          topical_coverage?: number
        }
        Relationships: []
      }
      seo_execution_log: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          entity_id: string
          entity_slug: string | null
          entity_type: string
          id: string
          impact_score: number
          metadata: Json
          performed_by: string | null
          performed_by_email: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          entity_id: string
          entity_slug?: string | null
          entity_type: string
          id?: string
          impact_score?: number
          metadata?: Json
          performed_by?: string | null
          performed_by_email?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_slug?: string | null
          entity_type?: string
          id?: string
          impact_score?: number
          metadata?: Json
          performed_by?: string | null
          performed_by_email?: string | null
        }
        Relationships: []
      }
      seo_execution_orchestrator_snapshots: {
        Row: {
          cadence_stability_score: number | null
          compounding_leverage_score: number | null
          created_at: string
          created_by: string | null
          execution_clarity_score: number | null
          execution_overload_score: number | null
          execution_sustainability_score: number | null
          id: string
          maintenance_pressure_score: number | null
          notes: string | null
          operational_drag_score: number | null
          operational_rhythm_score: number | null
          payload: Json | null
          queue_conflict_score: number | null
          recovery_capacity_score: number | null
          strategic_fatigue_score: number | null
          strategic_focus_score: number | null
        }
        Insert: {
          cadence_stability_score?: number | null
          compounding_leverage_score?: number | null
          created_at?: string
          created_by?: string | null
          execution_clarity_score?: number | null
          execution_overload_score?: number | null
          execution_sustainability_score?: number | null
          id?: string
          maintenance_pressure_score?: number | null
          notes?: string | null
          operational_drag_score?: number | null
          operational_rhythm_score?: number | null
          payload?: Json | null
          queue_conflict_score?: number | null
          recovery_capacity_score?: number | null
          strategic_fatigue_score?: number | null
          strategic_focus_score?: number | null
        }
        Update: {
          cadence_stability_score?: number | null
          compounding_leverage_score?: number | null
          created_at?: string
          created_by?: string | null
          execution_clarity_score?: number | null
          execution_overload_score?: number | null
          execution_sustainability_score?: number | null
          id?: string
          maintenance_pressure_score?: number | null
          notes?: string | null
          operational_drag_score?: number | null
          operational_rhythm_score?: number | null
          payload?: Json | null
          queue_conflict_score?: number | null
          recovery_capacity_score?: number | null
          strategic_fatigue_score?: number | null
          strategic_focus_score?: number | null
        }
        Relationships: []
      }
      seo_executive_core_snapshots: {
        Row: {
          authority_integrity_score: number | null
          coherence_depth_score: number | null
          collapse_exposure_score: number | null
          created_at: string
          decision_reliability_score: number | null
          execution_alignment_score: number | null
          execution_fragility_score: number | null
          executive_core_score: number | null
          executive_priorities: Json | null
          executive_recommendations: Json | null
          executive_risks: Json | null
          executive_summary: Json | null
          explainability_depth_score: number | null
          future_collapse_probability: number | null
          governance_fragility_score: number | null
          governance_integrity_score: number | null
          hidden_risk_score: number | null
          id: string
          intelligence_integrity_score: number | null
          long_term_viability_score: number | null
          notes: string | null
          operational_sustainability_score: number | null
          orchestration_integrity_score: number | null
          scalability_viability_score: number | null
          semantic_fragility_score: number | null
          semantic_integrity_score: number | null
          strategic_alignment_score: number | null
          strategic_continuity_score: number | null
          strategic_fragility_score: number | null
          strategic_resilience_score: number | null
          strategic_signal_quality: number | null
          sustainability_projection_score: number | null
          systemic_confidence_score: number | null
          systemic_stability_score: number | null
          systemic_strategy_score: number | null
        }
        Insert: {
          authority_integrity_score?: number | null
          coherence_depth_score?: number | null
          collapse_exposure_score?: number | null
          created_at?: string
          decision_reliability_score?: number | null
          execution_alignment_score?: number | null
          execution_fragility_score?: number | null
          executive_core_score?: number | null
          executive_priorities?: Json | null
          executive_recommendations?: Json | null
          executive_risks?: Json | null
          executive_summary?: Json | null
          explainability_depth_score?: number | null
          future_collapse_probability?: number | null
          governance_fragility_score?: number | null
          governance_integrity_score?: number | null
          hidden_risk_score?: number | null
          id?: string
          intelligence_integrity_score?: number | null
          long_term_viability_score?: number | null
          notes?: string | null
          operational_sustainability_score?: number | null
          orchestration_integrity_score?: number | null
          scalability_viability_score?: number | null
          semantic_fragility_score?: number | null
          semantic_integrity_score?: number | null
          strategic_alignment_score?: number | null
          strategic_continuity_score?: number | null
          strategic_fragility_score?: number | null
          strategic_resilience_score?: number | null
          strategic_signal_quality?: number | null
          sustainability_projection_score?: number | null
          systemic_confidence_score?: number | null
          systemic_stability_score?: number | null
          systemic_strategy_score?: number | null
        }
        Update: {
          authority_integrity_score?: number | null
          coherence_depth_score?: number | null
          collapse_exposure_score?: number | null
          created_at?: string
          decision_reliability_score?: number | null
          execution_alignment_score?: number | null
          execution_fragility_score?: number | null
          executive_core_score?: number | null
          executive_priorities?: Json | null
          executive_recommendations?: Json | null
          executive_risks?: Json | null
          executive_summary?: Json | null
          explainability_depth_score?: number | null
          future_collapse_probability?: number | null
          governance_fragility_score?: number | null
          governance_integrity_score?: number | null
          hidden_risk_score?: number | null
          id?: string
          intelligence_integrity_score?: number | null
          long_term_viability_score?: number | null
          notes?: string | null
          operational_sustainability_score?: number | null
          orchestration_integrity_score?: number | null
          scalability_viability_score?: number | null
          semantic_fragility_score?: number | null
          semantic_integrity_score?: number | null
          strategic_alignment_score?: number | null
          strategic_continuity_score?: number | null
          strategic_fragility_score?: number | null
          strategic_resilience_score?: number | null
          strategic_signal_quality?: number | null
          sustainability_projection_score?: number | null
          systemic_confidence_score?: number | null
          systemic_stability_score?: number | null
          systemic_strategy_score?: number | null
        }
        Relationships: []
      }
      seo_executive_snapshots: {
        Row: {
          adaptability_score: number
          authority_resilience: number
          cognitive_pressure: number
          compounding_capacity: number
          created_at: string
          created_by: string | null
          ecosystem_health: number
          execution_clarity: number
          execution_fatigue: number
          existential_stability: number
          fragmentation_score: number
          id: string
          long_term_survival: number
          notes: string | null
          operational_state: number
          predictive_confidence: number
          recovery_readiness: number
          semantic_decay: number
          semantic_efficiency: number
          snapshot: Json
          strategic_alignment: number
          strategic_noise: number
          sustainability_score: number
          systemic_entropy: number
        }
        Insert: {
          adaptability_score?: number
          authority_resilience?: number
          cognitive_pressure?: number
          compounding_capacity?: number
          created_at?: string
          created_by?: string | null
          ecosystem_health?: number
          execution_clarity?: number
          execution_fatigue?: number
          existential_stability?: number
          fragmentation_score?: number
          id?: string
          long_term_survival?: number
          notes?: string | null
          operational_state?: number
          predictive_confidence?: number
          recovery_readiness?: number
          semantic_decay?: number
          semantic_efficiency?: number
          snapshot?: Json
          strategic_alignment?: number
          strategic_noise?: number
          sustainability_score?: number
          systemic_entropy?: number
        }
        Update: {
          adaptability_score?: number
          authority_resilience?: number
          cognitive_pressure?: number
          compounding_capacity?: number
          created_at?: string
          created_by?: string | null
          ecosystem_health?: number
          execution_clarity?: number
          execution_fatigue?: number
          existential_stability?: number
          fragmentation_score?: number
          id?: string
          long_term_survival?: number
          notes?: string | null
          operational_state?: number
          predictive_confidence?: number
          recovery_readiness?: number
          semantic_decay?: number
          semantic_efficiency?: number
          snapshot?: Json
          strategic_alignment?: number
          strategic_noise?: number
          sustainability_score?: number
          systemic_entropy?: number
        }
        Relationships: []
      }
      seo_final_governance_snapshots: {
        Row: {
          cache_pressure_score: number | null
          commercial_leverage_score: number | null
          created_at: string
          created_by: string | null
          documentation_reliability_score: number | null
          governance_maturity_score: number | null
          id: string
          maintenance_liability_score: number | null
          notes: string | null
          operational_bloat_score: number | null
          operational_sustainability_score: number | null
          performance_pressure_score: number | null
          simplification_backlog_score: number | null
          sustainable_complexity_score: number | null
        }
        Insert: {
          cache_pressure_score?: number | null
          commercial_leverage_score?: number | null
          created_at?: string
          created_by?: string | null
          documentation_reliability_score?: number | null
          governance_maturity_score?: number | null
          id?: string
          maintenance_liability_score?: number | null
          notes?: string | null
          operational_bloat_score?: number | null
          operational_sustainability_score?: number | null
          performance_pressure_score?: number | null
          simplification_backlog_score?: number | null
          sustainable_complexity_score?: number | null
        }
        Update: {
          cache_pressure_score?: number | null
          commercial_leverage_score?: number | null
          created_at?: string
          created_by?: string | null
          documentation_reliability_score?: number | null
          governance_maturity_score?: number | null
          id?: string
          maintenance_liability_score?: number | null
          notes?: string | null
          operational_bloat_score?: number | null
          operational_sustainability_score?: number | null
          performance_pressure_score?: number | null
          simplification_backlog_score?: number | null
          sustainable_complexity_score?: number | null
        }
        Relationships: []
      }
      seo_governance_matrix_snapshots: {
        Row: {
          autonomous_stability_score: number | null
          collapse_exposure_score: number | null
          created_at: string
          dominant_risk: string | null
          dominant_strength: string | null
          evolutionary_consistency_score: number | null
          execution_integrity_score: number | null
          executive_noise_score: number | null
          governance_entropy_score: number | null
          governance_matrix_score: number | null
          governance_verdict: string | null
          id: string
          notes: string | null
          operational_conflict_score: number | null
          operational_predictability_score: number | null
          resilience_projection_score: number | null
          semantic_drift_score: number | null
          strategic_cohesion_score: number | null
          strategic_fragmentation_score: number | null
          strategic_integrity_score: number | null
          systemic_alignment_score: number | null
        }
        Insert: {
          autonomous_stability_score?: number | null
          collapse_exposure_score?: number | null
          created_at?: string
          dominant_risk?: string | null
          dominant_strength?: string | null
          evolutionary_consistency_score?: number | null
          execution_integrity_score?: number | null
          executive_noise_score?: number | null
          governance_entropy_score?: number | null
          governance_matrix_score?: number | null
          governance_verdict?: string | null
          id?: string
          notes?: string | null
          operational_conflict_score?: number | null
          operational_predictability_score?: number | null
          resilience_projection_score?: number | null
          semantic_drift_score?: number | null
          strategic_cohesion_score?: number | null
          strategic_fragmentation_score?: number | null
          strategic_integrity_score?: number | null
          systemic_alignment_score?: number | null
        }
        Update: {
          autonomous_stability_score?: number | null
          collapse_exposure_score?: number | null
          created_at?: string
          dominant_risk?: string | null
          dominant_strength?: string | null
          evolutionary_consistency_score?: number | null
          execution_integrity_score?: number | null
          executive_noise_score?: number | null
          governance_entropy_score?: number | null
          governance_matrix_score?: number | null
          governance_verdict?: string | null
          id?: string
          notes?: string | null
          operational_conflict_score?: number | null
          operational_predictability_score?: number | null
          resilience_projection_score?: number | null
          semantic_drift_score?: number | null
          strategic_cohesion_score?: number | null
          strategic_fragmentation_score?: number | null
          strategic_integrity_score?: number | null
          systemic_alignment_score?: number | null
        }
        Relationships: []
      }
      seo_integrity_grid_snapshots: {
        Row: {
          continuity_break_risk: number | null
          continuity_graph: Json | null
          continuity_integrity_score: number | null
          convergence_integrity_score: number | null
          created_at: string
          executive_integrity_score: number | null
          governance_conflicts: Json | null
          governance_integrity_score: number | null
          hidden_fragmentation_risk: number | null
          id: string
          integrity_grid_score: number | null
          integrity_matrix: Json | null
          notes: string | null
          operational_conflict_risk: number | null
          operational_integrity_score: number | null
          resilience_distribution: Json | null
          resilience_integrity_score: number | null
          semantic_confusion_risk: number | null
          semantic_integrity_map: Json | null
          semantic_integrity_score: number | null
          snapshot_type: string
          strategic_alignment_map: Json | null
          strategic_coherence_score: number | null
          strategic_erosion_risk: number | null
          systemic_trust_score: number | null
        }
        Insert: {
          continuity_break_risk?: number | null
          continuity_graph?: Json | null
          continuity_integrity_score?: number | null
          convergence_integrity_score?: number | null
          created_at?: string
          executive_integrity_score?: number | null
          governance_conflicts?: Json | null
          governance_integrity_score?: number | null
          hidden_fragmentation_risk?: number | null
          id?: string
          integrity_grid_score?: number | null
          integrity_matrix?: Json | null
          notes?: string | null
          operational_conflict_risk?: number | null
          operational_integrity_score?: number | null
          resilience_distribution?: Json | null
          resilience_integrity_score?: number | null
          semantic_confusion_risk?: number | null
          semantic_integrity_map?: Json | null
          semantic_integrity_score?: number | null
          snapshot_type?: string
          strategic_alignment_map?: Json | null
          strategic_coherence_score?: number | null
          strategic_erosion_risk?: number | null
          systemic_trust_score?: number | null
        }
        Update: {
          continuity_break_risk?: number | null
          continuity_graph?: Json | null
          continuity_integrity_score?: number | null
          convergence_integrity_score?: number | null
          created_at?: string
          executive_integrity_score?: number | null
          governance_conflicts?: Json | null
          governance_integrity_score?: number | null
          hidden_fragmentation_risk?: number | null
          id?: string
          integrity_grid_score?: number | null
          integrity_matrix?: Json | null
          notes?: string | null
          operational_conflict_risk?: number | null
          operational_integrity_score?: number | null
          resilience_distribution?: Json | null
          resilience_integrity_score?: number | null
          semantic_confusion_risk?: number | null
          semantic_integrity_map?: Json | null
          semantic_integrity_score?: number | null
          snapshot_type?: string
          strategic_alignment_map?: Json | null
          strategic_coherence_score?: number | null
          strategic_erosion_risk?: number | null
          systemic_trust_score?: number | null
        }
        Relationships: []
      }
      seo_kernel_snapshots: {
        Row: {
          architectural_entropy: number
          confidence_integrity: number
          created_at: string
          diagnostic_consistency: number
          engine_overlap: number
          explainability_score: number
          id: string
          kernel_coherence: number
          lineage_integrity: number
          maintainability_score: number
          metric_redundancy: number
          normalization_health: number
          notes: string | null
          observability_score: number
          operational_compression: number
          operator_load: number
          orchestration_stability: number
          systemic_noise: number
          telemetry_quality: number
          tracing_coverage: number
        }
        Insert: {
          architectural_entropy?: number
          confidence_integrity?: number
          created_at?: string
          diagnostic_consistency?: number
          engine_overlap?: number
          explainability_score?: number
          id?: string
          kernel_coherence?: number
          lineage_integrity?: number
          maintainability_score?: number
          metric_redundancy?: number
          normalization_health?: number
          notes?: string | null
          observability_score?: number
          operational_compression?: number
          operator_load?: number
          orchestration_stability?: number
          systemic_noise?: number
          telemetry_quality?: number
          tracing_coverage?: number
        }
        Update: {
          architectural_entropy?: number
          confidence_integrity?: number
          created_at?: string
          diagnostic_consistency?: number
          engine_overlap?: number
          explainability_score?: number
          id?: string
          kernel_coherence?: number
          lineage_integrity?: number
          maintainability_score?: number
          metric_redundancy?: number
          normalization_health?: number
          notes?: string | null
          observability_score?: number
          operational_compression?: number
          operator_load?: number
          orchestration_stability?: number
          systemic_noise?: number
          telemetry_quality?: number
          tracing_coverage?: number
        }
        Relationships: []
      }
      seo_meta_governance_snapshots: {
        Row: {
          adaptability_continuity: number
          authority_balance: number
          authority_distortion: number
          contradiction_pressure: number
          created_at: string
          created_by: string | null
          ecosystem_integrity: number
          execution_continuity: number
          existential_stability: number
          governance_score: number
          id: string
          long_horizon_survivability: number
          notes: string | null
          operational_noise: number
          operational_predictability: number
          recovery_continuity: number
          resilience_continuity: number
          semantic_cohesion: number
          semantic_instability: number
          snapshot: Json
          strategic_fragmentation: number
          strategic_governability: number
          sustainability_continuity: number
          systemic_consistency: number
          systemic_trustworthiness: number
        }
        Insert: {
          adaptability_continuity?: number
          authority_balance?: number
          authority_distortion?: number
          contradiction_pressure?: number
          created_at?: string
          created_by?: string | null
          ecosystem_integrity?: number
          execution_continuity?: number
          existential_stability?: number
          governance_score?: number
          id?: string
          long_horizon_survivability?: number
          notes?: string | null
          operational_noise?: number
          operational_predictability?: number
          recovery_continuity?: number
          resilience_continuity?: number
          semantic_cohesion?: number
          semantic_instability?: number
          snapshot?: Json
          strategic_fragmentation?: number
          strategic_governability?: number
          sustainability_continuity?: number
          systemic_consistency?: number
          systemic_trustworthiness?: number
        }
        Update: {
          adaptability_continuity?: number
          authority_balance?: number
          authority_distortion?: number
          contradiction_pressure?: number
          created_at?: string
          created_by?: string | null
          ecosystem_integrity?: number
          execution_continuity?: number
          existential_stability?: number
          governance_score?: number
          id?: string
          long_horizon_survivability?: number
          notes?: string | null
          operational_noise?: number
          operational_predictability?: number
          recovery_continuity?: number
          resilience_continuity?: number
          semantic_cohesion?: number
          semantic_instability?: number
          snapshot?: Json
          strategic_fragmentation?: number
          strategic_governability?: number
          sustainability_continuity?: number
          systemic_consistency?: number
          systemic_trustworthiness?: number
        }
        Relationships: []
      }
      seo_meta_reasoning_snapshots: {
        Row: {
          authority_coherence: number
          blockers: Json
          cognitive_integrity_score: number
          cognitive_stability_score: number
          coherence_collapse_risk: number
          consensus_stability_score: number
          contradiction_risk_score: number
          created_at: string
          cross_layer_coherence: number
          decision_reliability_score: number
          executive_summary: Json
          forecast_reliability_score: number
          governance_coherence: number
          governance_drift_score: number
          id: string
          long_term_reasoning_viability: number
          meta_reasoning_score: number
          notes: string | null
          observability_stability_score: number
          operational_coherence: number
          operational_drift_score: number
          orchestration_stability_score: number
          reasoning_drift_score: number
          reasoning_reliability_score: number
          reasoning_stability_score: number
          recommendations: Json
          self_conflict_score: number
          semantic_coherence: number
          semantic_drift_score: number
          strategic_coherence: number
          strategic_confidence_score: number
          strategic_drift_score: number
          strategic_hallucination_risk: number
          strategic_self_awareness_score: number
          strategic_survival_confidence: number
          systemic_longevity_score: number
          systemic_reflection_score: number
          traceability_integrity_score: number
          warnings: Json
        }
        Insert: {
          authority_coherence?: number
          blockers?: Json
          cognitive_integrity_score?: number
          cognitive_stability_score?: number
          coherence_collapse_risk?: number
          consensus_stability_score?: number
          contradiction_risk_score?: number
          created_at?: string
          cross_layer_coherence?: number
          decision_reliability_score?: number
          executive_summary?: Json
          forecast_reliability_score?: number
          governance_coherence?: number
          governance_drift_score?: number
          id?: string
          long_term_reasoning_viability?: number
          meta_reasoning_score?: number
          notes?: string | null
          observability_stability_score?: number
          operational_coherence?: number
          operational_drift_score?: number
          orchestration_stability_score?: number
          reasoning_drift_score?: number
          reasoning_reliability_score?: number
          reasoning_stability_score?: number
          recommendations?: Json
          self_conflict_score?: number
          semantic_coherence?: number
          semantic_drift_score?: number
          strategic_coherence?: number
          strategic_confidence_score?: number
          strategic_drift_score?: number
          strategic_hallucination_risk?: number
          strategic_self_awareness_score?: number
          strategic_survival_confidence?: number
          systemic_longevity_score?: number
          systemic_reflection_score?: number
          traceability_integrity_score?: number
          warnings?: Json
        }
        Update: {
          authority_coherence?: number
          blockers?: Json
          cognitive_integrity_score?: number
          cognitive_stability_score?: number
          coherence_collapse_risk?: number
          consensus_stability_score?: number
          contradiction_risk_score?: number
          created_at?: string
          cross_layer_coherence?: number
          decision_reliability_score?: number
          executive_summary?: Json
          forecast_reliability_score?: number
          governance_coherence?: number
          governance_drift_score?: number
          id?: string
          long_term_reasoning_viability?: number
          meta_reasoning_score?: number
          notes?: string | null
          observability_stability_score?: number
          operational_coherence?: number
          operational_drift_score?: number
          orchestration_stability_score?: number
          reasoning_drift_score?: number
          reasoning_reliability_score?: number
          reasoning_stability_score?: number
          recommendations?: Json
          self_conflict_score?: number
          semantic_coherence?: number
          semantic_drift_score?: number
          strategic_coherence?: number
          strategic_confidence_score?: number
          strategic_drift_score?: number
          strategic_hallucination_risk?: number
          strategic_self_awareness_score?: number
          strategic_survival_confidence?: number
          systemic_longevity_score?: number
          systemic_reflection_score?: number
          traceability_integrity_score?: number
          warnings?: Json
        }
        Relationships: []
      }
      seo_metric_consistency: {
        Row: {
          confidence_score: number
          created_at: string
          id: string
          metric_name: string
          normalized_value: number
          raw_value: number
          source_engine: string
          variance_score: number
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          id?: string
          metric_name: string
          normalized_value?: number
          raw_value?: number
          source_engine: string
          variance_score?: number
        }
        Update: {
          confidence_score?: number
          created_at?: string
          id?: string
          metric_name?: string
          normalized_value?: number
          raw_value?: number
          source_engine?: string
          variance_score?: number
        }
        Relationships: []
      }
      seo_metric_lineage: {
        Row: {
          confidence: number
          created_at: string
          depends_on: string[]
          derived_from_engines: string[]
          id: string
          lineage_depth: number
          metric_key: string
          volatility: number
        }
        Insert: {
          confidence?: number
          created_at?: string
          depends_on?: string[]
          derived_from_engines?: string[]
          id?: string
          lineage_depth?: number
          metric_key: string
          volatility?: number
        }
        Update: {
          confidence?: number
          created_at?: string
          depends_on?: string[]
          derived_from_engines?: string[]
          id?: string
          lineage_depth?: number
          metric_key?: string
          volatility?: number
        }
        Relationships: []
      }
      seo_metric_registry: {
        Row: {
          calculation_type: string | null
          canonical_metric: boolean
          category: string | null
          confidence_weight: number
          created_at: string
          deprecated: boolean
          description: string | null
          domain: string | null
          id: string
          is_normalized: boolean
          metric_key: string
          metric_name: string
          redundancy_group: string | null
          scale_max: number
          scale_min: number
          source_engine: string | null
        }
        Insert: {
          calculation_type?: string | null
          canonical_metric?: boolean
          category?: string | null
          confidence_weight?: number
          created_at?: string
          deprecated?: boolean
          description?: string | null
          domain?: string | null
          id?: string
          is_normalized?: boolean
          metric_key: string
          metric_name: string
          redundancy_group?: string | null
          scale_max?: number
          scale_min?: number
          source_engine?: string | null
        }
        Update: {
          calculation_type?: string | null
          canonical_metric?: boolean
          category?: string | null
          confidence_weight?: number
          created_at?: string
          deprecated?: boolean
          description?: string | null
          domain?: string | null
          id?: string
          is_normalized?: boolean
          metric_key?: string
          metric_name?: string
          redundancy_group?: string | null
          scale_max?: number
          scale_min?: number
          source_engine?: string | null
        }
        Relationships: []
      }
      seo_nervous_system_snapshots: {
        Row: {
          adaptive_capacity: number
          authority_dependence: number
          cluster_fragility: number
          cognitive_efficiency: number
          collapse_probability: number
          created_at: string
          created_by: string | null
          ecosystem_synchronization: number
          entropy_resistance: number
          execution_stability: number
          existential_exposure: number
          id: string
          long_term_viability: number
          nervous_system_score: number
          notes: string | null
          operational_resilience: number
          operational_survival: number
          recovery_intelligence: number
          semantic_pressure: number
          semantic_resilience: number
          semantic_saturation: number
          snapshot: Json
          strategic_fatigue: number
          strategic_resilience: number
          sustainability_projection: number
          systemic_stability: number
        }
        Insert: {
          adaptive_capacity?: number
          authority_dependence?: number
          cluster_fragility?: number
          cognitive_efficiency?: number
          collapse_probability?: number
          created_at?: string
          created_by?: string | null
          ecosystem_synchronization?: number
          entropy_resistance?: number
          execution_stability?: number
          existential_exposure?: number
          id?: string
          long_term_viability?: number
          nervous_system_score?: number
          notes?: string | null
          operational_resilience?: number
          operational_survival?: number
          recovery_intelligence?: number
          semantic_pressure?: number
          semantic_resilience?: number
          semantic_saturation?: number
          snapshot?: Json
          strategic_fatigue?: number
          strategic_resilience?: number
          sustainability_projection?: number
          systemic_stability?: number
        }
        Update: {
          adaptive_capacity?: number
          authority_dependence?: number
          cluster_fragility?: number
          cognitive_efficiency?: number
          collapse_probability?: number
          created_at?: string
          created_by?: string | null
          ecosystem_synchronization?: number
          entropy_resistance?: number
          execution_stability?: number
          existential_exposure?: number
          id?: string
          long_term_viability?: number
          nervous_system_score?: number
          notes?: string | null
          operational_resilience?: number
          operational_survival?: number
          recovery_intelligence?: number
          semantic_pressure?: number
          semantic_resilience?: number
          semantic_saturation?: number
          snapshot?: Json
          strategic_fatigue?: number
          strategic_resilience?: number
          sustainability_projection?: number
          systemic_stability?: number
        }
        Relationships: []
      }
      seo_nexus_convergence_snapshots: {
        Row: {
          causal_alignment_score: number | null
          causal_graph: Json | null
          continuity_projection: Json | null
          convergence_map: Json | null
          convergence_score: number | null
          created_at: string
          dominant_cluster: string | null
          entropy_resistance_score: number | null
          executive_clarity_score: number | null
          governance_confidence_score: number | null
          highest_risk_domain: string | null
          id: string
          notes: string | null
          operational_stability_score: number | null
          resilience_projection: Json | null
          semantic_trust_score: number | null
          signal_integrity_score: number | null
          snapshot_type: string
          strategic_conflicts: Json | null
          strategic_consistency_score: number | null
          strongest_domain: string | null
          temporal_coherence_score: number | null
          trust_matrix: Json | null
          weakest_cluster: string | null
        }
        Insert: {
          causal_alignment_score?: number | null
          causal_graph?: Json | null
          continuity_projection?: Json | null
          convergence_map?: Json | null
          convergence_score?: number | null
          created_at?: string
          dominant_cluster?: string | null
          entropy_resistance_score?: number | null
          executive_clarity_score?: number | null
          governance_confidence_score?: number | null
          highest_risk_domain?: string | null
          id?: string
          notes?: string | null
          operational_stability_score?: number | null
          resilience_projection?: Json | null
          semantic_trust_score?: number | null
          signal_integrity_score?: number | null
          snapshot_type?: string
          strategic_conflicts?: Json | null
          strategic_consistency_score?: number | null
          strongest_domain?: string | null
          temporal_coherence_score?: number | null
          trust_matrix?: Json | null
          weakest_cluster?: string | null
        }
        Update: {
          causal_alignment_score?: number | null
          causal_graph?: Json | null
          continuity_projection?: Json | null
          convergence_map?: Json | null
          convergence_score?: number | null
          created_at?: string
          dominant_cluster?: string | null
          entropy_resistance_score?: number | null
          executive_clarity_score?: number | null
          governance_confidence_score?: number | null
          highest_risk_domain?: string | null
          id?: string
          notes?: string | null
          operational_stability_score?: number | null
          resilience_projection?: Json | null
          semantic_trust_score?: number | null
          signal_integrity_score?: number | null
          snapshot_type?: string
          strategic_conflicts?: Json | null
          strategic_consistency_score?: number | null
          strongest_domain?: string | null
          temporal_coherence_score?: number | null
          trust_matrix?: Json | null
          weakest_cluster?: string | null
        }
        Relationships: []
      }
      seo_operating_fabric_snapshots: {
        Row: {
          anomaly_pressure: number | null
          authority_integrity_score: number | null
          blockers: Json | null
          collapse_probability: number | null
          consensus_score: number | null
          continuity_projection: number | null
          created_at: string
          dependency_risk: number | null
          entropy_score: number | null
          execution_pressure: number | null
          executive_summary: Json | null
          explainability_score: number | null
          fragmentation_risk: number | null
          future_stability_score: number | null
          governance_integrity_score: number | null
          id: string
          notes: string | null
          observability_score: number | null
          operating_fabric_score: number | null
          operational_debt: number | null
          recommendations: Json | null
          resilience_integrity_score: number | null
          scalability_projection: number | null
          scaling_risk: number | null
          semantic_integrity_score: number | null
          strategic_cohesion_score: number | null
          strategic_noise: number | null
          strengths: Json | null
          sustainability_projection: number | null
          systemic_complexity: number | null
        }
        Insert: {
          anomaly_pressure?: number | null
          authority_integrity_score?: number | null
          blockers?: Json | null
          collapse_probability?: number | null
          consensus_score?: number | null
          continuity_projection?: number | null
          created_at?: string
          dependency_risk?: number | null
          entropy_score?: number | null
          execution_pressure?: number | null
          executive_summary?: Json | null
          explainability_score?: number | null
          fragmentation_risk?: number | null
          future_stability_score?: number | null
          governance_integrity_score?: number | null
          id?: string
          notes?: string | null
          observability_score?: number | null
          operating_fabric_score?: number | null
          operational_debt?: number | null
          recommendations?: Json | null
          resilience_integrity_score?: number | null
          scalability_projection?: number | null
          scaling_risk?: number | null
          semantic_integrity_score?: number | null
          strategic_cohesion_score?: number | null
          strategic_noise?: number | null
          strengths?: Json | null
          sustainability_projection?: number | null
          systemic_complexity?: number | null
        }
        Update: {
          anomaly_pressure?: number | null
          authority_integrity_score?: number | null
          blockers?: Json | null
          collapse_probability?: number | null
          consensus_score?: number | null
          continuity_projection?: number | null
          created_at?: string
          dependency_risk?: number | null
          entropy_score?: number | null
          execution_pressure?: number | null
          executive_summary?: Json | null
          explainability_score?: number | null
          fragmentation_risk?: number | null
          future_stability_score?: number | null
          governance_integrity_score?: number | null
          id?: string
          notes?: string | null
          observability_score?: number | null
          operating_fabric_score?: number | null
          operational_debt?: number | null
          recommendations?: Json | null
          resilience_integrity_score?: number | null
          scalability_projection?: number | null
          scaling_risk?: number | null
          semantic_integrity_score?: number | null
          strategic_cohesion_score?: number | null
          strategic_noise?: number | null
          strengths?: Json | null
          sustainability_projection?: number | null
          systemic_complexity?: number | null
        }
        Relationships: []
      }
      seo_operational_reality_snapshots: {
        Row: {
          commercial_opportunity_score: number | null
          complexity_cost_score: number | null
          created_at: string
          created_by: string | null
          dashboard_utilization_score: number | null
          documentation_health_score: number | null
          governance_maturity_score: number | null
          human_operability_score: number | null
          id: string
          maintenance_burden_score: number | null
          notes: string | null
          operational_value_score: number | null
          performance_pressure_score: number | null
          pruning_readiness_score: number | null
          sustainability_score: number | null
        }
        Insert: {
          commercial_opportunity_score?: number | null
          complexity_cost_score?: number | null
          created_at?: string
          created_by?: string | null
          dashboard_utilization_score?: number | null
          documentation_health_score?: number | null
          governance_maturity_score?: number | null
          human_operability_score?: number | null
          id?: string
          maintenance_burden_score?: number | null
          notes?: string | null
          operational_value_score?: number | null
          performance_pressure_score?: number | null
          pruning_readiness_score?: number | null
          sustainability_score?: number | null
        }
        Update: {
          commercial_opportunity_score?: number | null
          complexity_cost_score?: number | null
          created_at?: string
          created_by?: string | null
          dashboard_utilization_score?: number | null
          documentation_health_score?: number | null
          governance_maturity_score?: number | null
          human_operability_score?: number | null
          id?: string
          maintenance_burden_score?: number | null
          notes?: string | null
          operational_value_score?: number | null
          performance_pressure_score?: number | null
          pruning_readiness_score?: number | null
          sustainability_score?: number | null
        }
        Relationships: []
      }
      seo_operational_snapshots: {
        Row: {
          authority_velocity: number
          blocked_entities: number
          collapsing_clusters: number
          created_at: string
          editorial_backlog: number
          editorial_velocity: number
          execution_capacity: number
          fragmentation_score: number
          high_potential_entities: number
          id: string
          notes: string | null
          operational_debt: number
          operational_score: number
          orphan_entities: number
          recovery_capacity: number
          risk_pressure: number
          saturation_pressure: number
          semantic_velocity: number
          snapshot_date: string
          strong_clusters: number
          thin_content_entities: number
          weak_clusters: number
        }
        Insert: {
          authority_velocity?: number
          blocked_entities?: number
          collapsing_clusters?: number
          created_at?: string
          editorial_backlog?: number
          editorial_velocity?: number
          execution_capacity?: number
          fragmentation_score?: number
          high_potential_entities?: number
          id?: string
          notes?: string | null
          operational_debt?: number
          operational_score?: number
          orphan_entities?: number
          recovery_capacity?: number
          risk_pressure?: number
          saturation_pressure?: number
          semantic_velocity?: number
          snapshot_date?: string
          strong_clusters?: number
          thin_content_entities?: number
          weak_clusters?: number
        }
        Update: {
          authority_velocity?: number
          blocked_entities?: number
          collapsing_clusters?: number
          created_at?: string
          editorial_backlog?: number
          editorial_velocity?: number
          execution_capacity?: number
          fragmentation_score?: number
          high_potential_entities?: number
          id?: string
          notes?: string | null
          operational_debt?: number
          operational_score?: number
          orphan_entities?: number
          recovery_capacity?: number
          risk_pressure?: number
          saturation_pressure?: number
          semantic_velocity?: number
          snapshot_date?: string
          strong_clusters?: number
          thin_content_entities?: number
          weak_clusters?: number
        }
        Relationships: []
      }
      seo_reasoning_conflicts: {
        Row: {
          conflict_type: string | null
          created_at: string
          description: string | null
          id: string
          layer_a: string | null
          layer_b: string | null
          mitigation: string | null
          reasoning_divergence: number
          resolved: boolean
          severity: string | null
          strategic_impact: number
        }
        Insert: {
          conflict_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          layer_a?: string | null
          layer_b?: string | null
          mitigation?: string | null
          reasoning_divergence?: number
          resolved?: boolean
          severity?: string | null
          strategic_impact?: number
        }
        Update: {
          conflict_type?: string | null
          created_at?: string
          description?: string | null
          id?: string
          layer_a?: string | null
          layer_b?: string | null
          mitigation?: string | null
          reasoning_divergence?: number
          resolved?: boolean
          severity?: string | null
          strategic_impact?: number
        }
        Relationships: []
      }
      seo_reasoning_drift_registry: {
        Row: {
          affected_layer: string | null
          contradiction_probability: number | null
          created_at: string
          description: string | null
          drift_score: number | null
          drift_type: string | null
          id: string
          mitigation_strategy: string | null
          resolved: boolean
          severity: string | null
          stability_impact: number | null
        }
        Insert: {
          affected_layer?: string | null
          contradiction_probability?: number | null
          created_at?: string
          description?: string | null
          drift_score?: number | null
          drift_type?: string | null
          id?: string
          mitigation_strategy?: string | null
          resolved?: boolean
          severity?: string | null
          stability_impact?: number | null
        }
        Update: {
          affected_layer?: string | null
          contradiction_probability?: number | null
          created_at?: string
          description?: string | null
          drift_score?: number | null
          drift_type?: string | null
          id?: string
          mitigation_strategy?: string | null
          resolved?: boolean
          severity?: string | null
          stability_impact?: number | null
        }
        Relationships: []
      }
      seo_simulation_runs: {
        Row: {
          confidence_score: number
          created_at: string
          created_by: string | null
          id: string
          input_snapshot: Json
          predicted_authority: number
          predicted_cluster_health: number
          predicted_collapse_risk: number
          predicted_decay_risk: number
          predicted_execution_cost: number
          predicted_growth_velocity: number
          predicted_operational_load: number
          predicted_recovery_time: number
          predicted_resilience: number
          predicted_roi: number
          predicted_saturation: number
          predicted_semantic_coverage: number
          scenario_type: string
          simulation_inputs: Json
          simulation_name: string
          simulation_notes: string | null
          simulation_type: string
        }
        Insert: {
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          id?: string
          input_snapshot?: Json
          predicted_authority?: number
          predicted_cluster_health?: number
          predicted_collapse_risk?: number
          predicted_decay_risk?: number
          predicted_execution_cost?: number
          predicted_growth_velocity?: number
          predicted_operational_load?: number
          predicted_recovery_time?: number
          predicted_resilience?: number
          predicted_roi?: number
          predicted_saturation?: number
          predicted_semantic_coverage?: number
          scenario_type: string
          simulation_inputs?: Json
          simulation_name: string
          simulation_notes?: string | null
          simulation_type: string
        }
        Update: {
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          id?: string
          input_snapshot?: Json
          predicted_authority?: number
          predicted_cluster_health?: number
          predicted_collapse_risk?: number
          predicted_decay_risk?: number
          predicted_execution_cost?: number
          predicted_growth_velocity?: number
          predicted_operational_load?: number
          predicted_recovery_time?: number
          predicted_resilience?: number
          predicted_roi?: number
          predicted_saturation?: number
          predicted_semantic_coverage?: number
          scenario_type?: string
          simulation_inputs?: Json
          simulation_name?: string
          simulation_notes?: string | null
          simulation_type?: string
        }
        Relationships: []
      }
      seo_snapshots: {
        Row: {
          authority_score: number | null
          avg_position: number | null
          backlinks_total: number | null
          captured_at: string
          domain: string
          id: string
          notes: string | null
          organic_cost: number | null
          organic_keywords: number | null
          organic_traffic: number | null
          raw: Json | null
          referring_domains: number | null
          source: string
          top_keywords: Json | null
          total_clicks: number | null
          total_impressions: number | null
        }
        Insert: {
          authority_score?: number | null
          avg_position?: number | null
          backlinks_total?: number | null
          captured_at?: string
          domain?: string
          id?: string
          notes?: string | null
          organic_cost?: number | null
          organic_keywords?: number | null
          organic_traffic?: number | null
          raw?: Json | null
          referring_domains?: number | null
          source: string
          top_keywords?: Json | null
          total_clicks?: number | null
          total_impressions?: number | null
        }
        Update: {
          authority_score?: number | null
          avg_position?: number | null
          backlinks_total?: number | null
          captured_at?: string
          domain?: string
          id?: string
          notes?: string | null
          organic_cost?: number | null
          organic_keywords?: number | null
          organic_traffic?: number | null
          raw?: Json | null
          referring_domains?: number | null
          source?: string
          top_keywords?: Json | null
          total_clicks?: number | null
          total_impressions?: number | null
        }
        Relationships: []
      }
      seo_stability_fabric_snapshots: {
        Row: {
          consensus_fragmentation_risk: number | null
          consensus_integrity_score: number | null
          created_at: string
          degradation_map: Json | null
          degradation_resistance_score: number | null
          equilibrium_matrix: Json | null
          executive_instability_risk: number | null
          executive_stability_score: number | null
          fragmentation_zones: Json | null
          id: string
          notes: string | null
          operational_resilience_score: number | null
          recovery_cohesion_score: number | null
          recovery_paths: Json | null
          resilience_projection: Json | null
          semantic_erosion_risk: number | null
          semantic_resilience_score: number | null
          signal_stability_score: number | null
          silent_degradation_risk: number | null
          snapshot_type: string
          stability_clusters: Json | null
          stability_fabric_score: number | null
          strategic_equilibrium_score: number | null
          systemic_dispersion_risk: number | null
          systemic_integrity_score: number | null
        }
        Insert: {
          consensus_fragmentation_risk?: number | null
          consensus_integrity_score?: number | null
          created_at?: string
          degradation_map?: Json | null
          degradation_resistance_score?: number | null
          equilibrium_matrix?: Json | null
          executive_instability_risk?: number | null
          executive_stability_score?: number | null
          fragmentation_zones?: Json | null
          id?: string
          notes?: string | null
          operational_resilience_score?: number | null
          recovery_cohesion_score?: number | null
          recovery_paths?: Json | null
          resilience_projection?: Json | null
          semantic_erosion_risk?: number | null
          semantic_resilience_score?: number | null
          signal_stability_score?: number | null
          silent_degradation_risk?: number | null
          snapshot_type?: string
          stability_clusters?: Json | null
          stability_fabric_score?: number | null
          strategic_equilibrium_score?: number | null
          systemic_dispersion_risk?: number | null
          systemic_integrity_score?: number | null
        }
        Update: {
          consensus_fragmentation_risk?: number | null
          consensus_integrity_score?: number | null
          created_at?: string
          degradation_map?: Json | null
          degradation_resistance_score?: number | null
          equilibrium_matrix?: Json | null
          executive_instability_risk?: number | null
          executive_stability_score?: number | null
          fragmentation_zones?: Json | null
          id?: string
          notes?: string | null
          operational_resilience_score?: number | null
          recovery_cohesion_score?: number | null
          recovery_paths?: Json | null
          resilience_projection?: Json | null
          semantic_erosion_risk?: number | null
          semantic_resilience_score?: number | null
          signal_stability_score?: number | null
          silent_degradation_risk?: number | null
          snapshot_type?: string
          stability_clusters?: Json | null
          stability_fabric_score?: number | null
          strategic_equilibrium_score?: number | null
          systemic_dispersion_risk?: number | null
          systemic_integrity_score?: number | null
        }
        Relationships: []
      }
      seo_strategic_reality_snapshots: {
        Row: {
          created_at: string
          dominant_distortion: string | null
          dominant_truth: string | null
          execution_credibility_score: number | null
          id: string
          illusion_risk_score: number | null
          long_term_viability_score: number | null
          notes: string | null
          operational_fiction_score: number | null
          operational_truth_score: number | null
          reality_verdict: string | null
          resilience_realism_score: number | null
          semantic_distortion_score: number | null
          semantic_grounding_score: number | null
          signal_clarity_score: number | null
          strategic_authenticity_score: number | null
          strategic_reality_score: number | null
          strategic_self_deception_score: number | null
          survivability_gap_score: number | null
          sustainability_realism_score: number | null
          systemic_truth_score: number | null
        }
        Insert: {
          created_at?: string
          dominant_distortion?: string | null
          dominant_truth?: string | null
          execution_credibility_score?: number | null
          id?: string
          illusion_risk_score?: number | null
          long_term_viability_score?: number | null
          notes?: string | null
          operational_fiction_score?: number | null
          operational_truth_score?: number | null
          reality_verdict?: string | null
          resilience_realism_score?: number | null
          semantic_distortion_score?: number | null
          semantic_grounding_score?: number | null
          signal_clarity_score?: number | null
          strategic_authenticity_score?: number | null
          strategic_reality_score?: number | null
          strategic_self_deception_score?: number | null
          survivability_gap_score?: number | null
          sustainability_realism_score?: number | null
          systemic_truth_score?: number | null
        }
        Update: {
          created_at?: string
          dominant_distortion?: string | null
          dominant_truth?: string | null
          execution_credibility_score?: number | null
          id?: string
          illusion_risk_score?: number | null
          long_term_viability_score?: number | null
          notes?: string | null
          operational_fiction_score?: number | null
          operational_truth_score?: number | null
          reality_verdict?: string | null
          resilience_realism_score?: number | null
          semantic_distortion_score?: number | null
          semantic_grounding_score?: number | null
          signal_clarity_score?: number | null
          strategic_authenticity_score?: number | null
          strategic_reality_score?: number | null
          strategic_self_deception_score?: number | null
          survivability_gap_score?: number | null
          sustainability_realism_score?: number | null
          systemic_truth_score?: number | null
        }
        Relationships: []
      }
      seo_strategy_alignment_registry: {
        Row: {
          alignment_score: number | null
          confidence_score: number | null
          created_at: string
          divergence_score: number | null
          execution_gap_score: number | null
          execution_layer: string | null
          explanation: string | null
          id: string
          strategy_layer: string | null
        }
        Insert: {
          alignment_score?: number | null
          confidence_score?: number | null
          created_at?: string
          divergence_score?: number | null
          execution_gap_score?: number | null
          execution_layer?: string | null
          explanation?: string | null
          id?: string
          strategy_layer?: string | null
        }
        Update: {
          alignment_score?: number | null
          confidence_score?: number | null
          created_at?: string
          divergence_score?: number | null
          execution_gap_score?: number | null
          execution_layer?: string | null
          explanation?: string | null
          id?: string
          strategy_layer?: string | null
        }
        Relationships: []
      }
      seo_strategy_memory: {
        Row: {
          authority_score: number
          business_intent_score: number
          cannibalization_risk: string
          conversion_potential: number
          created_at: string
          decay_score: number
          editorial_depth: number
          entity_id: string
          entity_type: string
          execution_priority: number
          id: string
          internal_link_strength: number
          notes: string | null
          readiness_score: number
          regression_risk: string
          review_strength: number
          semantic_coverage: number
          snapshot_date: string
          strategic_value: number
          updated_at: string
        }
        Insert: {
          authority_score?: number
          business_intent_score?: number
          cannibalization_risk?: string
          conversion_potential?: number
          created_at?: string
          decay_score?: number
          editorial_depth?: number
          entity_id: string
          entity_type: string
          execution_priority?: number
          id?: string
          internal_link_strength?: number
          notes?: string | null
          readiness_score?: number
          regression_risk?: string
          review_strength?: number
          semantic_coverage?: number
          snapshot_date?: string
          strategic_value?: number
          updated_at?: string
        }
        Update: {
          authority_score?: number
          business_intent_score?: number
          cannibalization_risk?: string
          conversion_potential?: number
          created_at?: string
          decay_score?: number
          editorial_depth?: number
          entity_id?: string
          entity_type?: string
          execution_priority?: number
          id?: string
          internal_link_strength?: number
          notes?: string | null
          readiness_score?: number
          regression_risk?: string
          review_strength?: number
          semantic_coverage?: number
          snapshot_date?: string
          strategic_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      seo_strategy_simulations: {
        Row: {
          assumptions: Json
          confidence_score: number
          created_at: string
          entities: Json
          execution_complexity: string
          id: string
          notes: string | null
          projected_authority: number
          projected_cluster_growth: number
          projected_decay_risk: number
          projected_execution_cost: number
          projected_operational_load: number
          projected_readiness: number
          projected_resilience: number
          projected_revenue_intent: number
          projected_risk: number
          projected_roi: number
          projected_semantic_coverage: number
          projected_sustainability: number
          projected_time_to_impact: number
          scenario_type: string
          simulation_name: string
          simulation_result: Json
          simulation_type: string
          updated_at: string
        }
        Insert: {
          assumptions?: Json
          confidence_score?: number
          created_at?: string
          entities?: Json
          execution_complexity?: string
          id?: string
          notes?: string | null
          projected_authority?: number
          projected_cluster_growth?: number
          projected_decay_risk?: number
          projected_execution_cost?: number
          projected_operational_load?: number
          projected_readiness?: number
          projected_resilience?: number
          projected_revenue_intent?: number
          projected_risk?: number
          projected_roi?: number
          projected_semantic_coverage?: number
          projected_sustainability?: number
          projected_time_to_impact?: number
          scenario_type: string
          simulation_name: string
          simulation_result?: Json
          simulation_type: string
          updated_at?: string
        }
        Update: {
          assumptions?: Json
          confidence_score?: number
          created_at?: string
          entities?: Json
          execution_complexity?: string
          id?: string
          notes?: string | null
          projected_authority?: number
          projected_cluster_growth?: number
          projected_decay_risk?: number
          projected_execution_cost?: number
          projected_operational_load?: number
          projected_readiness?: number
          projected_resilience?: number
          projected_revenue_intent?: number
          projected_risk?: number
          projected_roi?: number
          projected_semantic_coverage?: number
          projected_sustainability?: number
          projected_time_to_impact?: number
          scenario_type?: string
          simulation_name?: string
          simulation_result?: Json
          simulation_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_structural_dependencies: {
        Row: {
          cascading_risk: number | null
          created_at: string
          dependency_strength: number | null
          dependency_type: string | null
          failure_impact: number | null
          fragility_score: number | null
          id: string
          is_critical: boolean
          mitigation_strategy: string | null
          source_engine: string | null
          target_engine: string | null
        }
        Insert: {
          cascading_risk?: number | null
          created_at?: string
          dependency_strength?: number | null
          dependency_type?: string | null
          failure_impact?: number | null
          fragility_score?: number | null
          id?: string
          is_critical?: boolean
          mitigation_strategy?: string | null
          source_engine?: string | null
          target_engine?: string | null
        }
        Update: {
          cascading_risk?: number | null
          created_at?: string
          dependency_strength?: number | null
          dependency_type?: string | null
          failure_impact?: number | null
          fragility_score?: number | null
          id?: string
          is_critical?: boolean
          mitigation_strategy?: string | null
          source_engine?: string | null
          target_engine?: string | null
        }
        Relationships: []
      }
      seo_system_finalization_snapshots: {
        Row: {
          created_at: string
          dashboard_noise_score: number | null
          dependency_complexity_score: number | null
          documentation_completeness_score: number | null
          executive_clarity_score: number | null
          finalization_confidence_score: number | null
          governance_integrity_score: number | null
          governance_overhead_score: number | null
          id: string
          maintainability_score: number | null
          notes: string | null
          observability_efficiency_score: number | null
          operational_drag_score: number | null
          operational_overload_score: number | null
          operational_simplicity_score: number | null
          performance_pressure_score: number | null
          runtime_stability_score: number | null
          scalability_risk_score: number | null
          scalability_score: number | null
          signal_efficiency_score: number | null
          simplification_readiness_score: number | null
          strategic_friction_score: number | null
          telemetry_density_score: number | null
          telemetry_efficiency_score: number | null
        }
        Insert: {
          created_at?: string
          dashboard_noise_score?: number | null
          dependency_complexity_score?: number | null
          documentation_completeness_score?: number | null
          executive_clarity_score?: number | null
          finalization_confidence_score?: number | null
          governance_integrity_score?: number | null
          governance_overhead_score?: number | null
          id?: string
          maintainability_score?: number | null
          notes?: string | null
          observability_efficiency_score?: number | null
          operational_drag_score?: number | null
          operational_overload_score?: number | null
          operational_simplicity_score?: number | null
          performance_pressure_score?: number | null
          runtime_stability_score?: number | null
          scalability_risk_score?: number | null
          scalability_score?: number | null
          signal_efficiency_score?: number | null
          simplification_readiness_score?: number | null
          strategic_friction_score?: number | null
          telemetry_density_score?: number | null
          telemetry_efficiency_score?: number | null
        }
        Update: {
          created_at?: string
          dashboard_noise_score?: number | null
          dependency_complexity_score?: number | null
          documentation_completeness_score?: number | null
          executive_clarity_score?: number | null
          finalization_confidence_score?: number | null
          governance_integrity_score?: number | null
          governance_overhead_score?: number | null
          id?: string
          maintainability_score?: number | null
          notes?: string | null
          observability_efficiency_score?: number | null
          operational_drag_score?: number | null
          operational_overload_score?: number | null
          operational_simplicity_score?: number | null
          performance_pressure_score?: number | null
          runtime_stability_score?: number | null
          scalability_risk_score?: number | null
          scalability_score?: number | null
          signal_efficiency_score?: number | null
          simplification_readiness_score?: number | null
          strategic_friction_score?: number | null
          telemetry_density_score?: number | null
          telemetry_efficiency_score?: number | null
        }
        Relationships: []
      }
      seo_system_health_snapshots: {
        Row: {
          authority_efficiency: number
          cluster_stability: number
          competitive_pressure: number
          content_decay_pressure: number
          created_at: string
          execution_efficiency: number
          execution_focus: number
          execution_noise: number
          id: string
          notes: string | null
          operational_waste: number
          orphan_pressure: number
          recovery_backlog: number
          saturation_pressure: number
          semantic_efficiency: number
          semantic_fragmentation: number
          snapshot_date: string
          strategic_alignment: number
          sustainability_score: number
          system_health_score: number
          system_resilience: number
          volatility_pressure: number
        }
        Insert: {
          authority_efficiency?: number
          cluster_stability?: number
          competitive_pressure?: number
          content_decay_pressure?: number
          created_at?: string
          execution_efficiency?: number
          execution_focus?: number
          execution_noise?: number
          id?: string
          notes?: string | null
          operational_waste?: number
          orphan_pressure?: number
          recovery_backlog?: number
          saturation_pressure?: number
          semantic_efficiency?: number
          semantic_fragmentation?: number
          snapshot_date?: string
          strategic_alignment?: number
          sustainability_score?: number
          system_health_score?: number
          system_resilience?: number
          volatility_pressure?: number
        }
        Update: {
          authority_efficiency?: number
          cluster_stability?: number
          competitive_pressure?: number
          content_decay_pressure?: number
          created_at?: string
          execution_efficiency?: number
          execution_focus?: number
          execution_noise?: number
          id?: string
          notes?: string | null
          operational_waste?: number
          orphan_pressure?: number
          recovery_backlog?: number
          saturation_pressure?: number
          semantic_efficiency?: number
          semantic_fragmentation?: number
          snapshot_date?: string
          strategic_alignment?: number
          sustainability_score?: number
          system_health_score?: number
          system_resilience?: number
          volatility_pressure?: number
        }
        Relationships: []
      }
      seo_systemic_risk_registry: {
        Row: {
          affected_systems: Json | null
          collapse_probability: number | null
          created_at: string
          description: string | null
          id: string
          mitigation_complexity: number | null
          propagation_probability: number | null
          resilience_impact: number | null
          resolved: boolean
          risk_severity: string | null
          risk_type: string | null
          suggested_action: string | null
        }
        Insert: {
          affected_systems?: Json | null
          collapse_probability?: number | null
          created_at?: string
          description?: string | null
          id?: string
          mitigation_complexity?: number | null
          propagation_probability?: number | null
          resilience_impact?: number | null
          resolved?: boolean
          risk_severity?: string | null
          risk_type?: string | null
          suggested_action?: string | null
        }
        Update: {
          affected_systems?: Json | null
          collapse_probability?: number | null
          created_at?: string
          description?: string | null
          id?: string
          mitigation_complexity?: number | null
          propagation_probability?: number | null
          resilience_impact?: number | null
          resolved?: boolean
          risk_severity?: string | null
          risk_type?: string | null
          suggested_action?: string | null
        }
        Relationships: []
      }
      seo_unified_bus_snapshots: {
        Row: {
          anomaly_score: number
          anomaly_signature: Json
          authority_signature: Json
          coherence_score: number
          continuity_signature: Json
          created_at: string
          entropy_score: number
          explainability_signature: Json
          future_viability_score: number
          governance_score: number
          governance_signature: Json
          id: string
          intelligence_signature: Json
          kernel_score: number
          notes: string | null
          observability_score: number
          operational_signature: Json
          resilience_score: number
          resilience_signature: Json
          semantic_signature: Json
          system_consistency_score: number
        }
        Insert: {
          anomaly_score?: number
          anomaly_signature?: Json
          authority_signature?: Json
          coherence_score?: number
          continuity_signature?: Json
          created_at?: string
          entropy_score?: number
          explainability_signature?: Json
          future_viability_score?: number
          governance_score?: number
          governance_signature?: Json
          id?: string
          intelligence_signature?: Json
          kernel_score?: number
          notes?: string | null
          observability_score?: number
          operational_signature?: Json
          resilience_score?: number
          resilience_signature?: Json
          semantic_signature?: Json
          system_consistency_score?: number
        }
        Update: {
          anomaly_score?: number
          anomaly_signature?: Json
          authority_signature?: Json
          coherence_score?: number
          continuity_signature?: Json
          created_at?: string
          entropy_score?: number
          explainability_signature?: Json
          future_viability_score?: number
          governance_score?: number
          governance_signature?: Json
          id?: string
          intelligence_signature?: Json
          kernel_score?: number
          notes?: string | null
          observability_score?: number
          operational_signature?: Json
          resilience_score?: number
          resilience_signature?: Json
          semantic_signature?: Json
          system_consistency_score?: number
        }
        Relationships: []
      }
      seo_unified_nexus_snapshots: {
        Row: {
          continuity_alignment_score: number | null
          created_at: string
          dominant_systemic_risk: string | null
          dominant_systemic_signal: string | null
          executive_clarity_score: number | null
          executive_entropy_score: number | null
          governance_stability_score: number | null
          id: string
          nexus_verdict: string | null
          notes: string | null
          operational_disruption_score: number | null
          operational_harmony_score: number | null
          resilience_unification_score: number | null
          semantic_alignment_score: number | null
          semantic_divergence_score: number | null
          strategic_instability_score: number | null
          strategic_truth_score: number | null
          strategic_unification_score: number | null
          systemic_coherence_score: number | null
          systemic_fragmentation_score: number | null
          unified_nexus_score: number | null
        }
        Insert: {
          continuity_alignment_score?: number | null
          created_at?: string
          dominant_systemic_risk?: string | null
          dominant_systemic_signal?: string | null
          executive_clarity_score?: number | null
          executive_entropy_score?: number | null
          governance_stability_score?: number | null
          id?: string
          nexus_verdict?: string | null
          notes?: string | null
          operational_disruption_score?: number | null
          operational_harmony_score?: number | null
          resilience_unification_score?: number | null
          semantic_alignment_score?: number | null
          semantic_divergence_score?: number | null
          strategic_instability_score?: number | null
          strategic_truth_score?: number | null
          strategic_unification_score?: number | null
          systemic_coherence_score?: number | null
          systemic_fragmentation_score?: number | null
          unified_nexus_score?: number | null
        }
        Update: {
          continuity_alignment_score?: number | null
          created_at?: string
          dominant_systemic_risk?: string | null
          dominant_systemic_signal?: string | null
          executive_clarity_score?: number | null
          executive_entropy_score?: number | null
          governance_stability_score?: number | null
          id?: string
          nexus_verdict?: string | null
          notes?: string | null
          operational_disruption_score?: number | null
          operational_harmony_score?: number | null
          resilience_unification_score?: number | null
          semantic_alignment_score?: number | null
          semantic_divergence_score?: number | null
          strategic_instability_score?: number | null
          strategic_truth_score?: number | null
          strategic_unification_score?: number | null
          systemic_coherence_score?: number | null
          systemic_fragmentation_score?: number | null
          unified_nexus_score?: number | null
        }
        Relationships: []
      }
      seo_url_status: {
        Row: {
          alerted: boolean
          checked_at: string
          coverage_state: string | null
          google_canonical: string | null
          has_issue: boolean
          id: string
          indexing_state: string | null
          last_crawl_time: string | null
          page_fetch_state: string | null
          raw: Json | null
          referring_urls: Json | null
          robots_txt_state: string | null
          url: string
          user_canonical: string | null
          verdict: string | null
        }
        Insert: {
          alerted?: boolean
          checked_at?: string
          coverage_state?: string | null
          google_canonical?: string | null
          has_issue?: boolean
          id?: string
          indexing_state?: string | null
          last_crawl_time?: string | null
          page_fetch_state?: string | null
          raw?: Json | null
          referring_urls?: Json | null
          robots_txt_state?: string | null
          url: string
          user_canonical?: string | null
          verdict?: string | null
        }
        Update: {
          alerted?: boolean
          checked_at?: string
          coverage_state?: string | null
          google_canonical?: string | null
          has_issue?: boolean
          id?: string
          indexing_state?: string | null
          last_crawl_time?: string | null
          page_fetch_state?: string | null
          raw?: Json | null
          referring_urls?: Json | null
          robots_txt_state?: string | null
          url?: string
          user_canonical?: string | null
          verdict?: string | null
        }
        Relationships: []
      }
      shipping_audit_logs: {
        Row: {
          cart_snapshot: Json | null
          created_at: string
          destination_zip: string | null
          error_message: string | null
          estimated: boolean | null
          event_type: string
          http_status: number | null
          id: string
          melhor_envio_has_key: boolean | null
          provider_name: string | null
          total_weight_kg: number | null
        }
        Insert: {
          cart_snapshot?: Json | null
          created_at?: string
          destination_zip?: string | null
          error_message?: string | null
          estimated?: boolean | null
          event_type?: string
          http_status?: number | null
          id?: string
          melhor_envio_has_key?: boolean | null
          provider_name?: string | null
          total_weight_kg?: number | null
        }
        Update: {
          cart_snapshot?: Json | null
          created_at?: string
          destination_zip?: string | null
          error_message?: string | null
          estimated?: boolean | null
          event_type?: string
          http_status?: number | null
          id?: string
          melhor_envio_has_key?: boolean | null
          provider_name?: string | null
          total_weight_kg?: number | null
        }
        Relationships: []
      }
      shipping_providers: {
        Row: {
          api_key: string | null
          api_secret: string | null
          config_json: Json
          created_at: string
          endpoint_url: string | null
          id: string
          is_active: boolean
          provider_code: string
          provider_name: string
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          api_secret?: string | null
          config_json?: Json
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          provider_code: string
          provider_name: string
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          api_secret?: string | null
          config_json?: Json
          created_at?: string
          endpoint_url?: string | null
          id?: string
          is_active?: boolean
          provider_code?: string
          provider_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipping_quote_cache: {
        Row: {
          cache_key: string
          created_at: string
          options: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          options: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          options?: Json
        }
        Relationships: []
      }
      shipping_rules: {
        Row: {
          condition_type: Database["public"]["Enums"]["shipping_condition_type"]
          condition_value: Json
          created_at: string
          discount_type: Database["public"]["Enums"]["shipping_discount_type"]
          discount_value: number
          id: string
          is_active: boolean
          priority: number
          rule_name: string
          updated_at: string
        }
        Insert: {
          condition_type: Database["public"]["Enums"]["shipping_condition_type"]
          condition_value?: Json
          created_at?: string
          discount_type: Database["public"]["Enums"]["shipping_discount_type"]
          discount_value?: number
          id?: string
          is_active?: boolean
          priority?: number
          rule_name: string
          updated_at?: string
        }
        Update: {
          condition_type?: Database["public"]["Enums"]["shipping_condition_type"]
          condition_value?: Json
          created_at?: string
          discount_type?: Database["public"]["Enums"]["shipping_discount_type"]
          discount_value?: number
          id?: string
          is_active?: boolean
          priority?: number
          rule_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipping_settings: {
        Row: {
          created_at: string
          default_box_height_cm: number
          default_box_length_cm: number
          default_box_weight_kg: number
          default_box_width_cm: number
          free_shipping_enabled: boolean
          free_shipping_threshold: number
          handling_fee: number
          id: string
          is_enabled: boolean
          origin_zip_code: string
          pickup_address: string
          pickup_enabled: boolean
          pickup_instructions: string
          pickup_label: string
          shipping_markup_percentage: number
          singleton: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_box_height_cm?: number
          default_box_length_cm?: number
          default_box_weight_kg?: number
          default_box_width_cm?: number
          free_shipping_enabled?: boolean
          free_shipping_threshold?: number
          handling_fee?: number
          id?: string
          is_enabled?: boolean
          origin_zip_code?: string
          pickup_address?: string
          pickup_enabled?: boolean
          pickup_instructions?: string
          pickup_label?: string
          shipping_markup_percentage?: number
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_box_height_cm?: number
          default_box_length_cm?: number
          default_box_weight_kg?: number
          default_box_width_cm?: number
          free_shipping_enabled?: boolean
          free_shipping_threshold?: number
          handling_fee?: number
          id?: string
          is_enabled?: boolean
          origin_zip_code?: string
          pickup_address?: string
          pickup_enabled?: boolean
          pickup_instructions?: string
          pickup_label?: string
          shipping_markup_percentage?: number
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      social_proof_settings: {
        Row: {
          created_at: string
          dismiss_persistence: string
          excluded_paths: string[]
          id: boolean
          included_paths: string[]
          initial_delay_ms: number
          interval_ms: number
          is_enabled: boolean
          min_rating: number
          pool_size: number
          position: string
          require_verified: boolean
          show_on_desktop: boolean
          show_on_mobile: boolean
          updated_at: string
          visible_ms: number
        }
        Insert: {
          created_at?: string
          dismiss_persistence?: string
          excluded_paths?: string[]
          id?: boolean
          included_paths?: string[]
          initial_delay_ms?: number
          interval_ms?: number
          is_enabled?: boolean
          min_rating?: number
          pool_size?: number
          position?: string
          require_verified?: boolean
          show_on_desktop?: boolean
          show_on_mobile?: boolean
          updated_at?: string
          visible_ms?: number
        }
        Update: {
          created_at?: string
          dismiss_persistence?: string
          excluded_paths?: string[]
          id?: boolean
          included_paths?: string[]
          initial_delay_ms?: number
          interval_ms?: number
          is_enabled?: boolean
          min_rating?: number
          pool_size?: number
          position?: string
          require_verified?: boolean
          show_on_desktop?: boolean
          show_on_mobile?: boolean
          updated_at?: string
          visible_ms?: number
        }
        Relationships: []
      }
      stale_bundle_logs: {
        Row: {
          id: string
          message: string | null
          occurred_at: string
          reloaded: boolean
          route: string | null
          stack: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          message?: string | null
          occurred_at?: string
          reloaded?: boolean
          route?: string | null
          stack?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          message?: string | null
          occurred_at?: string
          reloaded?: boolean
          route?: string | null
          stack?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      tags: {
        Row: {
          created_at: string | null
          external_ref: string
          id: string
          name: string
          position: number
          slug: string
        }
        Insert: {
          created_at?: string | null
          external_ref: string
          id?: string
          name: string
          position?: number
          slug: string
        }
        Update: {
          created_at?: string | null
          external_ref?: string
          id?: string
          name?: string
          position?: number
          slug?: string
        }
        Relationships: []
      }
      telemetry_alert_state: {
        Row: {
          id: string
          last_alert_at: string | null
          last_count: number | null
          updated_at: string
        }
        Insert: {
          id: string
          last_alert_at?: string | null
          last_count?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          last_alert_at?: string | null
          last_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          created_at: string
          customer_name: string
          customer_text: string
          id: string
          is_visible: boolean
          occasion: string | null
          position: number
          product_name: string | null
          rating: number
          testimonial_date: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_text: string
          id?: string
          is_visible?: boolean
          occasion?: string | null
          position?: number
          product_name?: string | null
          rating?: number
          testimonial_date?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_text?: string
          id?: string
          is_visible?: boolean
          occasion?: string | null
          position?: number
          product_name?: string | null
          rating?: number
          testimonial_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      theme_hubs: {
        Row: {
          authority_score: number
          cannibalization_risk: string
          created_at: string
          discovery_status: string
          editorial_content: string | null
          faqs: Json
          hero_image_url: string | null
          id: string
          internal_links_count: number
          intro: string | null
          is_approved: boolean
          is_indexed: boolean
          last_authority_refresh: string | null
          last_evaluated_at: string | null
          meta_description: string | null
          meta_title: string | null
          notes: string | null
          readiness_score: number
          related_occasions: string[]
          related_posts: string[]
          related_segments: string[]
          related_themes: string[]
          slug: string
          tag_id: string | null
          thin_content_risk: boolean
          title: string
          topical_coverage: number
          updated_at: string
        }
        Insert: {
          authority_score?: number
          cannibalization_risk?: string
          created_at?: string
          discovery_status?: string
          editorial_content?: string | null
          faqs?: Json
          hero_image_url?: string | null
          id?: string
          internal_links_count?: number
          intro?: string | null
          is_approved?: boolean
          is_indexed?: boolean
          last_authority_refresh?: string | null
          last_evaluated_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          notes?: string | null
          readiness_score?: number
          related_occasions?: string[]
          related_posts?: string[]
          related_segments?: string[]
          related_themes?: string[]
          slug: string
          tag_id?: string | null
          thin_content_risk?: boolean
          title: string
          topical_coverage?: number
          updated_at?: string
        }
        Update: {
          authority_score?: number
          cannibalization_risk?: string
          created_at?: string
          discovery_status?: string
          editorial_content?: string | null
          faqs?: Json
          hero_image_url?: string | null
          id?: string
          internal_links_count?: number
          intro?: string | null
          is_approved?: boolean
          is_indexed?: boolean
          last_authority_refresh?: string | null
          last_evaluated_at?: string | null
          meta_description?: string | null
          meta_title?: string | null
          notes?: string | null
          readiness_score?: number
          related_occasions?: string[]
          related_posts?: string[]
          related_segments?: string[]
          related_themes?: string[]
          slug?: string
          tag_id?: string | null
          thin_content_risk?: boolean
          title?: string
          topical_coverage?: number
          updated_at?: string
        }
        Relationships: []
      }
      tracking_email_log: {
        Row: {
          created_at: string
          email_type: string
          error_message: string | null
          id: string
          new_status: string | null
          order_code: string
          order_id: string
          recipient_email: string | null
          status: string
          tracking_carrier: string | null
          tracking_code: string | null
          tracking_url: string | null
          triggered_by: string | null
          triggered_by_email: string | null
        }
        Insert: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          new_status?: string | null
          order_code: string
          order_id: string
          recipient_email?: string | null
          status?: string
          tracking_carrier?: string | null
          tracking_code?: string | null
          tracking_url?: string | null
          triggered_by?: string | null
          triggered_by_email?: string | null
        }
        Update: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          id?: string
          new_status?: string | null
          order_code?: string
          order_id?: string
          recipient_email?: string | null
          status?: string
          tracking_carrier?: string | null
          tracking_code?: string | null
          tracking_url?: string | null
          triggered_by?: string | null
          triggered_by_email?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitor_pageviews: {
        Row: {
          cta_id: string | null
          event_type: string
          from_path: string | null
          id: string
          path: string
          product_id: string | null
          referrer: string | null
          scroll_depth_pct: number | null
          session_id: string | null
          step_index: number | null
          time_on_page_seconds: number
          title: string | null
          viewed_at: string
          visitor_id: string
        }
        Insert: {
          cta_id?: string | null
          event_type?: string
          from_path?: string | null
          id?: string
          path: string
          product_id?: string | null
          referrer?: string | null
          scroll_depth_pct?: number | null
          session_id?: string | null
          step_index?: number | null
          time_on_page_seconds?: number
          title?: string | null
          viewed_at?: string
          visitor_id: string
        }
        Update: {
          cta_id?: string | null
          event_type?: string
          from_path?: string | null
          id?: string
          path?: string
          product_id?: string | null
          referrer?: string | null
          scroll_depth_pct?: number | null
          session_id?: string | null
          step_index?: number | null
          time_on_page_seconds?: number
          title?: string | null
          viewed_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_pageviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_pageviews_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "visitor_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_pageviews_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["visitor_id"]
          },
        ]
      }
      visitor_sessions: {
        Row: {
          created_at: string
          duration_seconds: number
          ended_at: string | null
          id: string
          ip: unknown
          landing_path: string | null
          pages_count: number
          referrer: string | null
          started_at: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          ip?: unknown
          landing_path?: string | null
          pages_count?: number
          referrer?: string | null
          started_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          ip?: unknown
          landing_path?: string | null
          pages_count?: number
          referrer?: string | null
          started_at?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_sessions_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["visitor_id"]
          },
        ]
      }
      visitors: {
        Row: {
          bot_name: string | null
          browser_name: string | null
          browser_version: string | null
          color_depth: number | null
          consent_at: string | null
          consent_status: string
          created_at: string
          customer_id: string | null
          device_brand: string | null
          device_model: string | null
          device_type: string | null
          first_landing_path: string | null
          first_referrer: string | null
          first_seen_at: string
          gps_accuracy: number | null
          gps_captured_at: string | null
          gps_lat: number | null
          gps_lon: number | null
          id: string
          ip: unknown
          ip_asn: string | null
          ip_city: string | null
          ip_country: string | null
          ip_isp: string | null
          ip_lat: number | null
          ip_lon: number | null
          ip_region: string | null
          ip_timezone: string | null
          is_bot: boolean
          language: string | null
          languages: string[] | null
          last_seen_at: string
          lead_promoted_at: string | null
          lead_status: string
          lead_trigger: string | null
          os_name: string | null
          os_version: string | null
          pixel_ratio: number | null
          screen_h: number | null
          screen_w: number | null
          timezone: string | null
          total_pageviews: number
          total_sessions: number
          total_time_seconds: number
          touch_support: boolean | null
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          viewport_h: number | null
          viewport_w: number | null
          visitor_id: string
          whatsapp_phone: string | null
        }
        Insert: {
          bot_name?: string | null
          browser_name?: string | null
          browser_version?: string | null
          color_depth?: number | null
          consent_at?: string | null
          consent_status?: string
          created_at?: string
          customer_id?: string | null
          device_brand?: string | null
          device_model?: string | null
          device_type?: string | null
          first_landing_path?: string | null
          first_referrer?: string | null
          first_seen_at?: string
          gps_accuracy?: number | null
          gps_captured_at?: string | null
          gps_lat?: number | null
          gps_lon?: number | null
          id?: string
          ip?: unknown
          ip_asn?: string | null
          ip_city?: string | null
          ip_country?: string | null
          ip_isp?: string | null
          ip_lat?: number | null
          ip_lon?: number | null
          ip_region?: string | null
          ip_timezone?: string | null
          is_bot?: boolean
          language?: string | null
          languages?: string[] | null
          last_seen_at?: string
          lead_promoted_at?: string | null
          lead_status?: string
          lead_trigger?: string | null
          os_name?: string | null
          os_version?: string | null
          pixel_ratio?: number | null
          screen_h?: number | null
          screen_w?: number | null
          timezone?: string | null
          total_pageviews?: number
          total_sessions?: number
          total_time_seconds?: number
          touch_support?: boolean | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          viewport_h?: number | null
          viewport_w?: number | null
          visitor_id: string
          whatsapp_phone?: string | null
        }
        Update: {
          bot_name?: string | null
          browser_name?: string | null
          browser_version?: string | null
          color_depth?: number | null
          consent_at?: string | null
          consent_status?: string
          created_at?: string
          customer_id?: string | null
          device_brand?: string | null
          device_model?: string | null
          device_type?: string | null
          first_landing_path?: string | null
          first_referrer?: string | null
          first_seen_at?: string
          gps_accuracy?: number | null
          gps_captured_at?: string | null
          gps_lat?: number | null
          gps_lon?: number | null
          id?: string
          ip?: unknown
          ip_asn?: string | null
          ip_city?: string | null
          ip_country?: string | null
          ip_isp?: string | null
          ip_lat?: number | null
          ip_lon?: number | null
          ip_region?: string | null
          ip_timezone?: string | null
          is_bot?: boolean
          language?: string | null
          languages?: string[] | null
          last_seen_at?: string
          lead_promoted_at?: string | null
          lead_status?: string
          lead_trigger?: string | null
          os_name?: string | null
          os_version?: string | null
          pixel_ratio?: number | null
          screen_h?: number | null
          screen_w?: number | null
          timezone?: string | null
          total_pageviews?: number
          total_sessions?: number
          total_time_seconds?: number
          touch_support?: boolean | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          viewport_h?: number | null
          viewport_w?: number | null
          visitor_id?: string
          whatsapp_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitors_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitors_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_audit_timeline: {
        Row: {
          actor_email: string | null
          created_at: string | null
          details: string | null
          event_id: string | null
          role: string | null
          source: string | null
          status: string | null
          target_email: string | null
          target_user_id: string | null
        }
        Relationships: []
      }
      customer_overview: {
        Row: {
          city: string | null
          created_at: string | null
          email: string | null
          id: string | null
          last_order_at: string | null
          last_seen_at: string | null
          name: string | null
          notes: string | null
          phone: string | null
          source: string | null
          state: string | null
          status: string | null
          tags: string[] | null
          total_orders: number | null
          total_spent: number | null
          updated_at: string | null
          visit_count: number | null
          whatsapp: string | null
        }
        Relationships: []
      }
      product_review_stats: {
        Row: {
          avg_rating: number | null
          product_id: string | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      search_insights_summary: {
        Row: {
          last_searched_at: string | null
          last_suggestion: string | null
          term_normalized: string | null
          total_searches: number | null
          zero_result_count: number | null
        }
        Relationships: []
      }
      taxonomy_registry: {
        Row: {
          canonical_path: string | null
          id: string | null
          image_url: string | null
          is_indexed: boolean | null
          name: string | null
          position: number | null
          slug: string | null
          type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_audit_anomalies: {
        Args: { _threshold?: number; _window_hours?: number }
        Returns: Json
      }
      apply_default_weight: { Args: { _default_kg?: number }; Returns: Json }
      audit_system_dump: { Args: never; Returns: Json }
      check_resend_email_cooldown: {
        Args: { _order_id: string }
        Returns: Json
      }
      cleanup_pdp_badge_events: { Args: never; Returns: undefined }
      cleanup_pdp_funnel_events: { Args: never; Returns: undefined }
      cleanup_seo_url_status: { Args: never; Returns: undefined }
      cleanup_stale_bundle_logs: { Args: never; Returns: Json }
      create_order_with_items: {
        Args: { _items: Json; _order: Json }
        Returns: Json
      }
      gen_external_ref: {
        Args: { _fallback?: string; _prefix: string; _slug: string }
        Returns: string
      }
      get_unified_profile: {
        Args: { _id: string; _kind: string }
        Returns: Json
      }
      get_unified_timeline: {
        Args: { _limit?: number; _visitor_ids: string[] }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_admin_audit_timeline: {
        Args: {
          _from?: string
          _limit?: number
          _offset?: number
          _search?: string
          _sort_dir?: string
          _sort_key?: string
          _source?: string
          _status?: string
          _to?: string
        }
        Returns: Json
      }
      list_all_users: {
        Args: { _role?: string; _search?: string }
        Returns: Json
      }
      list_all_users_paginated: {
        Args: {
          _ip?: string
          _limit?: number
          _offset?: number
          _role?: string
          _search?: string
          _sort_dir?: string
          _sort_key?: string
          _source?: string
          _whatsapp?: string
        }
        Returns: Json
      }
      list_contact_migration_audit: {
        Args: {
          _kind?: string
          _limit?: number
          _offset?: number
          _search?: string
          _status?: string
        }
        Returns: Json
      }
      list_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobid: number
          jobname: string
          schedule: string
        }[]
      }
      list_cron_runs: {
        Args: { p_limit?: number }
        Returns: {
          command: string
          database: string
          end_time: string
          job_pid: number
          jobid: number
          return_message: string
          runid: number
          start_time: string
          status: string
          username: string
        }[]
      }
      list_user_audit: {
        Args: {
          _email: string
          _from?: string
          _limit?: number
          _offset?: number
          _status?: string
          _to?: string
        }
        Returns: Json
      }
      log_search: {
        Args: { _q: string; _result_count: number; _suggestion?: string }
        Returns: undefined
      }
      mark_visitor_as_lead: {
        Args: { _trigger: string; _visitor_id: string }
        Returns: Json
      }
      migrate_customer_to_user_link: {
        Args: { _customer_id: string; _user_id: string }
        Returns: Json
      }
      migrate_visitor_to_customer: {
        Args: { _visitor_id: string }
        Returns: Json
      }
      normalize_phone_digits: { Args: { _v: string }; Returns: string }
      normalize_search: { Args: { _s: string }; Returns: string }
      normalize_slug: { Args: { _s: string }; Returns: string }
      pdp_badge_stats: { Args: { _from?: string; _to?: string }; Returns: Json }
      pdp_funnel_stats: {
        Args: { _from?: string; _to?: string }
        Returns: Json
      }
      promote_user_to_admin: { Args: { _email: string }; Returns: Json }
      record_product_slug_hit: { Args: { _slug: string }; Returns: undefined }
      refresh_admin_audit_timeline: { Args: never; Returns: Json }
      reject_admin_request: {
        Args: { _reason: string; _user_id: string }
        Returns: Json
      }
      request_admin_access: { Args: never; Returns: Json }
      resolve_product_slug: {
        Args: { _slug: string }
        Returns: {
          is_active: boolean
          is_primary: boolean
          matched_slug: string
          primary_slug: string
          product_id: string
        }[]
      }
      save_product_full: { Args: { _payload: Json }; Returns: Json }
      search_products: { Args: { _limit?: number; _q: string }; Returns: Json }
      set_user_role: {
        Args: { _action: string; _role: string; _user_id: string }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      track_heartbeat: {
        Args: {
          _delta_seconds: number
          _pageview_id: string
          _scroll_depth: number
          _visitor_id: string
        }
        Returns: undefined
      }
      track_pageview: {
        Args: {
          _cta_id?: string
          _event_type?: string
          _from_path?: string
          _path: string
          _product_slug: string
          _referrer: string
          _session_id: string
          _title: string
          _visitor_id: string
        }
        Returns: string
      }
      track_pdp_funnel_batch: { Args: { _events: Json }; Returns: undefined }
      unaccent: { Args: { "": string }; Returns: string }
      update_user_profile: {
        Args: { _full_name: string; _user_id: string }
        Returns: Json
      }
      users_source_counts: { Args: never; Returns: Json }
      validate_coupon: {
        Args: { _code: string; _subtotal: number }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user" | "editor" | "customer"
      kit_bundle_type: "suggested" | "curated" | "premium"
      payment_status: "pending" | "approved" | "refunded" | "cancelled"
      shipping_condition_type:
        | "min_cart_value"
        | "specific_state"
        | "zip_code_range"
      shipping_discount_type:
        | "free_shipping"
        | "fixed_discount"
        | "percentage_discount"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "editor", "customer"],
      kit_bundle_type: ["suggested", "curated", "premium"],
      payment_status: ["pending", "approved", "refunded", "cancelled"],
      shipping_condition_type: [
        "min_cart_value",
        "specific_state",
        "zip_code_range",
      ],
      shipping_discount_type: [
        "free_shipping",
        "fixed_discount",
        "percentage_discount",
      ],
    },
  },
} as const
