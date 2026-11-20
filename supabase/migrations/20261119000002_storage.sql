-- Buckets públicos de lectura para escudos y galería.
-- Límite por archivo: 2 MB (las imágenes se comprimen en el navegador antes de subir).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('escudos', 'escudos', true, 2097152, array['image/webp','image/png','image/jpeg']),
  ('galeria', 'galeria', true, 2097152, array['image/webp','image/jpeg'])
on conflict (id) do nothing;

create policy "lectura publica imagenes" on storage.objects for select
  using (bucket_id in ('escudos','galeria'));
create policy "organizador sube imagenes" on storage.objects for insert to authenticated
  with check (bucket_id in ('escudos','galeria') and public.is_organizer());
create policy "organizador actualiza imagenes" on storage.objects for update to authenticated
  using (bucket_id in ('escudos','galeria') and public.is_organizer());
create policy "organizador borra imagenes" on storage.objects for delete to authenticated
  using (bucket_id in ('escudos','galeria') and public.is_organizer());
