# MC1.5.1 — Auditoría default Camilo (Frontend vs Backend)

**Modo:** solo lectura. **No se modificó** PA2, mappings, frontend ni evaluaciones persistidas.

**Parámetros de diagnóstico (no hardcodeados en el motor):**

| Parámetro | Valor |
|-----------|-------|
| personId | 1 |
| extractionId | 206 |
| evaluation PA2 | 1 (SUCCEEDED, is_active) |
| domain | SOFTWARE |
| rulesVersion | pa2-software-1.0.0 |

Artefacto JSON: `tmp/cv-attributes/mc1.5.1-camilo-ranking-audit.json`

---

## 1. Fórmula actual

```
rankingScore =
  coverage × 40
  + strength × 0.25
  + confidence × 15
  + evidencedSkillCount × 2
  + mappedSkillCount × 1
  + primaryStrongCount × 12
```

Bonuses/penalties: **ninguno**.

### `primaryStrongCount`

- Condición **hardcodeada** en `mc-pa2.engine.ts`: `mappingType === 'PRIMARY' && evidenceLevel === 'STRONG'`.
- Peso en ranking: **12** por skill (config `pa2-software-1.0.0`).
- No se persiste como columna; solo alimenta el score en runtime.
- También participa en el override de baja cardinalidad (`requirePrimaryStrong`), independiente del ranking.

---

## 2. Descomposición Frontend vs Backend

| Componente | Frontend | Backend | Diferencia (FE−BE) |
|------------|----------|---------|---------------------|
| Coverage (raw 1.00 / 1.00) | **40.00** | **40.00** | 0 |
| Strength (31 / 48.1) | 7.75 | **12.025** | −4.275 |
| Confidence (0.8307 / 0.8537) | 12.4605 | **12.8055** | −0.345 |
| Evidenced cardinality (11 / 11) | 22 | 22 | 0 |
| Mapped cardinality (11 / 11) | 11 | 11 | 0 |
| Primary strong (3 / 1) | **36** | 12 | **+24** |
| **Score final** | **129.2105** | **109.8305** | **+19.38** |

### Por qué gana Frontend

Con Coverage y cardinalidad empatados, Backend aventaja en Strength (+4.275 al score) y Confidence (+0.345).  
Frontend aporta **+24** vía `primaryStrongCount` (3 skills vs 1).

Sin el componente Primary strong, Backend ganaría por **≈4.62** puntos.

**Clasificación de la señal:** `FACTOR_DOMINANTE` (no desempate moderado).

Skills PRIMARY+STRONG:

| Especialidad | Skills |
|--------------|--------|
| Frontend | React, Angular, Next.js |
| Backend | Node.js |

---

## 3. Skills contribuyentes

### Duales (aparecen en ambas)

| Skill | FE role / level | BE role / level |
|-------|-----------------|-----------------|
| JavaScript | PRIMARY / MODERATE | (ver breakdown JSON) |
| TypeScript | (ver JSON) | (ver JSON) |

`APIs REST` y `TypeORM` son **exclusivas de Backend** en este breakdown (no duales).  
`Git` no aparece en el breakdown FE/BE de esta evaluación.

### Exclusivas Frontend

React, Angular, Next.js, AngularJS, Angular Material, CSS3, HTML5, Sass, Tailwind CSS

### Exclusivas Backend

Node.js, NestJS, ASP.NET, C#, .NET, Go, APIs REST, TypeORM, Express.js

Detalle completo (pesos, strength, confidence, contribución): ver JSON.

---

## 4. Simulaciones (sin persistir)

| Escenario | Default resultante | vs 1.0.0 |
|-----------|--------------------|----------|
| Actual `pa2-software-1.0.0` | SOFTWARE_FRONTEND | — |
| A — Lexicográfico ACTIVE | **SOFTWARE_BACKEND** | Cambia |
| B — PrimaryStrong peso 0.5 (desempate) | **SOFTWARE_BACKEND** | Cambia |
| C — Score normalizado (Coverage/StrengthN/Confidence/masa/primary ligero) | **SOFTWARE_BACKEND** | Cambia |

### Lectura

- Escenario A: misma evidencia 11/11 y Coverage 1 → gana Backend por mayor Strength, luego Confidence.
- Escenario B: al quitar el impulso dominante de primaryStrong, Backend recupera la ventaja de intensidad/confianza.
- Escenario C: al normalizar Strength, Backend vuelve a liderar.

### Riesgos de generalización

- Reducir `primaryStrongCountWeight` favorece perfiles con evidencia profunda en pocas stacks (p. ej. Backend) frente a muchas PRIMARY STRONG de frameworks UI.
- Lexicográfico puro ignora “amplitud de stack marcada como PRIMARY STRONG”, que sí captura identidad frontend multi-framework.
- Cualquier cambio debe versionarse como `pa2-software-1.1.0` sin mutar la evaluación histórica id=1.

---

## 5. Recomendación (sin aplicar)

**Opción recomendada: 4 — Ajustar reglas y recalcular** (tras aprobación), con narrativa de producto **Opción 3** mientras tanto.

| Opción | Veredicto |
|--------|-----------|
| 1 Mantener Frontend | No: primaryStrong actúa como factor dominante y no refleja la percepción Full Stack / énfasis Backend con igual Coverage. |
| 2 Cambiar default a Backend | Coherente con A/B/C, pero hacerlo sin nueva versión de reglas sería un parche opaco. |
| 3 Sin principal concluyente | Válido como mensaje de producto: *“Full Stack con énfasis Backend”* — sin crear especialidad FULLSTACK. |
| **4 Ajustar reglas** | **Preferida:** bajar `primaryStrongCountWeight` a rol de desempate (escenario B) o adoptar desempate lexicográfico (A); publicar `pa2-software-1.1.0`; conservar eval id=1; generar nueva evaluación activa por flujo oficial. |

### Parte J — ¿Separar “principal” vs “mayor fuerza de evidencia”?

Para Camilo aportaría claridad temporal:

- Especialidad principal (identidad / default de UI): hoy Frontend por fórmula.
- Mayor fuerza de evidencia: Backend (Strength 48.1 vs 31).

**Riesgo:** dos “ganadores” confunden al usuario del Explorador.  
**Recomendación:** no agregar el campo todavía; primero corregir el sesgo del ranking (Opción 4). Si tras 1.1.0 siguen divergiendo identidad vs intensidad, reabrir el debate.

---

## 6. Confirmaciones de alcance

- No se forzó ningún perfil a Software.
- No se crearon especialidades nuevas.
- No se modificó frontend.
- No se cambió la versión activa de PA2.
- No se mutó la evaluación SUCCEEDED id=1.
