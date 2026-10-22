-- Curated catalogs, source URLs are stored on each row. No user records.


insert into public.military_ranks(id,name,position) values
('rekrut','Rekrut',0),
('soldat','Soldat',1),
('gefreiter','Gefreiter',2),
('obergefreiter','Obergefreiter',3),
('korporal','Korporal',4),
('wachtmeister','Wachtmeister',5),
('oberwachtmeister','Oberwachtmeister',6),
('feldweibel','Feldweibel',7),
('hauptfeldweibel','Hauptfeldweibel',8),
('fourier','Fourier',9),
('adjutant','Adjutant Unteroffizier',10),
('stabsadjutant','Stabsadjutant',11),
('hauptadjutant','Hauptadjutant',12),
('chefadjutant','Chefadjutant',13),
('leutnant','Leutnant',14),
('oberleutnant','Oberleutnant',15),
('hauptmann','Hauptmann',16),
('major','Major',17),
('oberstleutnant','Oberstleutnant',18),
('oberst','Oberst',19),
('brigadier','Brigadier',20),
('divisionaer','Divisionär',21),
('korpskommandant','Korpskommandant',22),
('general','General',23),
('fachoffizier','Fachoffizier',24)
on conflict(id) do update set name=excluded.name,position=excluded.position;

insert into public.military_branches(id,name) values
('infanterie','Infanterie'),
('panzer','Panzertruppen'),
('artillerie','Artillerie'),
('luftwaffe','Luftwaffe'),
('genie','Genietruppen'),
('rettung','Rettungstruppen'),
('logistik','Logistiktruppen'),
('sanitaet','Sanitätstruppen'),
('fuehrungsunterstuetzung','Führungsunterstützungstruppen'),
('abc','ABC-Abwehrtruppen'),
('militaerpolizei','Militärpolizei'),
('spezialkraefte','Spezialkräfte'),
('nachrichtendienst','Militärischer Nachrichtendienst'),
('seelsorge','Armeeseelsorge'),
('rotkreuzdienst','Rotkreuzdienst'),
('generalstab','Generalstabsdienst'),
('justiz','Militärjustiz'),
('territorial','Territorialdienst'),
('sozialdienst','Sozialdienst der Armee'),
('ppd','Psychologisch-Pädagogischer Dienst')
on conflict(id) do update set name=excluded.name;

insert into public.military_functions(id,name) values
('infanterist','Infanterist'),
('aufklaerer','Aufklärer'),
('grenadier','Grenadier'),
('panzergrenadier','Panzergrenadier'),
('panzersoldat','Panzersoldat'),
('artillerist','Artillerist'),
('geniesoldat','Geniesoldat'),
('rettungssoldat','Rettungssoldat'),
('sanitaetssoldat','Sanitätssoldat'),
('spitalsoldat','Spitalsoldat'),
('motorfahrer','Motorfahrer'),
('verkehrssoldat','Verkehrssoldat'),
('truppenkoch','Truppenkoch'),
('logistiksoldat','Logistiksoldat'),
('uebermittlungssoldat','Übermittlungssoldat'),
('abc-abwehrsoldat','ABC-Abwehrsoldat'),
('militaerpolizeisoldat','Militärpolizeisoldat'),
('bueroordonnanz','Büroordonnanz')
on conflict(id) do update set name=excluded.name;
