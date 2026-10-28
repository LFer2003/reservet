CREATE TABLE restaurant_tables (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(80) NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 20),
  status varchar(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'occupied', 'out_of_service')),
  created_at timestamptz NOT NULL DEFAULT now()
);
