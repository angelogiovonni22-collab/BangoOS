-- Recommendation actors are historical company members, not a profile's
-- mutable current workspace. Deactivation may clear profiles.company_id.
-- Keep the actor identity and original tenant while requiring the membership.
alter table public.workforce_orion_recommendations
  drop constraint workforce_orion_recommendations_actor_company_fkey,
  add constraint workforce_orion_recommendations_actor_company_fkey
    foreign key (company_id, actor_profile_id)
    references public.company_memberships(company_id, user_id)
    on delete restrict,
  add constraint workforce_orion_recommendations_actor_profile_fkey
    foreign key (actor_profile_id) references public.profiles(id)
    on delete restrict;
