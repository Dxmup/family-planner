-- Nearest major airport (IATA) per city, for the Trip Planner's drive-vs-fly
-- cost comparison. Home (Greenville) = GSP.
alter table cities add column if not exists airport text;

update cities set airport = v.code from (values
  ('Greenville','GSP'),
  ('Atlanta','ATL'),
  ('Chattanooga','CHA'),
  ('Nashville','BNA'),
  ('Huntsville','HSV'),
  ('Knoxville','TYS'),
  ('St. Louis','STL'),
  ('Louisville','SDF'),
  ('Cincinnati','CVG'),
  ('Columbus','CMH'),
  ('Indianapolis','IND'),
  ('Washington DC','DCA'),
  ('Williamsburg','RIC'),
  ('Pittsburgh','PIT'),
  ('Philadelphia','PHL'),
  ('Savannah','SAV'),
  ('Charleston','CHS'),
  ('St. Augustine','JAX'),
  ('Orlando','MCO'),
  ('Tampa / St. Pete','TPA'),
  ('Nature Coast (Crystal River)','TPA'),
  ('Charlotte','CLT'),
  ('Gatlinburg / Pigeon Forge','TYS'),
  ('NC Triangle (Raleigh–Durham)','RDU')
) v(name, code) where cities.name = v.name;
