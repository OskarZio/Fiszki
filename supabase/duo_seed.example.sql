-- Przykładowe dane dla duo mode (placeholdery). Prawdziwe karty trzymaj lokalnie w private/ (poza repozytorium).
insert into public.duo_cards (type, round, content) values
('reward', 1, 'Przykładowa nagroda'),
('reward', null, 'Przykładowa nagroda – każda runda'),
('forfeit', null, 'Przykładowy fant');
