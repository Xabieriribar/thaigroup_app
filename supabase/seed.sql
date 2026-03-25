insert into public.groups (id, code, name)
values ('11111111-1111-1111-1111-111111111111', 'THAI24', 'ThaiGroup Demo')
on conflict (id) do nothing;

insert into public.members (id, group_id, display_name, avatar, color)
values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Nina', '😎', '#fb7185'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Pau', '🌴', '#22d3ee')
on conflict (id) do nothing;

insert into public.locations (id, member_id, group_id, lat, lon, accuracy, created_at, source)
values
  ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 13.7563, 100.5018, 18, timezone('utc', now()) - interval '7 minutes', 'gps'),
  ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 13.7460, 100.5347, 23, timezone('utc', now()) - interval '2 minutes', 'manual')
on conflict (id) do nothing;
