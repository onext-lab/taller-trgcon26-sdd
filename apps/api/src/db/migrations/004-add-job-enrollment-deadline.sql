-- HU-07: fecha límite de inscripción (FEAT-04 RN-01, RN-02). Día natural de Europe/Madrid 'AAAA-MM-DD', sin hora;
-- NULL = sin límite. «No anterior a hoy» depende del reloj: lo valida el servicio, no la base.
ALTER TABLE job_openings ADD COLUMN enrollment_deadline TEXT
  CHECK (enrollment_deadline IS NULL
      OR (enrollment_deadline GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
          AND date(enrollment_deadline) IS enrollment_deadline));
