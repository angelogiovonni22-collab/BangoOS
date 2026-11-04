-- Preserve historical actor/tenant links when a profile's current company changes.
-- Memberships are retained after deactivation; referenced history cannot be deleted indirectly.
alter table public.workforce_orion_recommendation_history
  drop constraint workforce_orion_recommendation_history_actor_company_fkey,
  add constraint workforce_orion_recommendation_history_actor_company_fkey
    foreign key (company_id, actor_profile_id)
    references public.company_memberships(company_id, user_id)
    on delete restrict,
  add constraint workforce_recommendation_history_actor_profile_fkey
    foreign key (actor_profile_id) references public.profiles(id)
    on delete restrict;

alter table public.workforce_orion_recommendation_outcomes
  drop constraint workforce_orion_recommendation_outcomes_actor_company_fkey,
  add constraint workforce_orion_recommendation_outcomes_actor_company_fkey
    foreign key (company_id, actor_profile_id)
    references public.company_memberships(company_id, user_id)
    on delete restrict,
  add constraint workforce_recommendation_outcomes_actor_profile_fkey
    foreign key (actor_profile_id) references public.profiles(id)
    on delete restrict;

alter table public.workforce_orion_timeline_events
  drop constraint workforce_orion_timeline_events_actor_company_fkey,
  add constraint workforce_orion_timeline_events_actor_company_fkey
    foreign key (company_id, actor_profile_id)
    references public.company_memberships(company_id, user_id)
    on delete restrict,
  add constraint workforce_timeline_actor_profile_fkey
    foreign key (actor_profile_id) references public.profiles(id)
    on delete restrict;
