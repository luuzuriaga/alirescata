INSERT INTO distrito (nombre, activo_piloto) VALUES ('San Miguel',TRUE),('Pueblo Libre',TRUE),('Magdalena',TRUE) ON CONFLICT DO NOTHING;
INSERT INTO categoria (nombre) VALUES ('Panadería y pastelería'),('Comida preparada'),('Envasados y no perecibles') ON CONFLICT DO NOTHING;
INSERT INTO alergeno (nombre) VALUES ('Gluten'),('Huevo'),('Leche'),('Frutos secos'),('Soya'),('Pescado y mariscos') ON CONFLICT DO NOTHING;
