begin;
alter table public.blueprint_annotations drop constraint if exists blueprint_annotations_annotation_type_check;
alter table public.blueprint_annotations add constraint blueprint_annotations_annotation_type_check check (annotation_type in ('freehand','arrow','text','pin','calibration','distance','area','symbol','wall','locked_dimension'));
commit;
