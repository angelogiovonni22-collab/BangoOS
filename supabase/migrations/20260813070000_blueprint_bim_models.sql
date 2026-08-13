begin;
update storage.buckets set file_size_limit=524288000,allowed_mime_types=array['application/pdf','image/jpeg','image/png','image/webp','model/gltf-binary','model/gltf+json','application/octet-stream','application/x-step'] where id='blueprints';
comment on table public.blueprint_versions is 'Private revision store for 2D sheets and IFC/GLB/GLTF BIM models.';
commit;
