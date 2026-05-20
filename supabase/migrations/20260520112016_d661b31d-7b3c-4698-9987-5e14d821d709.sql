
-- Vendors inventory (truncated/replaced on upload)
CREATE TABLE public.vendors (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain                text NOT NULL,
  main_niche            text,
  complementary_niche   text,
  indirect_niche        text,
  dr                    integer,
  traffic               integer,
  price                 numeric(10,2),
  geo                   text,
  link_type             text,
  tat                   integer,
  ranking               text,
  red_flags             text,
  contact_email         text,
  uploaded_at           timestamptz DEFAULT now()
);

CREATE TABLE public.scoring_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version         integer GENERATED ALWAYS AS IDENTITY,
  created_at      timestamptz DEFAULT now(),
  label           text,
  weights         jsonb NOT NULL,
  disqualifiers   jsonb NOT NULL,
  overrides       jsonb DEFAULT '{}',
  niche_prompt    text,
  is_active       boolean DEFAULT false
);

CREATE TABLE public.campaigns (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  client_name       text NOT NULL,
  client_niche      text NOT NULL,
  target_pages      jsonb NOT NULL,
  budget_per_link   numeric(10,2) NOT NULL,
  geo_focus         jsonb NOT NULL,
  link_preference   text NOT NULL,
  min_dr            integer NOT NULL DEFAULT 50,
  min_traffic       integer NOT NULL DEFAULT 3000,
  link_count_goal   integer NOT NULL,
  shortlist_size    integer NOT NULL DEFAULT 50,
  status            text NOT NULL DEFAULT 'scoring',
  scoring_config_id uuid REFERENCES public.scoring_config(id),
  vendor_snapshot   text
);

CREATE TABLE public.campaign_results (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  domain                text NOT NULL,
  score                 numeric(5,2),
  score_breakdown       jsonb,
  reasoning             text,
  dr                    integer,
  traffic               integer,
  geo                   text,
  price                 numeric(10,2),
  tat                   integer,
  link_type             text,
  ranking               text,
  red_flags             text,
  contact_email         text,
  included              boolean DEFAULT true,
  disqualified          boolean DEFAULT false,
  disqualify_reason     text,
  rank_position         integer
);

CREATE INDEX idx_campaign_results_campaign ON public.campaign_results(campaign_id);
CREATE INDEX idx_campaign_results_rank ON public.campaign_results(campaign_id, rank_position);

CREATE TABLE public.campaign_exports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  file_data    bytea NOT NULL
);

-- Lock down all tables: no client access. All access goes through server fns
-- using the service-role admin client. App is gated by a server-side password.
ALTER TABLE public.vendors          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_exports ENABLE ROW LEVEL SECURITY;

-- No policies = no access via anon/auth roles. Service role bypasses RLS.

-- Seed default scoring config
INSERT INTO public.scoring_config (label, weights, disqualifiers, overrides, niche_prompt, is_active)
VALUES (
  'Default — initial config',
  '{"niche_match":40,"domain_rating":15,"traffic":15,"price_efficiency":10,"ranking_bonus":10,"geo_match":5,"no_red_flags":5}',
  '{"ranking_excluded":["Poor","Bad"]}',
  '{"ecommerce":{"niche_match":50,"price_efficiency":5}}',
  null,
  true
);
