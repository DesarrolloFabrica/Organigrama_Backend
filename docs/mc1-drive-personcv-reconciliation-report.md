# MC1 — Reconciliación Drive ↔ person_cv ↔ cv_extraction

**Estado:** AUDITORÍA DE RECONCILIACIÓN COMPLETADA / WRITES 0
**Generado:** 2026-07-29T21:16:01.346Z
**Folder oficial:** `1ZNdLeKoR-KiUqoKnG4NBJT2-sWj6Yy5D` (Hojas de Vida D.O Organigrama)
**Modo:** READ ONLY · sin sync · sin extracciones · sin UPDATE

## 1. Resumen ejecutivo

De un universo de **133** documentos (unión Drive válido + person_cv activos), **30** están **HEALTHY** (Drive ↔ person_cv alineados y extracción activa con el mismo `drive_file_id`). **130** requieren intervención o revisión.

Hallazgos principales:

- PDFs en Drive sin `person_cv` (NEED SYNC): **5**
- `person_cv` activos sin PDF en Drive (huérfanos): **1** / global ORPHAN_PERSON_CV **1**
- Extracciones con `drive_file_id` distinto al CV actual (STALE): **80**
- Duplicados en Drive: **1**
- Nombres inválidos: **3**

## 2. Métricas

| Métrica | Valor |
| ------- | ----: |
| PDFs en Drive | 136 |
| Carpetas visitadas | 16 |
| Documentos únicos (Drive válidos) | 132 |
| Documentos universo (Drive∪person_cv) | 133 |
| person_cv activos | 127 |
| Extracciones activas | 139 |
| Registros completamente alineados (HEALTHY) | 30 |
| Drive↔person_cv ALIGNED | 126 |
| person_cv huérfanos (MISSING_IN_DRIVE) | 1 |
| ORPHAN_PERSON_CV (global) | 1 |
| Extracciones huérfanas (global) | 27 |
| Requieren sincronización (NEEDS_SYNC) | 5 |
| Requieren reextracción / stale | 96 |
| STALE_FILE_ID (person_cv↔extraction) | 80 |
| Revisión manual | 1 |
| FILE_ID_CHANGED | 0 |
| MISSING_IN_PERSON_CV | 5 |
| DUPLICATE_IN_DRIVE | 1 |
| INVALID_FILE_NAME | 3 |

### Conteos por estado

**Drive ↔ person_cv**

| Estado | n |
| ------ | -: |
| ALIGNED | 126 |
| DUPLICATE_IN_DRIVE | 1 |
| INVALID_FILE_NAME | 3 |
| MISSING_IN_DRIVE | 1 |
| MISSING_IN_PERSON_CV | 5 |

**person_cv ↔ cv_extraction**

| Estado | n |
| ------ | -: |
| CURRENT | 31 |
| NO_EXTRACTION | 49 |
| STALE_FILE_ID | 80 |

**Global**

| Estado | n |
| ------ | -: |
| HEALTHY | 30 |
| MANUAL_REVIEW | 1 |
| NEEDS_REEXTRACTION | 16 |
| NEEDS_SYNC | 5 |
| ORPHAN_EXTRACTION | 27 |
| ORPHAN_PERSON_CV | 1 |
| STALE_EXTRACTION | 80 |

## 3. Drive ↔ person_cv (solo no ALIGNED)

| Documento | Drive | person_cv | Estado | Observación |
| --------- | ----- | --------- | ------ | ----------- |
| 1000019945 | EQUIPO PRINCIPAL/1000019945.pdf · SERVICIO/1000019945.pdf | — | DUPLICATE_IN_DRIVE | 2 PDFs: EQUIPO PRINCIPAL/1000019945.pdf \| SERVICIO/1000019945.pdf |
| 100033564 | PROYECCION SOCIAL/100033564.pdf | — | MISSING_IN_PERSON_CV | Drive PROYECCION SOCIAL/100033564.pdf |
| 10006155547 | SABER PRO/10006155547.pdf | — | MISSING_IN_PERSON_CV | Drive SABER PRO/10006155547.pdf |
| 1019146130 | SABER PRO/1019146130.pdf | — | MISSING_IN_PERSON_CV | Drive SABER PRO/1019146130.pdf |
| 1031154553 | FABRICA CONTENIDO/1031154553.pdf | — | MISSING_IN_PERSON_CV | Drive FABRICA CONTENIDO/1031154553.pdf |
| 1082955522 | — | id=168 file=10NtXXTNgyj9CoZ7gqhFx9xWkOACODyOy | MISSING_IN_DRIVE | person_cv file_id=10NtXXTNgyj9CoZ7gqhFx9xWkOACODyOy |
| 1085329631 | PROYECCION SOCIAL/1085329631.pdf | — | MISSING_IN_PERSON_CV | Drive PROYECCION SOCIAL/1085329631.pdf |
| (invalid)1082955522.pdf.pdf | DESARROLLO PROFESIONAL/1082955522.pdf.pdf | — | INVALID_FILE_NAME | 1082955522.pdf.pdf |
| (invalid)1016105936 .pdf | OPERACIONES ACADEMICAS/NEGOCIOS/1016105936 .pdf | — | INVALID_FILE_NAME | 1016105936 .pdf |
| (invalid)52866878 .pdf | OPERACIONES ACADEMICAS/TRANSVERSALES/52866878 .pdf | — | INVALID_FILE_NAME | 52866878 .pdf |

## 4. person_cv ↔ cv_extraction (solo no CURRENT)

| Documento | person_cv | extraction | Estado | Observación |
| --------- | --------- | ---------- | ------ | ----------- |
| 1000019945 | — | id=1 status=SUCCEEDED file=1Uspuram36vAEPdt3ukj4YvfogxpfKPqZ | NO_EXTRACTION | sin person_cv activo |
| 1000020890 | id=29 file=1JlqLnONlqURzdXo3kAZOoISzF4Urjgr7 | id=146 status=SUCCEEDED file=1e-7OkBph3L3XmsDMr3kxa_WWfE8vqQE2 | STALE_FILE_ID | cv=1JlqLnONlqURzdXo3kAZOoISzF4Urjgr7 ext=1e-7OkBph3L3XmsDMr3kxa_WWfE8vqQE2 |
| 1000047404 | id=75 file=1FzW84sWXyCcx6Gl85HSa5a-5hXaFLybd | id=85 status=SUCCEEDED file=1UxDcIQ4EDIPSlKDN0jamaeb-M5EAkv04 | STALE_FILE_ID | cv=1FzW84sWXyCcx6Gl85HSa5a-5hXaFLybd ext=1UxDcIQ4EDIPSlKDN0jamaeb-M5EAkv04 |
| 1000120580 | id=58 file=1zo8fKq107GmT_A6y4WvrZGD0plcvqGbQ | id=8 status=SUCCEEDED file=1vtIS8l25rOpN4mLXJfV7lXDOPR463CPx | STALE_FILE_ID | cv=1zo8fKq107GmT_A6y4WvrZGD0plcvqGbQ ext=1vtIS8l25rOpN4mLXJfV7lXDOPR463CPx |
| 1000158865 | id=169 file=1QQ9tdDOoSwU0ID_52eKgGCnJJNzedm27 | — | NO_EXTRACTION | sin extracciones |
| 100033564 | — | — | NO_EXTRACTION | sin extracciones |
| 1000351000 | id=71 file=18bmWz5LM4ooLIqQVYW3cpZo7677f9poE | id=83 status=SUCCEEDED file=19_M0eLRD-4r90vPQoMXq-zJqkyTIZW5y | STALE_FILE_ID | cv=18bmWz5LM4ooLIqQVYW3cpZo7677f9poE ext=19_M0eLRD-4r90vPQoMXq-zJqkyTIZW5y |
| 1000468520 | id=96 file=1pNsDcw3cCVyWywI0i80CM_hYNhirwAdU | id=40 status=SUCCEEDED file=1MvBbJtWVxOusN-HvtxyzdIZZ2eJ1pabf | STALE_FILE_ID | cv=1pNsDcw3cCVyWywI0i80CM_hYNhirwAdU ext=1MvBbJtWVxOusN-HvtxyzdIZZ2eJ1pabf |
| 1000572345 | id=170 file=1hxrGpmg6rt4QqykkV5RNOqMCKNMOc5Je | — | NO_EXTRACTION | sin extracciones |
| 10006155547 | — | — | NO_EXTRACTION | sin extracciones |
| 1000626221 | id=69 file=1lXUyvYjN34X5lMoqTEHI64VuACvR45EV | id=82 status=SUCCEEDED file=1MyazUJSGv_KptXWaEAMIIo4ml51uzmWg | STALE_FILE_ID | cv=1lXUyvYjN34X5lMoqTEHI64VuACvR45EV ext=1MyazUJSGv_KptXWaEAMIIo4ml51uzmWg |
| 1000733403 | id=73 file=1BTt3pPZYLoahnFgnt9VUON2V0lU9EcKJ | id=84 status=SUCCEEDED file=1MOYI5ELYaOAkcvXvzIbMytvA-jpNX4PS | STALE_FILE_ID | cv=1BTt3pPZYLoahnFgnt9VUON2V0lU9EcKJ ext=1MOYI5ELYaOAkcvXvzIbMytvA-jpNX4PS |
| 1000785514 | id=171 file=1rR4fm58dS3WOvGTtxpO3O8XDnX41Xho3 | — | NO_EXTRACTION | sin extracciones |
| 1000862484 | id=137 file=18dbl-9fFZElyOrNEJeAVoj2mJ1ch61m7 | id=195 status=SUCCEEDED file=1z9CMdLTPjT7OxKMO7O_obRp2HYfsQcAX | STALE_FILE_ID | cv=18dbl-9fFZElyOrNEJeAVoj2mJ1ch61m7 ext=1z9CMdLTPjT7OxKMO7O_obRp2HYfsQcAX |
| 1001045749 | id=172 file=1pBBrwtduCKycMRrNxA-vOYz1FqIfo3Vq | — | NO_EXTRACTION | sin extracciones |
| 1001053316 | id=82 file=11QxpcI5Wy1AivCWzcGfBJmDFdleOwhCG | id=80 status=SUCCEEDED file=189KHWvxMjjoOX-tr12xXrKH3AkDyUTBR | STALE_FILE_ID | cv=11QxpcI5Wy1AivCWzcGfBJmDFdleOwhCG ext=189KHWvxMjjoOX-tr12xXrKH3AkDyUTBR |
| 1001187596 | id=30 file=1esCsInPR9fD_RIs2E1PGEv3WhBufXcGj | id=150 status=SUCCEEDED file=1pzzH4NDIozH4QL_1Dn226gKSJ1g9U0vv | STALE_FILE_ID | cv=1esCsInPR9fD_RIs2E1PGEv3WhBufXcGj ext=1pzzH4NDIozH4QL_1Dn226gKSJ1g9U0vv |
| 1001200367 | id=83 file=1Wqq2DuLAuFXKFJkf9OGj0n2l03lhkNcd | id=78 status=SUCCEEDED file=1Fcz8XSpH3WiaHgZ6tzv12Hqn_6gyIkd8 | STALE_FILE_ID | cv=1Wqq2DuLAuFXKFJkf9OGj0n2l03lhkNcd ext=1Fcz8XSpH3WiaHgZ6tzv12Hqn_6gyIkd8 |
| 1001270269 | id=128 file=1nArTtMnMDvRQBeU_zdvArCeV37R94b8v | id=162 status=SUCCEEDED file=16TcScwbrGRjXcdWzoWZEfpr2S1aI_NJ6 | STALE_FILE_ID | cv=1nArTtMnMDvRQBeU_zdvArCeV37R94b8v ext=16TcScwbrGRjXcdWzoWZEfpr2S1aI_NJ6 |
| 1002461766 | id=50 file=1eU-77UiPLS7ZKtzGkpyQN7aX3zy6M44S | id=60 status=SUCCEEDED file=1UayWq3vwqKZbqeN6DGgpMMy7XsVkjo6m | STALE_FILE_ID | cv=1eU-77UiPLS7ZKtzGkpyQN7aX3zy6M44S ext=1UayWq3vwqKZbqeN6DGgpMMy7XsVkjo6m |
| 1003432473 | id=133 file=1jwO7zz4GuhUq4s-kMK_VTle3IRr59S1J | id=175 status=SUCCEEDED file=1tWgf7dO1j4ccyGrL_BEOibcQZOe5M4Ps | STALE_FILE_ID | cv=1jwO7zz4GuhUq4s-kMK_VTle3IRr59S1J ext=1tWgf7dO1j4ccyGrL_BEOibcQZOe5M4Ps |
| 1003641753 | id=173 file=1IJzAPhJdqjreVHRMEWsR66TAFUOA2hpJ | — | NO_EXTRACTION | sin extracciones |
| 1007627445 | id=113 file=1b-DHgN39RaYkUMIN3h6fhzvCkIn-fC7O | id=64 status=SUCCEEDED file=1jXkQZxOhnus51A6U7oP7JUL5ZPlb8XiP | STALE_FILE_ID | cv=1b-DHgN39RaYkUMIN3h6fhzvCkIn-fC7O ext=1jXkQZxOhnus51A6U7oP7JUL5ZPlb8XiP |
| 1007783201 | id=143 file=14d6ot5PEj8Q3lnNew9l_W5ZZCdpVEISI | id=170 status=SUCCEEDED file=1kNrJAzgE-S5uUPCefpHHtqCyOCPgzmpC | STALE_FILE_ID | cv=14d6ot5PEj8Q3lnNew9l_W5ZZCdpVEISI ext=1kNrJAzgE-S5uUPCefpHHtqCyOCPgzmpC |
| 1010117182 | id=174 file=1-weHEV76tyMa-ok4I63yGu17X1FhIFyO | — | NO_EXTRACTION | sin extracciones |
| 1010224925 | id=51 file=1qONBg9XUXPZO9AWO3bLCnIvVTzTyEHTE | id=19 status=SUCCEEDED file=1rJ1wPJm9NOt-aZg0pdtEgKBenrTgmPJ- | STALE_FILE_ID | cv=1qONBg9XUXPZO9AWO3bLCnIvVTzTyEHTE ext=1rJ1wPJm9NOt-aZg0pdtEgKBenrTgmPJ- |
| 1010247929 | id=65 file=1SJa7Et0BM71RZWMWRdOmxZaZtRgHAZWm | id=5 status=SUCCEEDED file=1NWuHZeB7UChqg1T_g68XK3FfUA602E7Y | STALE_FILE_ID | cv=1SJa7Et0BM71RZWMWRdOmxZaZtRgHAZWm ext=1NWuHZeB7UChqg1T_g68XK3FfUA602E7Y |
| 1012341248 | id=78 file=1HQMlYTYK1mIBJoFAq63xc03oqDSym-md | id=76 status=SUCCEEDED file=18qcOhjH2LadcCsEW68q5iU_xKjhiyTca | STALE_FILE_ID | cv=1HQMlYTYK1mIBJoFAq63xc03oqDSym-md ext=18qcOhjH2LadcCsEW68q5iU_xKjhiyTca |
| 1012410286 | id=32 file=1jHxkiiNMZBzC82SqniJ3o0qfgkWNnpgT | id=142 status=SUCCEEDED file=1pEO6gkSVhtU32VdwZZyQJI-eQYSwDAui | STALE_FILE_ID | cv=1jHxkiiNMZBzC82SqniJ3o0qfgkWNnpgT ext=1pEO6gkSVhtU32VdwZZyQJI-eQYSwDAui |
| 1012433410 | id=52 file=1sBdL1-CUEJkupLCvbiZMspVcFE5J4VMu | id=18 status=SUCCEEDED file=15xgx5NcSl2G7Kwf6mucTHefiCLTbIsVn | STALE_FILE_ID | cv=1sBdL1-CUEJkupLCvbiZMspVcFE5J4VMu ext=15xgx5NcSl2G7Kwf6mucTHefiCLTbIsVn |
| 1013099772 | id=140 file=1Sm0O_5cTrI679Aiyh0zhQYa-f6XXR1V3 | id=173 status=SUCCEEDED file=1qig8yRrVc3QvfLWD44ZcWLNzAd_xzj6u | STALE_FILE_ID | cv=1Sm0O_5cTrI679Aiyh0zhQYa-f6XXR1V3 ext=1qig8yRrVc3QvfLWD44ZcWLNzAd_xzj6u |
| 1013100614 | id=188 file=1HwXf0ikymSxtnHmqaxUgDicv3tFbzuol | id=200 status=SUCCEEDED file=1vYiA2usMYUR8g0PTTmKDsJtBvc4Ev_Mm | STALE_FILE_ID | cv=1HwXf0ikymSxtnHmqaxUgDicv3tFbzuol ext=1vYiA2usMYUR8g0PTTmKDsJtBvc4Ev_Mm |
| 1013588273 | id=99 file=1MF_ioLrEpmewFft4wGS6lTi0XIndBbgt | id=55 status=SUCCEEDED file=1TbV59rd3hbQYW_q2S4nFYOXWKL3lNiOf | STALE_FILE_ID | cv=1MF_ioLrEpmewFft4wGS6lTi0XIndBbgt ext=1TbV59rd3hbQYW_q2S4nFYOXWKL3lNiOf |
| 1013588596 | id=111 file=1SfKYJDxOd4XkITnz5pnrz_rrA-iqhUBM | id=61 status=SUCCEEDED file=1w90Y31PM8iXRsgDeyqBf4Xb4K-iZtGxI | STALE_FILE_ID | cv=1SfKYJDxOd4XkITnz5pnrz_rrA-iqhUBM ext=1w90Y31PM8iXRsgDeyqBf4Xb4K-iZtGxI |
| 1013608570 | id=175 file=1UXVltyIolnWcj1yrDWYW4KmY2avf_OdW | — | NO_EXTRACTION | sin extracciones |
| 1013675353 | id=138 file=19BZO8fgIpHA-aOUtpUKeAOVSYuF7arOJ | id=189 status=SUCCEEDED file=1qjVpFFcH2im8MRQK1pr1gWFdOCMiCQHX | STALE_FILE_ID | cv=19BZO8fgIpHA-aOUtpUKeAOVSYuF7arOJ ext=1qjVpFFcH2im8MRQK1pr1gWFdOCMiCQHX |
| 1014199988 | id=116 file=1hoZkyWnWLQvI7XWlq5veFarvLyFwGbPP | id=41 status=SUCCEEDED file=1Qe_uiwmWnL6C6uQ-R0WJLM0i47HmIC1_ | STALE_FILE_ID | cv=1hoZkyWnWLQvI7XWlq5veFarvLyFwGbPP ext=1Qe_uiwmWnL6C6uQ-R0WJLM0i47HmIC1_ |
| 1014239052 | id=176 file=1kwq-aehCk1WuhoNRhw-G3mx5PipLT8WZ | — | NO_EXTRACTION | sin extracciones |
| 1014304786 | id=177 file=1hMH-myx8PoKYYXk9eeZ3d_epPpC3mDug | — | NO_EXTRACTION | sin extracciones |
| 1015428917 | id=85 file=1An0V2EI6E0R7fgC4qRXL4saK2fGTOsAz | id=63 status=SUCCEEDED file=1fAv0TpIzG6OdJSJYHfQUsrASRvzcap6r | STALE_FILE_ID | cv=1An0V2EI6E0R7fgC4qRXL4saK2fGTOsAz ext=1fAv0TpIzG6OdJSJYHfQUsrASRvzcap6r |
| 1018416748 | id=89 file=1vp39UKjSSGW6JAqBj9rwkY1PMLTjSnHE | id=20 status=SUCCEEDED file=1id00grPI_g2N1KeeohhiK-ybqneJAy5A | STALE_FILE_ID | cv=1vp39UKjSSGW6JAqBj9rwkY1PMLTjSnHE ext=1id00grPI_g2N1KeeohhiK-ybqneJAy5A |
| 1018420012 | id=117 file=1__HPoOP2jTRmwz6evXGjFmIP-_E3QABG | id=26 status=SUCCEEDED file=1QN96HHQY9WFpbmqZ59nZPH_dQwfsfQT7 | STALE_FILE_ID | cv=1__HPoOP2jTRmwz6evXGjFmIP-_E3QABG ext=1QN96HHQY9WFpbmqZ59nZPH_dQwfsfQT7 |
| 1019146130 | — | — | NO_EXTRACTION | sin extracciones |
| 1020749844 | id=112 file=1aYQ_e8XItR-Fk5QVFYgQxyJ-7i_KMPqw | id=31 status=SUCCEEDED file=1WuYVNXjjyvekTwrmLUo1C2xoknRiFquc | STALE_FILE_ID | cv=1aYQ_e8XItR-Fk5QVFYgQxyJ-7i_KMPqw ext=1WuYVNXjjyvekTwrmLUo1C2xoknRiFquc |
| 1020774620 | id=178 file=12W_ztaqCIleO9vfyzVTTQlLiRhj-PD8a | — | NO_EXTRACTION | sin extracciones |
| 1022322100 | id=55 file=19tWpPDwVNTFCZGBFY0OhhE5LyKEHXzBv | id=39 status=SUCCEEDED file=1BYtBpPq-UDhiigp-Hb3o1ng741ITJg8q | STALE_FILE_ID | cv=19tWpPDwVNTFCZGBFY0OhhE5LyKEHXzBv ext=1BYtBpPq-UDhiigp-Hb3o1ng741ITJg8q |
| 1022373489 | id=110 file=1sct09rk7YXJn9osoCx2x6mIVy9fmObWq | id=52 status=SUCCEEDED file=1LUY7ymZQdokEpxPpUlXyP2yf21yaAePj | STALE_FILE_ID | cv=1sct09rk7YXJn9osoCx2x6mIVy9fmObWq ext=1LUY7ymZQdokEpxPpUlXyP2yf21yaAePj |
| 1022395317 | id=107 file=12cVZT9BweDTp_CSxUQH4RZ56A5bbyjmR | id=45 status=SUCCEEDED file=1iWzHj_mLCCuGxbFneebkPpmDE4Q-ALlD | STALE_FILE_ID | cv=12cVZT9BweDTp_CSxUQH4RZ56A5bbyjmR ext=1iWzHj_mLCCuGxbFneebkPpmDE4Q-ALlD |
| 1022404607 | id=179 file=1esk41zZWFehn_Z0ba8iqWQaPy5v1aCHc | — | NO_EXTRACTION | sin extracciones |
| 1022428652 | id=125 file=1bqTnFwQabZoNLvijWBr5iV-9q9VQnkYN | id=139 status=SUCCEEDED file=1Mv_X_NHsB6t1dWZ9pczY3yCFvMa0tzym | STALE_FILE_ID | cv=1bqTnFwQabZoNLvijWBr5iV-9q9VQnkYN ext=1Mv_X_NHsB6t1dWZ9pczY3yCFvMa0tzym |
| 1022945473 | id=94 file=1Ll1-IYEe26oFd5bb9VoHL05AVsjjbkbs | id=68 status=SUCCEEDED file=1EYykQkh239evKbra94WUw50emqeyyWz3 | STALE_FILE_ID | cv=1Ll1-IYEe26oFd5bb9VoHL05AVsjjbkbs ext=1EYykQkh239evKbra94WUw50emqeyyWz3 |
| 1023034328 | id=108 file=1JHXlqAlpuLuOH2ZBZ9qEcVyI3Q-kfubO | id=25 status=SUCCEEDED file=1MR_kZAAC_3LJzzHS9t2fsHwGWc2XhPhy | STALE_FILE_ID | cv=1JHXlqAlpuLuOH2ZBZ9qEcVyI3Q-kfubO ext=1MR_kZAAC_3LJzzHS9t2fsHwGWc2XhPhy |
| 1023881860 | id=134 file=1Dka4x1IfGZYMVWIpRlulsLYr7Ku-k95H | id=187 status=SUCCEEDED file=1G1Nw0BvkehOj0x9QrMN4ADVzosqQB6aI | STALE_FILE_ID | cv=1Dka4x1IfGZYMVWIpRlulsLYr7Ku-k95H ext=1G1Nw0BvkehOj0x9QrMN4ADVzosqQB6aI |
| 1023919735 | id=40 file=13yhGc0a8iAiF0g77O2uuONXZymBciCq3 | id=44 status=SUCCEEDED file=1sTF6TjmS_2aAh6vgrVrfSvoqJm9uQP5g | STALE_FILE_ID | cv=13yhGc0a8iAiF0g77O2uuONXZymBciCq3 ext=1sTF6TjmS_2aAh6vgrVrfSvoqJm9uQP5g |
| 1023936232 | id=95 file=1XFBSHeGy4BfjtKQKudRrwtjrhn6NSepZ | id=43 status=SUCCEEDED file=18Ono1LX6F-ePAnopp1It8DaGE3ATYKPZ | STALE_FILE_ID | cv=1XFBSHeGy4BfjtKQKudRrwtjrhn6NSepZ ext=18Ono1LX6F-ePAnopp1It8DaGE3ATYKPZ |
| 1023956513 | id=106 file=1jg34w0z2i1wm_4OKjyCt2ePZ00bQCcrf | id=23 status=SUCCEEDED file=1QeOZiTXK5qKp720iGn3hsBrGx-QVbSNM | STALE_FILE_ID | cv=1jg34w0z2i1wm_4OKjyCt2ePZ00bQCcrf ext=1QeOZiTXK5qKp720iGn3hsBrGx-QVbSNM |
| 1023960731 | id=142 file=1K_rgp4FAyioUuGjW8j8XNVlvmhCQC9u8 | id=192 status=SUCCEEDED file=1FpRt0cJ4rcTqPfT5E8gtCAF6jH82le96 | STALE_FILE_ID | cv=1K_rgp4FAyioUuGjW8j8XNVlvmhCQC9u8 ext=1FpRt0cJ4rcTqPfT5E8gtCAF6jH82le96 |
| 1024515606 | id=36 file=1k2fw_mkKeQac12nNqFYtpprCME-dsFhJ | id=42 status=SUCCEEDED file=1ntoWjCtrHcbwBlFGUhm1c-6V7ovLG1Dy | STALE_FILE_ID | cv=1k2fw_mkKeQac12nNqFYtpprCME-dsFhJ ext=1ntoWjCtrHcbwBlFGUhm1c-6V7ovLG1Dy |
| 1024546823 | id=60 file=10C49dMn3_-2sxQ1JMEBPIFw8RSFuZjCG | id=62 status=SUCCEEDED file=1lu_u-Y717VYN4_myoau5IM6VPKTCrxJp | STALE_FILE_ID | cv=10C49dMn3_-2sxQ1JMEBPIFw8RSFuZjCG ext=1lu_u-Y717VYN4_myoau5IM6VPKTCrxJp |
| 1026254889 | id=33 file=1R31FBLaszvcBEV1qKLpi11bF90LNSOci | id=144 status=SUCCEEDED file=1LxzMGUkrmIbap9s2GKUm9ytX6LrOJt3C | STALE_FILE_ID | cv=1R31FBLaszvcBEV1qKLpi11bF90LNSOci ext=1LxzMGUkrmIbap9s2GKUm9ytX6LrOJt3C |
| 1026301080 | id=38 file=1fVqGLAoS_yc_WulbCdByQyWNinzvYLuy | id=38 status=SUCCEEDED file=1P-fhGllYS0rIHdbH4c1GhBxF3BKvb46W | STALE_FILE_ID | cv=1fVqGLAoS_yc_WulbCdByQyWNinzvYLuy ext=1P-fhGllYS0rIHdbH4c1GhBxF3BKvb46W |
| 1028660359 | id=72 file=1YZYccwSKtHMg_PI2NVUhD91V6If_x35d | id=74 status=SUCCEEDED file=1uj1z3XrnjLUDIUzuxl_3OPaWXdbIgH4m | STALE_FILE_ID | cv=1YZYccwSKtHMg_PI2NVUhD91V6If_x35d ext=1uj1z3XrnjLUDIUzuxl_3OPaWXdbIgH4m |
| 1030581506 | id=54 file=1RC3eKrnj4oyKUajIxCXILg6IQHh9MvKd | id=34 status=SUCCEEDED file=1NaZ5b8St-aHbSJA8PYs2XMEX-s5ixTe3 | STALE_FILE_ID | cv=1RC3eKrnj4oyKUajIxCXILg6IQHh9MvKd ext=1NaZ5b8St-aHbSJA8PYs2XMEX-s5ixTe3 |
| 1030613471 | id=20 file=1tuOmTNKjV-81ujNvrA2g0Dr24sQyjbOc | id=141 status=SUCCEEDED file=1GVr9SofnGl3m1CnrEWE7cImBUpCwBRwc | STALE_FILE_ID | cv=1tuOmTNKjV-81ujNvrA2g0Dr24sQyjbOc ext=1GVr9SofnGl3m1CnrEWE7cImBUpCwBRwc |
| 1030623786 | id=109 file=1j3fXjeowZMQlHheQMygO8OHEtYpLt76l | id=22 status=SUCCEEDED file=1ZlZGdINZoYUe1g-5Qz6zMr6loTjE41Mf | STALE_FILE_ID | cv=1j3fXjeowZMQlHheQMygO8OHEtYpLt76l ext=1ZlZGdINZoYUe1g-5Qz6zMr6loTjE41Mf |
| 1030637464 | id=70 file=1Cp3Pt3qH2KWJBLjS-uY7LXTAeF0rUAlI | id=72 status=SUCCEEDED file=1LeRsLzf1g3lAcGUScqsmHR0X_XTZW_Cp | STALE_FILE_ID | cv=1Cp3Pt3qH2KWJBLjS-uY7LXTAeF0rUAlI ext=1LeRsLzf1g3lAcGUScqsmHR0X_XTZW_Cp |
| 1030665518 | id=130 file=1FGrPpF7Oss1tRre2eSCAKqZLtqGF11o6 | id=138 status=SUCCEEDED file=1fLSbGORI8J_FAzgfeiL-Lov1mle4jUrr | STALE_FILE_ID | cv=1FGrPpF7Oss1tRre2eSCAKqZLtqGF11o6 ext=1fLSbGORI8J_FAzgfeiL-Lov1mle4jUrr |
| 1030685001 | id=88 file=1IyL2xnVcBxjgk80P6dy0W7mHp2hS3Fi2 | id=54 status=SUCCEEDED file=1cyPwZ-lumY3nIi9rkys428HtEJqZUkJg | STALE_FILE_ID | cv=1IyL2xnVcBxjgk80P6dy0W7mHp2hS3Fi2 ext=1cyPwZ-lumY3nIi9rkys428HtEJqZUkJg |
| 1030696269 | id=76 file=1dOMpYAOWRKKfHqtoJcFlV9KWlyHetQUB | id=71 status=SUCCEEDED file=1oLsvG8LT6AMmmyOYTr3m0nxb_RMCNR1b | STALE_FILE_ID | cv=1dOMpYAOWRKKfHqtoJcFlV9KWlyHetQUB ext=1oLsvG8LT6AMmmyOYTr3m0nxb_RMCNR1b |
| 1031120087 | id=81 file=1fstwZCM65Refg6nl5FCQdE4Q3HJuFn0t | id=155 status=SUCCEEDED file=1uorv0WKTAD4ETlp8EDAIBwAnq8szG4ch | STALE_FILE_ID | cv=1fstwZCM65Refg6nl5FCQdE4Q3HJuFn0t ext=1uorv0WKTAD4ETlp8EDAIBwAnq8szG4ch |
| 1031130263 | id=91 file=1OlbjZWjooqkZnnDhDkL-7YA3VrNVSuGl | id=17 status=SUCCEEDED file=17ZECOnvnaa7ldMyErVd1Kxpu61VMmPT7 | STALE_FILE_ID | cv=1OlbjZWjooqkZnnDhDkL-7YA3VrNVSuGl ext=17ZECOnvnaa7ldMyErVd1Kxpu61VMmPT7 |
| 1031148616 | id=126 file=1nUAoZnF9g5E54qrAJ_Uznx_0GIxSg_K6 | id=165 status=SUCCEEDED file=1kzz0yj5AikwOD_uUjSZoEFalfZKWg6oM | STALE_FILE_ID | cv=1nUAoZnF9g5E54qrAJ_Uznx_0GIxSg_K6 ext=1kzz0yj5AikwOD_uUjSZoEFalfZKWg6oM |
| 1031154553 | — | — | NO_EXTRACTION | sin extracciones |
| 1031169885 | id=37 file=1LvaOEDoL6o4RZxiE42_Upj57b1EjC8b1 | id=46 status=SUCCEEDED file=1IrsmjVdL0wh_LaP45hlEK961wpMqG9Qk | STALE_FILE_ID | cv=1LvaOEDoL6o4RZxiE42_Upj57b1EjC8b1 ext=1IrsmjVdL0wh_LaP45hlEK961wpMqG9Qk |
| 1031170727 | id=118 file=15YbUOqBTE_ax42e_HfhuNioagpEwGaQe | id=28 status=SUCCEEDED file=1nJjI3LFs4p6x229hMhOWCoXXz_RO8e30 | STALE_FILE_ID | cv=15YbUOqBTE_ax42e_HfhuNioagpEwGaQe ext=1nJjI3LFs4p6x229hMhOWCoXXz_RO8e30 |
| 1032377700 | id=87 file=1aVqsMn2H_GMELnRNNLTh0-hN2zNi2WDX | id=67 status=SUCCEEDED file=1ocQq5zF49HNroFJ_oUiz-OwbDr8cp2Hm | STALE_FILE_ID | cv=1aVqsMn2H_GMELnRNNLTh0-hN2zNi2WDX ext=1ocQq5zF49HNroFJ_oUiz-OwbDr8cp2Hm |
| 1032421209 | id=181 file=1JP-nLFfR2B0ild0x1ZSAHkPDgOaJY-C_ | — | NO_EXTRACTION | sin extracciones |
| 1032454513 | id=98 file=1l5Yy8xWaDsEA72oqkVtg0AC-1CnjqMRX | id=66 status=SUCCEEDED file=1hE0uiAVWih6W9re_q-Nrc8_lmqKankRB | STALE_FILE_ID | cv=1l5Yy8xWaDsEA72oqkVtg0AC-1CnjqMRX ext=1hE0uiAVWih6W9re_q-Nrc8_lmqKankRB |
| 1033768569 | id=62 file=1TD9v_BB9jjSo60zymtNZWukqsnXqbU_f | id=47 status=SUCCEEDED file=1jubAy0b-p7tdvlSUlAiC5RywbVE5VFEh | STALE_FILE_ID | cv=1TD9v_BB9jjSo60zymtNZWukqsnXqbU_f ext=1jubAy0b-p7tdvlSUlAiC5RywbVE5VFEh |
| 1051589196 | id=86 file=1EwmIR2ldcIC0N-R8-MJkkQNjGJCIEw1M | id=15 status=SUCCEEDED file=1YD5lUqw5KconynEnDflCZJC1OuFOdxfv | STALE_FILE_ID | cv=1EwmIR2ldcIC0N-R8-MJkkQNjGJCIEw1M ext=1YD5lUqw5KconynEnDflCZJC1OuFOdxfv |
| 1057465646 | id=49 file=1EeMwLwDbg94YxYEl9Rx7n8cql7PsfeS8 | id=24 status=SUCCEEDED file=1_QLhZO0MW-_Pn_pIeliDeZTU4A7KUzUH | STALE_FILE_ID | cv=1EeMwLwDbg94YxYEl9Rx7n8cql7PsfeS8 ext=1_QLhZO0MW-_Pn_pIeliDeZTU4A7KUzUH |
| 1065812594 | id=74 file=19PAQLfRUo_i5knsz0xF7h5uuYA0PZq3d | id=69 status=SUCCEEDED file=1QB3vRPt490Z9nIlZ-GOFj0do9KeSluyr | STALE_FILE_ID | cv=19PAQLfRUo_i5knsz0xF7h5uuYA0PZq3d ext=1QB3vRPt490Z9nIlZ-GOFj0do9KeSluyr |
| 1068658455 | id=136 file=1QilCJuu0vUk5nnWxCupG8BmSN7GGRwM- | id=166 status=SUCCEEDED file=1fudTIrVEgypOTB6vwssX4UEatIbmfDvL | STALE_FILE_ID | cv=1QilCJuu0vUk5nnWxCupG8BmSN7GGRwM- ext=1fudTIrVEgypOTB6vwssX4UEatIbmfDvL |
| 1070980508 | id=183 file=1mhblRwcIf3Tz0H_zhazeItHm2V3cKT8j | — | NO_EXTRACTION | sin extracciones |
| 1072425537 | id=34 file=1uyFYGOoNMnd98Vo2A-7CX3EzO9wqngH5 | id=16 status=SUCCEEDED file=1kFott0AfzYCc8TwejlUFkcQAqeXxxboW | STALE_FILE_ID | cv=1uyFYGOoNMnd98Vo2A-7CX3EzO9wqngH5 ext=1kFott0AfzYCc8TwejlUFkcQAqeXxxboW |
| 1072896519 | id=189 file=1UAc1y7_rlVI0FFCpDUIABTDL8h9gDpqN | id=201 status=SUCCEEDED file=1o59ddF5PbMMa41Fo4bqBpNP1SieeCejG | STALE_FILE_ID | cv=1UAc1y7_rlVI0FFCpDUIABTDL8h9gDpqN ext=1o59ddF5PbMMa41Fo4bqBpNP1SieeCejG |
| 1075257835 | id=101 file=1WC9eFvm-I00h_c6MLEutUbAEE_aKcb2l | id=35 status=SUCCEEDED file=1FwWeColSuSknXPSAiMb0IFOrDydS7S7L | STALE_FILE_ID | cv=1WC9eFvm-I00h_c6MLEutUbAEE_aKcb2l ext=1FwWeColSuSknXPSAiMb0IFOrDydS7S7L |
| 1085329631 | — | — | NO_EXTRACTION | sin extracciones |
| 1095822996 | id=44 file=1lLPLSky7qCyNNoaOBREVASj3NXHdGYQU | id=29 status=SUCCEEDED file=1MRiWJdpnsXbNfGpUZuKgbj6BhpQaEsrs | STALE_FILE_ID | cv=1lLPLSky7qCyNNoaOBREVASj3NXHdGYQU ext=1MRiWJdpnsXbNfGpUZuKgbj6BhpQaEsrs |
| 1112100836 | id=103 file=1pcP77Pq7DmtMVJJzOrj86sVbATY9Petk | id=21 status=SUCCEEDED file=1fOVT8uh5HKxHrwCxiiYyEDwv1g5uJ4SN | STALE_FILE_ID | cv=1pcP77Pq7DmtMVJJzOrj86sVbATY9Petk ext=1fOVT8uh5HKxHrwCxiiYyEDwv1g5uJ4SN |
| 1136886244 | id=100 file=1MlFNprAiutHENlPruxC2Wy5WtL008JGd | id=48 status=SUCCEEDED file=1LhtAPxrVrKYwLxOHoOSs8rlehxKUA0cy | STALE_FILE_ID | cv=1MlFNprAiutHENlPruxC2Wy5WtL008JGd ext=1LhtAPxrVrKYwLxOHoOSs8rlehxKUA0cy |
| 1140828608 | id=90 file=1V8pxMHDP3knZxD5cthWa2SOuqpurrH7L | id=49 status=SUCCEEDED file=1Vfjuwq9V7yAgZsYNVIRi-E-IOO79RukC | STALE_FILE_ID | cv=1V8pxMHDP3knZxD5cthWa2SOuqpurrH7L ext=1Vfjuwq9V7yAgZsYNVIRi-E-IOO79RukC |
| 1221974191 | id=184 file=1J5oNbAjiKGm3z-wXDe0_Hc65q54wzKRz | — | NO_EXTRACTION | sin extracciones |
| 1233497340 | id=129 file=1_Yq_3KLYh6JEOt0MrUCXDACeF0FAFWgX | id=137 status=SUCCEEDED file=1nMvN9JD9lJwe-CZFghIvxlNthUX-NlyL | STALE_FILE_ID | cv=1_Yq_3KLYh6JEOt0MrUCXDACeF0FAFWgX ext=1nMvN9JD9lJwe-CZFghIvxlNthUX-NlyL |
| 37728856 | id=141 file=1NOuBCsJWkQM92u6tliCxyjRKymGXKG4- | id=128 status=SUCCEEDED file=1bb9s3vt0051e_5DBv8t4GjM3SKbYZNGN | STALE_FILE_ID | cv=1NOuBCsJWkQM92u6tliCxyjRKymGXKG4- ext=1bb9s3vt0051e_5DBv8t4GjM3SKbYZNGN |
| 50935341 | id=132 file=11Um564-YgW9KNfSbu7DsuW5YyXiphBBk | id=124 status=SUCCEEDED file=1FZc6ESPPCHqgfXeyq_tgu5KJtDcPz8w1 | STALE_FILE_ID | cv=11Um564-YgW9KNfSbu7DsuW5YyXiphBBk ext=1FZc6ESPPCHqgfXeyq_tgu5KJtDcPz8w1 |
| 52169436 | id=35 file=13KH3seBEBSmiywF9rS9dv7w-D44csdcQ | id=32 status=SUCCEEDED file=19xQPl_B4s2jJrEGIpsazWTLe3nOvhUsX | STALE_FILE_ID | cv=13KH3seBEBSmiywF9rS9dv7w-D44csdcQ ext=19xQPl_B4s2jJrEGIpsazWTLe3nOvhUsX |
| 74085570 | id=185 file=1VhjVywrHcWFoe9G6nt16PLBWtUhipBCC | — | NO_EXTRACTION | sin extracciones |
| 79709251 | id=131 file=1LfOyFlhx7qPhXTzp2F6z5RUEF54_ARuZ | id=135 status=SUCCEEDED file=1apc2ZSBKpHEgHC50cg5zEjIoSQCYTy40 | STALE_FILE_ID | cv=1LfOyFlhx7qPhXTzp2F6z5RUEF54_ARuZ ext=1apc2ZSBKpHEgHC50cg5zEjIoSQCYTy40 |
| 80421137 | id=39 file=1mi5P6TYp8mnUpE4f50cwgc8lUy8p_ogo | id=36 status=SUCCEEDED file=1jfujPF7LxpMEbRaYExcC3PcEWj4lwRzP | STALE_FILE_ID | cv=1mi5P6TYp8mnUpE4f50cwgc8lUy8p_ogo ext=1jfujPF7LxpMEbRaYExcC3PcEWj4lwRzP |
| 80761140 | id=102 file=1amb_CDd5josS-pMcA7oUAqwis0LgWjiM | id=65 status=SUCCEEDED file=1rZCch9y75vPeTqcIMIDWBXB56-3NqPRf | STALE_FILE_ID | cv=1amb_CDd5josS-pMcA7oUAqwis0LgWjiM ext=1rZCch9y75vPeTqcIMIDWBXB56-3NqPRf |
| 80802023 | id=186 file=1x-JhFHV9O1mSHEffvDWOts1Lvxf2fE_6 | — | NO_EXTRACTION | sin extracciones |
| 1000335642 | — | id=179 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1000615547 | — | id=158 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1000810767 | — | id=182 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1007287166 | — | id=127 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1012344155 | — | id=129 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1012362121 | — | id=132 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1013102120 | — | id=148 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1013584506 | — | id=133 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1015395122 | — | id=37 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1016081697 | — | id=30 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1016146130 | — | id=140 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1019028608 | — | id=59 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1019117022 | — | id=9 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1020841798 | — | id=3 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1022394599 | — | id=50 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1023960857 | — | id=13 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1023973897 | — | id=33 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 103154553 | — | id=106 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1032463962 | — | id=51 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1033692788 | — | id=122 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1057586679 | — | id=7 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1085329632 | — | id=184 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 1193510625 | — | id=6 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 52866878 | — | id=53 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 80175161 | — | id=56 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 80723984 | — | id=14 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |
| 93135969 | — | id=153 status=SUCCEEDED | NO_EXTRACTION | extracción activa sin person_cv activo |

## 5. Consolidado (solo no HEALTHY)

| Documento | En Drive | En person_cv | En Extraction | Estado global | Acción sugerida |
| --------- | -------- | ------------ | ------------- | ------------- | --------------- |
| 1000019945 | Sí | No | Sí | MANUAL_REVIEW | Resolver duplicados / nombres / múltiples activos manualmente |
| 1000020890 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000047404 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000120580 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000158865 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 100033564 | Sí | No | No | NEEDS_SYNC | Sincronizar Drive → person_cv (cuando se autorice) |
| 1000335642 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1000351000 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000468520 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000572345 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 1000615547 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 10006155547 | Sí | No | No | NEEDS_SYNC | Sincronizar Drive → person_cv (cuando se autorice) |
| 1000626221 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000733403 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000785514 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 1000810767 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1000862484 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1001045749 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 1001053316 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1001187596 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1001200367 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1001270269 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1002461766 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1003432473 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1003641753 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 1007287166 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1007627445 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1007783201 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1010117182 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 1010224925 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1010247929 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1012341248 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1012344155 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1012362121 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1012410286 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1012433410 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1013099772 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1013100614 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1013102120 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1013584506 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1013588273 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1013588596 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1013608570 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 1013675353 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1014199988 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1014239052 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 1014304786 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 1015395122 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1015428917 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1016081697 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1016146130 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1018416748 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1018420012 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1019028608 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1019117022 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1019146130 | Sí | No | No | NEEDS_SYNC | Sincronizar Drive → person_cv (cuando se autorice) |
| 1020749844 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1020774620 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 1020841798 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1022322100 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1022373489 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1022394599 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1022395317 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1022404607 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 1022428652 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1022945473 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023034328 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023881860 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023919735 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023936232 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023956513 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023960731 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023960857 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1023973897 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1024515606 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1024546823 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1026254889 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1026301080 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1028660359 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030581506 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030613471 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030623786 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030637464 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030665518 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030685001 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030696269 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1031120087 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1031130263 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1031148616 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1031154553 | Sí | No | No | NEEDS_SYNC | Sincronizar Drive → person_cv (cuando se autorice) |
| 1031169885 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1031170727 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 103154553 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1032377700 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1032421209 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 1032454513 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1032463962 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1033692788 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1033768569 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1051589196 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1057465646 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1057586679 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1065812594 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1068658455 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1070980508 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 1072425537 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1072896519 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1075257835 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1082955522 | No | Sí | Sí | ORPHAN_PERSON_CV | Revisar: desactivar person_cv o restaurar PDF en Drive |
| 1085329631 | Sí | No | No | NEEDS_SYNC | Sincronizar Drive → person_cv (cuando se autorice) |
| 1085329632 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1095822996 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1112100836 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1136886244 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1140828608 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 1193510625 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 1221974191 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 1233497340 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 37728856 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 50935341 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 52169436 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 52866878 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 74085570 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 79709251 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 80175161 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 80421137 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 80723984 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |
| 80761140 | Sí | Sí | Sí | STALE_EXTRACTION | Reextracción sobre person_cv actual (cuando se autorice) |
| 80802023 | Sí | Sí | No | NEEDS_REEXTRACTION | Ejecutar extracción nueva (cuando se autorice) |
| 93135969 | No | No | Sí | ORPHAN_EXTRACTION | Revisar extracción activa sin CV/Drive |

## 6. Casos críticos

| Documento | Problema | Causa probable | Acción recomendada |
| --------- | -------- | -------------- | ------------------ |
| 1000019945 | MANUAL_REVIEW / Drive:DUPLICATE_IN_DRIVE / Ext:NO_EXTRACTION | Duplicados, nombres inválidos o múltiples activos | Resolver duplicados / nombres / múltiples activos manualmente |
| 1000020890 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000047404 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000120580 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000158865 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 100033564 | NEEDS_SYNC / Drive:MISSING_IN_PERSON_CV / Ext:NO_EXTRACTION | PDF en Drive sin reflejo actualizado en person_cv | Sincronizar Drive → person_cv (cuando se autorice) |
| 1000335642 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1000351000 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000468520 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000572345 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 1000615547 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 10006155547 | NEEDS_SYNC / Drive:MISSING_IN_PERSON_CV / Ext:NO_EXTRACTION | PDF en Drive sin reflejo actualizado en person_cv | Sincronizar Drive → person_cv (cuando se autorice) |
| 1000626221 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000733403 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1000785514 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 1000810767 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1000862484 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1001045749 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 1001053316 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1001187596 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1001200367 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1001270269 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1002461766 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1003432473 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1003641753 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 1007287166 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1007627445 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1007783201 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1010117182 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 1010224925 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1010247929 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1012341248 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1012344155 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1012362121 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1012410286 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1012433410 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1013099772 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1013100614 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1013102120 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1013584506 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1013588273 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1013588596 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1013608570 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 1013675353 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1014199988 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1014239052 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 1014304786 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 1015395122 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1015428917 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1016081697 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1016146130 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1018416748 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1018420012 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1019028608 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1019117022 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1019146130 | NEEDS_SYNC / Drive:MISSING_IN_PERSON_CV / Ext:NO_EXTRACTION | PDF en Drive sin reflejo actualizado en person_cv | Sincronizar Drive → person_cv (cuando se autorice) |
| 1020749844 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1020774620 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 1020841798 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1022322100 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1022373489 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1022394599 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1022395317 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1022404607 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 1022428652 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1022945473 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023034328 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023881860 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023919735 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023936232 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023956513 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023960731 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1023960857 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1023973897 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1024515606 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1024546823 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1026254889 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1026301080 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1028660359 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030581506 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030613471 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030623786 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030637464 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030665518 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030685001 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1030696269 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1031120087 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1031130263 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1031148616 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1031154553 | NEEDS_SYNC / Drive:MISSING_IN_PERSON_CV / Ext:NO_EXTRACTION | PDF en Drive sin reflejo actualizado en person_cv | Sincronizar Drive → person_cv (cuando se autorice) |
| 1031169885 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1031170727 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 103154553 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1032377700 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1032421209 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 1032454513 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1032463962 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1033692788 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1033768569 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1051589196 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1057465646 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1057586679 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1065812594 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1068658455 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1070980508 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 1072425537 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1072896519 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1075257835 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1082955522 | ORPHAN_PERSON_CV / Drive:MISSING_IN_DRIVE / Ext:CURRENT | CV visible/sincronizado pero PDF ya no está en carpeta oficial | Revisar: desactivar person_cv o restaurar PDF en Drive |
| 1085329631 | NEEDS_SYNC / Drive:MISSING_IN_PERSON_CV / Ext:NO_EXTRACTION | PDF en Drive sin reflejo actualizado en person_cv | Sincronizar Drive → person_cv (cuando se autorice) |
| 1085329632 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1095822996 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1112100836 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1136886244 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1140828608 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 1193510625 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 1221974191 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 1233497340 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 37728856 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 50935341 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 52169436 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 52866878 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 74085570 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 79709251 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 80175161 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 80421137 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 80723984 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |
| 80761140 | STALE_EXTRACTION / Drive:ALIGNED / Ext:STALE_FILE_ID | Extracción activa apunta a drive_file_id anterior | Reextracción sobre person_cv actual (cuando se autorice) |
| 80802023 | NEEDS_REEXTRACTION / Drive:ALIGNED / Ext:NO_EXTRACTION | Hay CV alineado pero falta extracción usable | Ejecutar extracción nueva (cuando se autorice) |
| 93135969 | ORPHAN_EXTRACTION / Ext:CURRENT | Desalineación multi-capa | Revisar extracción activa sin CV/Drive |

### PDFs con nombre inválido

| Nombre | Ruta | file_id |
| ------ | ---- | ------- |
| 1082955522.pdf.pdf | DESARROLLO PROFESIONAL/1082955522.pdf.pdf | `1s5DsPtPtLeYT7PzEbeej5GYP509wCdsX` |
| 1016105936 .pdf | OPERACIONES ACADEMICAS/NEGOCIOS/1016105936 .pdf | `1YTF0JR3Js9PM7Xj106GmVJ7x7kO3lJWB` |
| 52866878 .pdf | OPERACIONES ACADEMICAS/TRANSVERSALES/52866878 .pdf | `1vk9SzyN4QgEliK7aiiXiNfAWXU2pcWrq` |

## 7. Diagnóstico

1. **¿BD alineada con Drive?** Parcialmente: 126 ALIGNED de 133 documentos en universo; 5 faltan en person_cv y 1 person_cv sin PDF.
2. **¿CV visibles en Organigrama inexistentes en Drive?** Sí, **1** (MISSING_IN_DRIVE / ORPHAN_PERSON_CV).
3. **¿PDFs en Drive nunca sincronizados?** Sí, **5** (MISSING_IN_PERSON_CV).
4. **¿Extracciones con drive_file_id antiguo?** **80** (STALE_FILE_ID).
5. **Problema principal:** mixto — primero **sincronización** (huecos Drive→person_cv y huérfanos), luego **reextracción** (STALE_FILE_ID / sin extracción), y en menor medida **datos** (duplicados / nombres inválidos).

### Causas por impacto

1. Desfase sync Drive → `person_cv` (faltantes y huérfanos).
2. Extracciones activas con `drive_file_id` histórico ≠ `person_cv` actual.
3. Ausencia de extracción sobre CVs ya alineados.
4. Duplicados / nombres inválidos en Drive (ruido operativo).

## 8. Plan recomendado (no ejecutado)

| Fase | Acción | Resultado esperado | Riesgo |
| ---- | ------ | ------------------ | ------ |
| R1 | Dry-run `sync:drive-cv` sobre folder oficial | Plan INSERT/UPDATE/DEACTIVATE | Bajo |
| R2 | Aplicar sync solo faltantes + file_id changed (con confirmación) | person_cv alineado a Drive | Medio |
| R3 | Revisar ORPHAN_PERSON_CV (desactivar o restaurar PDF) | Organigrama no muestra CV fantasma | Medio |
| R4 | Reextracción de STALE_FILE_ID + NO_EXTRACTION | Extracciones CURRENT | Medio-alto |
| R5 | Resolver DUPLICATE_IN_DRIVE / INVALID_FILE_NAME | Inventario unívoco | Bajo |
| R6 | Re-correr esta auditoría RO | HEALTHY ↑, críticos ↓ | Nulo |

## 9. Confirmación

```text
No se modificó Google Drive.
No se modificó person_cv.
No se modificó cv_extraction.
No se ejecutó sync.
No se crearon extracciones.
No se actualizaron registros.
No commit.
No push.
writes: 0.
```

## 10. Artefacto JSON

`tmp/mc-drive-personcv-reconciliation.json` (inventario detallado).
