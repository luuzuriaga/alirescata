CREATE TABLE distrito (
  id_distrito SMALLSERIAL PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE,
  activo_piloto BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE categoria (
  id_categoria SMALLSERIAL PRIMARY KEY,
  nombre VARCHAR(60) NOT NULL UNIQUE,
  permitida_piloto BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE alergeno (
  id_alergeno SMALLSERIAL PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL UNIQUE
);
CREATE TABLE usuario (
  id_usuario SERIAL PRIMARY KEY,
  correo VARCHAR(120) NOT NULL UNIQUE,
  hash_contrasena VARCHAR(100) NOT NULL,
  nombres VARCHAR(80) NOT NULL,
  telefono CHAR(9),
  rol VARCHAR(15) NOT NULL CHECK (rol IN ('consumidor','comercio','organizacion','administrador')),
  estado VARCHAR(10) NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','inactivo','anonimizado')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE consentimiento (
  id_consentimiento SERIAL PRIMARY KEY,
  id_usuario INT NOT NULL REFERENCES usuario(id_usuario),
  version_politica VARCHAR(10) NOT NULL,
  aceptado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE comercio (
  id_comercio SERIAL PRIMARY KEY,
  id_usuario INT NOT NULL UNIQUE REFERENCES usuario(id_usuario),
  ruc CHAR(11) NOT NULL UNIQUE CHECK (ruc ~ '^(10|20)[0-9]{9}$'),
  razon_social VARCHAR(150) NOT NULL,
  nombre_comercial VARCHAR(100) NOT NULL,
  direccion VARCHAR(150) NOT NULL,
  id_distrito SMALLINT NOT NULL REFERENCES distrito(id_distrito),
  tipo_comercio VARCHAR(15) NOT NULL CHECK (tipo_comercio IN ('panaderia','cafe','restaurante','minimercado','otro')),
  hora_apertura TIME NOT NULL,
  hora_cierre TIME NOT NULL,
  estado_verificacion VARCHAR(10) NOT NULL DEFAULT 'pendiente' CHECK (estado_verificacion IN ('pendiente','aprobado','rechazado'))
);
CREATE TABLE organizacion (
  id_organizacion SERIAL PRIMARY KEY,
  id_usuario INT NOT NULL UNIQUE REFERENCES usuario(id_usuario),
  ruc CHAR(11) NOT NULL UNIQUE CHECK (ruc ~ '^(10|20)[0-9]{9}$'),
  razon_social VARCHAR(150) NOT NULL,
  tipo VARCHAR(15) NOT NULL CHECK (tipo IN ('banco_alimentos','comedor','ong','otro')),
  direccion VARCHAR(150) NOT NULL,
  id_distrito SMALLINT NOT NULL REFERENCES distrito(id_distrito),
  calificada_sunat BOOLEAN NOT NULL DEFAULT FALSE,
  vigencia_calificacion DATE,
  estado_verificacion VARCHAR(10) NOT NULL DEFAULT 'pendiente' CHECK (estado_verificacion IN ('pendiente','aprobado','rechazado'))
);
CREATE TABLE verificacion (
  id_verificacion SERIAL PRIMARY KEY,
  id_comercio INT REFERENCES comercio(id_comercio),
  id_organizacion INT REFERENCES organizacion(id_organizacion),
  id_admin INT NOT NULL REFERENCES usuario(id_usuario),
  resultado VARCHAR(10) NOT NULL CHECK (resultado IN ('aprobado','rechazado')),
  motivo VARCHAR(250),
  verificado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((id_comercio IS NULL) <> (id_organizacion IS NULL)),
  CHECK (resultado = 'aprobado' OR motivo IS NOT NULL)
);
CREATE TABLE producto (
  id_producto SERIAL PRIMARY KEY,
  id_comercio INT NOT NULL REFERENCES comercio(id_comercio),
  id_categoria SMALLINT NOT NULL REFERENCES categoria(id_categoria),
  nombre VARCHAR(100) NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE oferta (
  id_oferta SERIAL PRIMARY KEY,
  id_producto INT NOT NULL REFERENCES producto(id_producto),
  descripcion_pack VARCHAR(250),
  stock_inicial SMALLINT NOT NULL CHECK (stock_inicial BETWEEN 1 AND 99),
  stock_disponible SMALLINT NOT NULL,
  peso_kg_pack NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (peso_kg_pack > 0),
  precio_regular NUMERIC(8,2) NOT NULL CHECK (precio_regular > 0),
  precio_oferta NUMERIC(8,2) NOT NULL CHECK (precio_oferta > 0),
  ventana_inicio TIMESTAMPTZ NOT NULL,
  ventana_fin TIMESTAMPTZ NOT NULL,
  estado VARCHAR(10) NOT NULL DEFAULT 'publicada' CHECK (estado IN ('publicada','agotada','cerrada','anulada')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (precio_oferta < precio_regular),
  CHECK (ventana_fin > ventana_inicio),
  CHECK (stock_disponible BETWEEN 0 AND stock_inicial)
);
CREATE TABLE oferta_alergeno (
  id_oferta INT NOT NULL REFERENCES oferta(id_oferta) ON DELETE CASCADE,
  id_alergeno SMALLINT NOT NULL REFERENCES alergeno(id_alergeno),
  PRIMARY KEY (id_oferta, id_alergeno)
);
CREATE TABLE reserva (
  id_reserva SERIAL PRIMARY KEY,
  id_oferta INT NOT NULL REFERENCES oferta(id_oferta),
  id_consumidor INT NOT NULL REFERENCES usuario(id_usuario),
  cantidad SMALLINT NOT NULL CHECK (cantidad BETWEEN 1 AND 5),
  precio_unitario NUMERIC(8,2) NOT NULL CHECK (precio_unitario > 0),
  codigo_recojo CHAR(6) NOT NULL CHECK (codigo_recojo ~ '^[0-9]{6}$'),
  estado VARCHAR(10) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa','entregada','vencida','cancelada')),
  reservada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  entregada_en TIMESTAMPTZ,
  UNIQUE (id_oferta, codigo_recojo)
);
CREATE TABLE pago (
  id_pago SERIAL PRIMARY KEY,
  id_reserva INT NOT NULL UNIQUE REFERENCES reserva(id_reserva),
  monto NUMERIC(8,2) NOT NULL CHECK (monto > 0),
  metodo VARCHAR(20) NOT NULL CHECK (metodo IN ('efectivo','billetera_digital','otro')),
  registrado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE calificacion (
  id_calificacion SERIAL PRIMARY KEY,
  id_reserva INT NOT NULL UNIQUE REFERENCES reserva(id_reserva),
  puntaje SMALLINT NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
  comentario VARCHAR(300),
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE donacion (
  id_donacion SERIAL PRIMARY KEY,
  id_oferta INT NOT NULL REFERENCES oferta(id_oferta),
  id_organizacion INT REFERENCES organizacion(id_organizacion),
  cantidad_packs SMALLINT NOT NULL CHECK (cantidad_packs >= 1),
  recojo_desde TIMESTAMPTZ NOT NULL,
  recojo_hasta TIMESTAMPTZ NOT NULL,
  estado VARCHAR(10) NOT NULL DEFAULT 'disponible' CHECK (estado IN ('disponible','reclamada','recibida','vencida','cancelada')),
  reclamada_en TIMESTAMPTZ,
  recibida_en TIMESTAMPTZ,
  CHECK (recojo_hasta > recojo_desde),
  CHECK (estado = 'disponible' OR estado = 'vencida' OR id_organizacion IS NOT NULL)
);
CREATE TABLE constancia (
  id_constancia SERIAL PRIMARY KEY,
  id_donacion INT NOT NULL UNIQUE REFERENCES donacion(id_donacion),
  codigo_constancia VARCHAR(20) NOT NULL UNIQUE,
  emitida_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  ruta_pdf VARCHAR(200) NOT NULL,
  hash_sha256 CHAR(64) NOT NULL
);
CREATE TABLE parametro_impacto (
  id_parametro SERIAL PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL,
  valor NUMERIC(8,3) NOT NULL CHECK (valor > 0 AND valor <= 10),
  unidad VARCHAR(20) NOT NULL,
  vigente_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  id_admin INT NOT NULL REFERENCES usuario(id_usuario),
  UNIQUE (nombre, vigente_desde)
);
CREATE TABLE incidencia (
  id_incidencia SERIAL PRIMARY KEY,
  id_reserva INT REFERENCES reserva(id_reserva),
  id_donacion INT REFERENCES donacion(id_donacion),
  id_reportante INT NOT NULL REFERENCES usuario(id_usuario),
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('calidad','inocuidad','no_recojo','otro')),
  descripcion VARCHAR(500) NOT NULL,
  estado VARCHAR(12) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','en_revision','resuelta','descartada')),
  id_admin INT REFERENCES usuario(id_usuario),
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelta_en TIMESTAMPTZ,
  CHECK (id_reserva IS NOT NULL OR id_donacion IS NOT NULL)
);
CREATE INDEX idx_comercio_distrito ON comercio(id_distrito);
CREATE INDEX idx_producto_comercio ON producto(id_comercio);
CREATE INDEX idx_oferta_estado_ventana ON oferta(estado, ventana_fin);
CREATE INDEX idx_oferta_producto ON oferta(id_producto);
CREATE INDEX idx_reserva_consumidor ON reserva(id_consumidor);
CREATE INDEX idx_reserva_oferta ON reserva(id_oferta, estado);
CREATE INDEX idx_donacion_estado ON donacion(estado, recojo_hasta);
CREATE VIEW v_impacto_comercio AS
SELECT p.id_comercio,
       SUM(r.cantidad * o.peso_kg_pack) AS kg_vendidos,
       SUM(r.cantidad * r.precio_unitario) AS ingreso_recuperado
FROM reserva r
JOIN oferta o ON o.id_oferta = r.id_oferta
JOIN producto p ON p.id_producto = o.id_producto
WHERE r.estado = 'entregada'
GROUP BY p.id_comercio;
CREATE VIEW v_kg_donados_comercio AS
SELECT p.id_comercio, SUM(d.cantidad_packs * o.peso_kg_pack) AS kg_donados
FROM donacion d
JOIN oferta o ON o.id_oferta = d.id_oferta
JOIN producto p ON p.id_producto = o.id_producto
WHERE d.estado = 'recibida'
GROUP BY p.id_comercio;
