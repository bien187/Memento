-- Extend catalogs without changing existing profile/function identifiers.
alter table public.military_functions add column team text check (team in ('kampf','hilfe','unterstuetzung','technik'));
alter table public.military_branches add column insignia_url text;
create table public.military_barracks (
  id text primary key, name text not null, canton text not null check(char_length(canton)=2),
  school text not null, source_url text not null
);
create table public.military_function_barracks (
  function_id text not null references public.military_functions(id),
  barracks_id text not null references public.military_barracks(id),
  position integer not null check(position>=0),
  primary key(function_id,barracks_id)
);
do $$ declare t text; begin
  foreach t in array array['military_barracks','military_function_barracks'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('create policy catalog_read on public.%I for select using (true)',t);
    execute format('grant select on public.%I to anon, authenticated',t);
  end loop;
end $$;
alter table public.profiles add column barracks_id text references public.military_barracks(id);
alter table public.service_periods add column barracks_id text references public.military_barracks(id);

-- BEGIN GENERATED CATALOG
-- Generated from the app catalogs. User-supplied functions/locations; no user records.


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

insert into public.military_branches(id,name,insignia_url) values
('infanterie','Infanterie','/insignia/infanterie.svg'),
('panzer','Panzertruppen','/insignia/panzer.svg'),
('artillerie','Artillerie','/insignia/artillerie.svg'),
('luftwaffe','Luftwaffe / Fliegertruppen','/insignia/luftwaffe.svg'),
('fliegerabwehr','Fliegerabwehrtruppen','/insignia/fliegerabwehr.svg'),
('genie','Genietruppen','/insignia/genie.svg'),
('rettung','Rettungstruppen','/insignia/rettung.svg'),
('logistik','Logistiktruppen','/insignia/logistik.svg'),
('sanitaet','Sanitätstruppen','/insignia/sanitaet.svg'),
('fuehrungsunterstuetzung','Führungsunterstützungstruppen','/insignia/fuehrungsunterstuetzung.svg'),
('abc','ABC-Abwehrtruppen','/insignia/abc.svg'),
('militaerpolizei','Militärpolizei','/insignia/militaerpolizei.svg'),
('spezialkraefte','Spezialkräfte','/insignia/spezialkraefte.svg'),
('nachrichtendienst','Militärischer Nachrichtendienst','/insignia/nachrichtendienst.svg'),
('seelsorge','Armeeseelsorge','/insignia/seelsorge.svg'),
('rotkreuzdienst','Rotkreuzdienst','/insignia/rotkreuzdienst.svg'),
('generalstab','Generalstabsdienst','/insignia/generalstab.svg'),
('justiz','Militärjustiz','/insignia/justiz.svg'),
('territorial','Territorialdienst','/insignia/territorial.svg'),
('sozialdienst','Sozialdienst der Armee',null),
('ppd','Psychologisch-Pädagogischer Dienst','/insignia/ppd.svg'),
('bereitschaft','Bereitschaftsdienst','/insignia/bereitschaft.svg'),
('militaermusik','Militärmusik','/insignia/militaermusik.svg'),
('sport','Sport','/insignia/sport.svg'),
('armeefuehrung','Armeeführung','/insignia/armeefuehrung.svg')
on conflict(id) do update set name=excluded.name,insignia_url=excluded.insignia_url;

insert into public.military_functions(id,name,team,source_url) values
('artillerie-raupenfahrzeugfahrer','Artillerie Raupenfahrzeugfahrer/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('artillerist','Artillerie Soldat/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('aufklaerer','Aufklärer/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('besatzungssoldat','Besatzungssoldat/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('bootsschuetze','Bootsschütze/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('explorationsaufklaerer','Explorationsaufklärer/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('fallschirmaufklaerer','Fallschirmaufklärer/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('feuerleitsoldat','Feuerleitsoldat/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('fliegerabwehrkanonier','Fliegerabwehrkanonier/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('fliegerabwehr-lenkwaffensoldat','Fliegerabwehr-Lenkwaffensoldat/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('flugplatzsicherungssoldat','Flugplatzsicherungssoldat/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('grenadier','Grenadier/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('hundefuehrer','Hundeführer/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('infanteriebesatzer','Infanteriebesatzer/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('infanterie-spaeher','Infanterie Späher/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('infanterist','Infanterist/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('moerserkanonier','Mörserkanonier/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('militaerpolizeigrenadier','Militärpolizeigrenadier/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('panzersoldat','Panzerbesatzer/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('panzergrenadier','Panzergrenadier/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('scharfschuetze','Scharfschütze/-in','kampf','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('abc-abwehrsoldat','ABC-Abwehrsoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('abc-dekontaminationssoldat','ABC-Dekontaminationssoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('abc-labor-laborant','ABC-Labor-Laborant/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('abc-spuersoldat','ABC-Spürsoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('betreuungssoldat','Betreuungssoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('einsatzzentralensoldat','Einsatzzentralensoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('militaerpolizeisoldat','Militärpolizeisoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('operationstraktsoldat','Operationstraktsoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('patiententransportsoldat','Patiententransportsoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('pflegesoldat','Pflegesoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('physiotherapiesoldat','Physiotherapiesoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('rettungssoldat','Rettungssoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('sanitaetssoldat','Sanitätssoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('schutz-betreuungssoldat','Schutz- und Betreuungssoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('sicherungssoldat','Sicherungssoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('spitalsoldat','Spitalsoldat/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('zivilschutzpionier','Zivilschutzpionier/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('zivilschutzbetreuer','Zivilschutzbetreuer/-in','hilfe','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('armeespiel-orchester-musiker','Armeespiel-Orchester-Musiker/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('armeespiel-tambour','Armeespiel-Tambour/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('betriebssoldat','Betriebssoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('bunkersoldat','Bunkersoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('bueroordonnanz','Büroordonnanz','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('ersatzteillogistiksoldat','Ersatzteillogistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('flugplatzlogistiksoldat','Flugplatzlogistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('flugverkehrsleitungssoldat','Flugverkehrsleitungssoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('fuehrungsstaffelsoldat','Führungsstaffelsoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('hufschmied','Hufschmied/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('informationssoldat','Informationssoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('infrastruktursoldat','Infrastruktursoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('inland-einsatzsoldat','Inland-Einsatzsoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('kanzleisoldat','Kanzleisoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('kuechenlogistiksoldat','Küchenlogistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('lagermitarbeiter','Lagermitarbeiter/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('logistiksoldat','Logistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('materiallogistiksoldat','Materiallogistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('militaerbrieftraeger','Militärbriefträger/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('militaerhundefuehrer','Militärhundeführer/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('militaer-meteorologie-soldat','Militär-Meteorologie-Soldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('munitionslogistiksoldat','Munitionslogistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('postordonnanz','Postordonnanz','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('sanitaetslogistiksoldat','Sanitätslogistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('schneidereiordonnanz','Schneidereiordonnanz','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('schuhmacherordonnanz','Schuhmacherordonnanz','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('spitallogistiksoldat','Spitallogistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('sport-spitzensportler','Sport-Spitzensportler/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('stabskompanie-soldat','Stabskompanie-Soldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('stabsordonnanz','Stabsordonnanz','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('teilelogistiksoldat','Teilelogistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('transportlogistiksoldat','Transportlogistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('truppenbuchhalter','Truppenbuchhalter/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('truppenkoch','Truppenkoch / Truppenköchin','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('umschlaglogistiksoldat','Umschlaglogistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('verkehrssoldat','Verkehrssoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('verpflegungslogistiksoldat','Verpflegungslogistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('veterinaersoldat','Veterinärsoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('waffenlogistiksoldat','Waffenlogistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('wirtschaftsordonnanz','Wirtschaftsordonnanz','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('zentralenlogistiksoldat','Zentralenlogistiksoldat/-in','unterstuetzung','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('aggregatemechaniker','Aggregatemechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('artillerie-waffenmechaniker','Artillerie-Waffenmechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('baumaschinenfahrer','Baumaschinenfahrer/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('baumaschinenmechaniker','Baumaschinenmechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('bootstransporteur','Bootstransporteur/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('cybersoldat','Cybersoldat/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('drohnen-aufklaerersoldat','Drohnen-Aufklärersoldat/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('drohnen-bodenstationssoldat','Drohnen-Bodenstationssoldat/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('elektronik-mechaniker','Elektronik-Mechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('fahrzeugmechaniker','Fahrzeugmechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('fliegerabwehr-radarsoldat','Fliegerabwehr-Radarsoldat/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('flugzeugmechaniker','Flugzeugmechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('funkaufklaerer','Funkaufklärer/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('geniesoldat','Geniesoldat/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('helikoptermechaniker','Helikoptermechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('informatikpionier','Informatikpionier/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('infanterie-waffenmechaniker','Infanterie-Waffenmechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('ikt-infrastruktursoldat','IKT-Infrastruktursoldat/-in (Informations- und Kommunikationstechnologie)','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('kleinflugzeug-mechaniker','Kleinflugzeug-Mechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('kommunikationsaufklaerer','Kommunikationsaufklärer/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('motormechaniker','Motormechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('motorfahrer','Motorfahrer/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('panzersappeur','Panzersappeur/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('panzer-waffenmechaniker','Panzer-Waffenmechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('radar-elektronikpionier','Radar- und Elektronikpionier/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('raupenfahrzeugmechaniker','Raupenfahrzeugmechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('richtstrahlpionier','Richtstrahlpionier/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('sappeuren-maschinist','Sappeuren-Maschinist/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('sappeuren-pionier','Sappeuren-Pionier/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('satellitenkommunikations-soldat','Satellitenkommunikations-Soldat/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('schifffahrtssoldat','Schifffahrtssoldat/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('schweren-fahrzeug-mechaniker','Schweren-Fahrzeug-Mechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('software-spezialist','Software-Spezialist/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('spezialfahrzeugfahrer','Spezialfahrzeugfahrer/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('system-informatiksoldat','System-Informatiksoldat/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('telematiksoldat','Telematiksoldat/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('uebermittlungssoldat','Übermittlungssoldat/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('waffenwart','Waffenwart/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('wartungsmechaniker','Wartungsmechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('wartungssoldat','Wartungssoldat/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('weltraumsoldat','Weltraumsoldat/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('wetterradarsoldat','Wetterradarsoldat/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('werkstattmechaniker','Werkstattmechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('zentralenpionier','Zentralenpionier/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md'),
('zerspanungsmechaniker','Zerspanungsmechaniker/-in','technik','https://github.com/bien187/Memento/blob/main/docs/MILITARY_CATALOG.md')
on conflict(id) do update set name=excluded.name,team=excluded.team,source_url=excluded.source_url;

insert into public.military_barracks(id,name,canton,school,source_url) values
('aarau','Aarau','AG','Militärmusik-RS · Kompetenzzentrum Militärmusik','https://www.armee.ch/de/rekrutenschulen'),
('airolo','Airolo','TI','Sanitätsschulen 42','https://www.armee.ch/de/rekrutenschulen'),
('andermatt','Andermatt','UR','Kompetenzzentrum Gebirgsdienst','https://www.armee.ch/de/rekrutenschulen'),
('sand-schoenbuehl','Bern (Sand-Schönbühl)','BE','Kompetenzzentrum Veterinärdienst und Armeetiere','https://www.armee.ch/de/rekrutenschulen'),
('bern','Bern','BE','Höhere Unteroffizierslehrgänge 49 · Logistik-OS 40','https://www.armee.ch/de/rekrutenschulen'),
('biere','Bière','VD','Artillerie- und Aufklärungsschule 31','https://www.armee.ch/de/rekrutenschulen'),
('birmensdorf','Birmensdorf','ZH','Infanterie Durchdienerschule 14','https://www.armee.ch/de/rekrutenschulen'),
('bremgarten','Bremgarten','AG','Einsatz- und Ausbildungskommando Genie/Rettung 74','https://www.armee.ch/de/rekrutenschulen'),
('brugg','Brugg','AG','Genieschule 73','https://www.armee.ch/de/rekrutenschulen'),
('buelach','Bülach','ZH','Führungsunterstützungsschule 63 · FU-OS 30','https://www.armee.ch/de/rekrutenschulen'),
('chur','Chur','GR','Infanterieschule 12','https://www.armee.ch/de/rekrutenschulen'),
('colombier','Colombier','NE','Infanterieschule 2','https://www.armee.ch/de/rekrutenschulen'),
('duebendorf','Dübendorf','ZH','BODLUV-Schule 33 · Luftlagekompanie','https://www.armee.ch/de/rekrutenschulen'),
('emmen','Emmen','LU','BODLUV-Schule 33 · Pilotenschule 85 · OS der Luftwaffe','https://www.armee.ch/de/rekrutenschulen'),
('frauenfeld','Frauenfeld','TG','Informatikschule 61','https://www.armee.ch/de/rekrutenschulen'),
('grandvillard','Grandvillard','FR','BODLUV-Schule 33 · Leichte Flab-Lenkwaffenbatterie','https://www.armee.ch/de/rekrutenschulen'),
('isone','Isone','TI','Ausbildungszentrum Spezialkräfte','https://www.armee.ch/de/rekrutenschulen'),
('jassbach','Jassbach (Thun)','BE','Elektronische Operationen Schule 64','https://www.armee.ch/de/rekrutenschulen'),
('kloten','Kloten','ZH','Richtstrahlschule 62','https://www.armee.ch/de/rekrutenschulen'),
('liestal','Liestal','BL','Infanterie-Offiziersschule 10','https://www.armee.ch/de/rekrutenschulen'),
('magglingen','Magglingen','BE','Spitzensport-RS 79','https://www.armee.ch/de/rekrutenschulen'),
('moudon','Moudon','VD','Spitalschulen 41','https://www.armee.ch/de/rekrutenschulen'),
('payerne','Payerne','VD','Fliegerschule 81','https://www.armee.ch/de/rekrutenschulen'),
('romont','Romont','FR','Nachschubschulen 45','https://www.armee.ch/de/rekrutenschulen'),
('sion','Sion','VS','Infanterieschule 19 · Militärpolizeischule 19','https://www.armee.ch/de/rekrutenschulen'),
('spiez','Spiez','BE','ABC-Abwehrschule 77','https://www.armee.ch/de/rekrutenschulen'),
('st-gallen','St. Gallen','SG','Infanterieschule 11','https://www.armee.ch/de/rekrutenschulen'),
('thun','Thun','BE','Panzerschule 21 · Instandhaltungsschule 43 · Ausbildungszentrum Verpflegung · Pz/Art-OS 22','https://www.armee.ch/de/rekrutenschulen'),
('wangen','Wangen an der Aare','BE','Rettungsschule 75 · Verkehrs- und Transportschulen 47','https://www.armee.ch/de/rekrutenschulen')
on conflict(id) do update set name=excluded.name,canton=excluded.canton,school=excluded.school,source_url=excluded.source_url;

delete from public.military_function_barracks;

insert into public.military_function_barracks(function_id,barracks_id,position) values
('artillerie-raupenfahrzeugfahrer','biere',0),
('artillerist','biere',0),
('aufklaerer','biere',0),
('besatzungssoldat','thun',0),
('bootsschuetze','bremgarten',0),
('explorationsaufklaerer','biere',0),
('fallschirmaufklaerer','isone',0),
('feuerleitsoldat','biere',0),
('fliegerabwehrkanonier','emmen',0),
('fliegerabwehr-lenkwaffensoldat','grandvillard',0),
('flugplatzsicherungssoldat','payerne',0),
('grenadier','isone',0),
('hundefuehrer','sand-schoenbuehl',0),
('infanteriebesatzer','chur',0),
('infanteriebesatzer','colombier',1),
('infanteriebesatzer','sion',2),
('infanteriebesatzer','st-gallen',3),
('infanteriebesatzer','birmensdorf',4),
('infanterie-spaeher','chur',0),
('infanterist','chur',0),
('infanterist','colombier',1),
('infanterist','sion',2),
('infanterist','st-gallen',3),
('infanterist','birmensdorf',4),
('moerserkanonier','chur',0),
('militaerpolizeigrenadier','sion',0),
('panzersoldat','thun',0),
('panzergrenadier','thun',0),
('scharfschuetze','chur',0),
('scharfschuetze','isone',1),
('abc-abwehrsoldat','spiez',0),
('abc-dekontaminationssoldat','spiez',0),
('abc-labor-laborant','spiez',0),
('abc-spuersoldat','spiez',0),
('betreuungssoldat','bern',0),
('militaerpolizeisoldat','sion',0),
('operationstraktsoldat','moudon',0),
('patiententransportsoldat','airolo',0),
('patiententransportsoldat','moudon',1),
('pflegesoldat','moudon',0),
('physiotherapiesoldat','moudon',0),
('rettungssoldat','wangen',0),
('sanitaetssoldat','airolo',0),
('sicherungssoldat','chur',0),
('sicherungssoldat','thun',1),
('spitalsoldat','moudon',0),
('armeespiel-orchester-musiker','aarau',0),
('armeespiel-tambour','aarau',0),
('bueroordonnanz','bern',0),
('ersatzteillogistiksoldat','romont',0),
('flugplatzlogistiksoldat','payerne',0),
('flugverkehrsleitungssoldat','payerne',0),
('fuehrungsstaffelsoldat','frauenfeld',0),
('fuehrungsstaffelsoldat','thun',1),
('hufschmied','sand-schoenbuehl',0),
('kanzleisoldat','bern',0),
('kuechenlogistiksoldat','thun',0),
('lagermitarbeiter','romont',0),
('logistiksoldat','romont',0),
('materiallogistiksoldat','romont',0),
('militaerhundefuehrer','sand-schoenbuehl',0),
('munitionslogistiksoldat','romont',0),
('sanitaetslogistiksoldat','moudon',0),
('spitallogistiksoldat','moudon',0),
('sport-spitzensportler','magglingen',0),
('teilelogistiksoldat','romont',0),
('transportlogistiksoldat','wangen',0),
('truppenbuchhalter','bern',0),
('truppenkoch','thun',0),
('umschlaglogistiksoldat','romont',0),
('verkehrssoldat','wangen',0),
('verpflegungslogistiksoldat','thun',0),
('veterinaersoldat','sand-schoenbuehl',0),
('waffenlogistiksoldat','romont',0),
('zentralenlogistiksoldat','romont',0),
('aggregatemechaniker','thun',0),
('artillerie-waffenmechaniker','thun',0),
('baumaschinenfahrer','brugg',0),
('baumaschinenmechaniker','thun',0),
('bootstransporteur','bremgarten',0),
('cybersoldat','jassbach',0),
('drohnen-aufklaerersoldat','payerne',0),
('drohnen-bodenstationssoldat','payerne',0),
('elektronik-mechaniker','thun',0),
('fahrzeugmechaniker','thun',0),
('fliegerabwehr-radarsoldat','emmen',0),
('flugzeugmechaniker','payerne',0),
('funkaufklaerer','jassbach',0),
('geniesoldat','brugg',0),
('helikoptermechaniker','payerne',0),
('informatikpionier','frauenfeld',0),
('infanterie-waffenmechaniker','thun',0),
('ikt-infrastruktursoldat','frauenfeld',0),
('ikt-infrastruktursoldat','buelach',1),
('kleinflugzeug-mechaniker','payerne',0),
('kommunikationsaufklaerer','jassbach',0),
('motormechaniker','thun',0),
('motorfahrer','wangen',0),
('panzersappeur','thun',0),
('panzer-waffenmechaniker','thun',0),
('radar-elektronikpionier','emmen',0),
('raupenfahrzeugmechaniker','thun',0),
('richtstrahlpionier','kloten',0),
('sappeuren-maschinist','brugg',0),
('sappeuren-pionier','brugg',0),
('satellitenkommunikations-soldat','buelach',0),
('schifffahrtssoldat','bremgarten',0),
('schweren-fahrzeug-mechaniker','thun',0),
('software-spezialist','frauenfeld',0),
('software-spezialist','jassbach',1),
('spezialfahrzeugfahrer','wangen',0),
('system-informatiksoldat','frauenfeld',0),
('telematiksoldat','frauenfeld',0),
('telematiksoldat','buelach',1),
('uebermittlungssoldat','frauenfeld',0),
('uebermittlungssoldat','emmen',1),
('uebermittlungssoldat','buelach',2),
('waffenwart','thun',0),
('wartungsmechaniker','thun',0),
('wartungssoldat','thun',0),
('wetterradarsoldat','emmen',0),
('werkstattmechaniker','thun',0),
('zentralenpionier','buelach',0),
('zerspanungsmechaniker','thun',0)
on conflict(function_id,barracks_id) do update set position=excluded.position;
-- END GENERATED CATALOG

create or replace function public.sync_entity(entity_table text,payload jsonb,expected_version integer,operation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); eid uuid; old jsonb; result jsonb; clean jsonb; cols text; updates text; allowed text[]; c jsonb; i jsonb; cp integer; ip integer; receipt jsonb;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501';end if;
  if entity_table not in ('profiles','service_periods','diary_entries','entry_media','books','user_preferences','book_versions') then raise exception 'Invalid entity';end if;
  if pg_column_size(payload)>3000000 then raise exception 'Payload too large';end if;
  eid:=(payload->>'id')::uuid;
  if (payload->>'owner_id')::uuid is distinct from uid then raise exception 'Owner mismatch' using errcode='42501';end if;
  if entity_table in ('profiles','user_preferences') and eid<>uid then raise exception 'ID mismatch';end if;
  perform pg_advisory_xact_lock(hashtextextended(entity_table||eid::text,0));
  select s.result into receipt from public.sync_operations s where s.id=operation_id and s.owner_id=uid;
  if receipt is not null then return receipt;end if;
  execute format('select to_jsonb(t) from public.%I t where id=$1 for update',entity_table) into old using eid;
  if old is not null and (old->>'owner_id')::uuid<>uid then raise exception 'Forbidden' using errcode='42501';end if;
  if entity_table='book_versions' then
    if old is not null then
      if old->'snapshot'<>payload->'snapshot' then raise exception 'Published versions are immutable';end if;
      return jsonb_build_object('record',old);
    end if;
    -- Only own entries and own storage paths may be captured; payload is still untrusted.
    if exists(select 1 from jsonb_array_elements(payload#>'{snapshot,entries}') e where (e->>'owner_id')::uuid<>uid)
      or exists(select 1 from jsonb_array_elements(payload#>'{snapshot,media}') m where (m->>'owner_id')::uuid<>uid or (m->>'storage_path' is not null and m->>'storage_path' not like uid::text||'/%'))
      or (payload#>>'{snapshot,book,owner_id}')::uuid is distinct from uid then raise exception 'Invalid snapshot';end if;
    perform pg_advisory_xact_lock(hashtextextended('book-versions'||(payload->>'book_id'),0));
    insert into public.book_versions(id,owner_id,book_id,number,snapshot,created_at,archived)
    values(eid,uid,(payload->>'book_id')::uuid,(select coalesce(max(v.number),0)+1 from public.book_versions v where v.book_id=(payload->>'book_id')::uuid),payload->'snapshot',now(),false) returning to_jsonb(book_versions.*) into result;
  else
    if coalesce((old->>'version')::integer,0)<>expected_version then return jsonb_build_object('conflict',true,'record',old);end if;
    allowed:=case entity_table
      when 'profiles' then array['name','username','rank_id','function_id','branch_id','barracks_id','unit','avatar_id','discoverable','private_profile','deleted_at']
      when 'service_periods' then array['type','title','start_date','end_date','unit','rank_id','function_id','branch_id','barracks_id','deleted_at']
      when 'diary_entries' then array['period_id','date','subtitle','content','mood','condition','milestone','visibility','media_ids','cover_id','created_at','deleted_at']
      when 'entry_media' then array['entry_id','name','mime','size','storage_path','deleted_at']
      when 'books' then array['period_id','title','subtitle','dedication','intro','outro','template','accent','cover_id','deleted_at']
      when 'user_preferences' then array['theme','view','active_period_id','reminder_enabled','reminder_days','reminder_time','deleted_at'] end;
    select string_agg(format('%I',k),','),string_agg(format('%I=excluded.%I',k,k),',') into cols,updates from unnest(allowed||array['id','owner_id','version','updated_at']) k;
    clean:=payload||jsonb_build_object('id',eid,'owner_id',uid,'version',expected_version+1,'updated_at',now());
    -- Older clients omit this new field; keep a previously selected location.
    if entity_table in ('profiles','service_periods') then
      clean:=jsonb_set(clean,'{barracks_id}',coalesce(payload->'barracks_id',old->'barracks_id','null'::jsonb));
    end if;
    execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I,$1) on conflict(id) do update set %3$s returning to_jsonb(%1$I.*)',entity_table,cols,updates) into result using clean;
    if entity_table='diary_entries' and payload->>'deleted_at' is null then
      if not exists(select 1 from public.service_periods p where p.id=(payload->>'period_id')::uuid and p.owner_id=uid and (payload->>'date')::date between p.start_date and p.end_date and p.deleted_at is null) then raise exception 'Date outside service period';end if;
    end if;
    if entity_table='entry_media' and payload->>'entry_id' is not null then
      perform 1 from public.diary_entries where id=(payload->>'entry_id')::uuid for update;
      if not exists(select 1 from public.diary_entries e where e.id=(payload->>'entry_id')::uuid and e.owner_id=uid and eid=any(e.media_ids)) then raise exception 'Image must be selected by its entry';end if;
    end if;
    if entity_table='books' then
      delete from public.book_chapters where book_id=eid and owner_id=uid;cp:=0;
      for c in select * from jsonb_array_elements(payload->'chapters') loop
        insert into public.book_chapters(id,owner_id,book_id,title,position) values((c->>'id')::uuid,uid,eid,c->>'title',cp);cp:=cp+1;ip:=0;
        for i in select * from jsonb_array_elements(c->'items') loop
          insert into public.book_items(id,owner_id,chapter_id,kind,entry_id,title,text,media_ids,position) values((i->>'id')::uuid,uid,(c->>'id')::uuid,i->>'kind',(i->>'entry_id')::uuid,i->>'title',i->>'text',array(select jsonb_array_elements_text(i->'media_ids'))::uuid[],ip);ip:=ip+1;
        end loop;
      end loop;
      result:=result||jsonb_build_object('chapters',payload->'chapters');
    end if;
    if entity_table='user_preferences' then
      insert into public.reminder_preferences(owner_id,enabled,days,local_time) values(uid,(payload->>'reminder_enabled')::boolean,array(select jsonb_array_elements_text(payload->'reminder_days'))::integer[],(payload->>'reminder_time')::time)
      on conflict(owner_id) do update set enabled=excluded.enabled,days=excluded.days,local_time=excluded.local_time,updated_at=now();
    end if;
  end if;
  receipt:=jsonb_build_object('record',result);
  insert into public.sync_operations values(operation_id,uid,entity_table,eid,receipt,now());
  return receipt;
end $$;
revoke all on function public.sync_entity from public;
grant execute on function public.sync_entity to authenticated;
