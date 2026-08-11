alter table public.projects
  add column if not exists job_site_latitude double precision,
  add column if not exists job_site_longitude double precision,
  add column if not exists job_site_geocoded_at timestamptz,
  add column if not exists weather_postal_code_override text;

alter table public.projects
  drop constraint if exists projects_job_site_latitude_check,
  add constraint projects_job_site_latitude_check
    check (job_site_latitude is null or job_site_latitude between -90 and 90),
  drop constraint if exists projects_job_site_longitude_check,
  add constraint projects_job_site_longitude_check
    check (job_site_longitude is null or job_site_longitude between -180 and 180),
  drop constraint if exists projects_weather_postal_code_override_check,
  add constraint projects_weather_postal_code_override_check
    check (weather_postal_code_override is null or char_length(trim(weather_postal_code_override)) between 3 and 12);

comment on column public.projects.job_site_latitude is 'Normalized WGS84 latitude resolved server-side for jobsite location intelligence.';
comment on column public.projects.job_site_longitude is 'Normalized WGS84 longitude resolved server-side for jobsite location intelligence.';
comment on column public.projects.weather_postal_code_override is 'Optional jobsite weather postal-code override supplied by an authorized workspace user.';
