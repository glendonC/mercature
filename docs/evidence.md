# Evidence

The figures behind the problem Mercature addresses, the data it is built with, and what that data does not cover. Each figure is quoted from the linked source with the place and year it describes. Nothing is rounded unless the text says so.

## The problem in figures

### Visitors and small operators

| Figure | Place and year | Source |
| --- | --- | --- |
| 4,157,469 international visitors: 3,416,464 tourists and 741,005 same-day visitors (excursionistas), 78.8% of the 2019 level | Peru, 2025 (preliminary) | [MINCETUR, Reporte Mensual de Turismo, diciembre 2025](https://www.gob.pe/institucion/mincetur/informes-publicaciones/7619520-reportes-de-turismo-reporte-mensual-de-turismo-diciembre-2025), published 14 January 2026, from Migraciones border records |
| 18,356 international tourists resident in South Korea, 0.5% of all tourists (29,652 in 2019) | Peru, 2025 (preliminary) | Same report, p. 4 |
| 5,275,000 international tourism arrivals in 2019 and 1,119,000 in 2020; the series has no Peru value after 2020 in its 13 July 2026 update, so the MINCETUR figures above are used for 2025 | Peru, 2019 and 2020 | [World Bank WDI, ST.INT.ARVL](https://data.worldbank.org/indicator/ST.INT.ARVL?locations=PE) |
| 70.2% of employed people had informal employment; 94.8% in rural areas | Peru, 2025 | [INEI, Comportamiento de los indicadores del mercado laboral a nivel nacional, Enero-Diciembre 2025](https://m.inei.gob.pe/media/MenuRecursivo/boletines/01-informe-tecnico-empleo-nacional.pdf), February 2026, Cuadro N° 1.20 |
| 71.7% of employed people work in units of 1 to 10 workers, and 88.6% of those workers are informal | Peru, 2025 | Same report, Gráfico N° 1.9 and Cuadro N° 1.22 |
| 58% of formal firms with five or more employees compete with unregistered or informal firms; practices of the informal sector are the second most cited biggest obstacle (13% of firms, after political instability at 47%) | Peru, 987 firms surveyed August 2022 to August 2023 | [World Bank Enterprise Surveys, Peru 2023 Country Profile](https://www.enterprisesurveys.org/content/dam/enterprisesurveys/documents/country/Peru-2023.pdf), Figures 16 and 21 |

### Coffee and the place

| Figure | Place and year | Source |
| --- | --- | --- |
| Cusco had 63,266 ha of coffee planted and 58,023 ha harvested, of 460,114 ha planted nationally; Cajamarca, San Martín, Junín, Amazonas and Cusco produced 84% of Peru's coffee | Peru, 2022 (provisional) | [MIDAGRI, Nota Técnica de Coyuntura Económica Agraria N.° 014-2023](https://cdn.www.gob.pe/uploads/document/file/4922461/N.%C2%B0014%7C%20Producci%C3%B3n%20y%20exportaci%C3%B3n%20de%20caf%C3%A9%20convencional%20y%20org%C3%A1nico%20en%20el%20Per%C3%BA.pdf?v=1690851294), 2023, Cuadro N.° 1 and section 3 |
| Coffee production involves 230,000 families (Junta Nacional del Café estimate, cited by MIDAGRI) | Peru, 2023 | Same note |
| 85% of coffee growers farm one to five hectares, and only 30% of them belong to an association, mainly cooperatives (statement by the vice minister) | Peru, 2023 | [MIDAGRI press release](https://www.gob.pe/institucion/midagri/noticias/875833-midagri-el-85-de-los-caficultores-nacionales-son-pequenos-productores-de-hasta-cinco-hectareas), 1 December 2023 |

### Language

| Figure | Place and year | Source |
| --- | --- | --- |
| 3,735,682 people aged 5 and over (13.9%) learned Quechua as their mother tongue; in the Cusco region, 609,655 (55.2%) | Peru, 2017 census | [INEI, Perú: Perfil Sociodemográfico, Informe Nacional, Censos Nacionales 2017](https://www.inei.gob.pe/media/MenuRecursivo/publicaciones_digitales/Est/Lib1539/libro.pdf), 2018, p. 197 and Cuadro N° 2.64 |

### Phones and connectivity

| Figure | Place and year | Source |
| --- | --- | --- |
| 89.2% of rural households have a mobile phone, 27.1% have internet service and 8.9% have a computer | Rural Peru, April to June 2026 | [INEI, Estadísticas de las Tecnologías de Información y Comunicación en los Hogares, II Trimestre 2026](https://www.gob.pe/institucion/inei/informes-publicaciones/8655560-las-tecnologias-de-informacion-y-comunicacion-en-los-hogares-ii-trimestre-2026), Informe Técnico N° 03, September 2026 |
| 63.7% of rural people aged 6 and over used the internet, 89.0% of them through a mobile phone; 84.2% used a mobile phone, counting a relative's or a friend's | Rural Peru, April to June 2026 | Same report |

### Access for visitors with disabilities

| Figure | Place and year | Source |
| --- | --- | --- |
| 1.3 billion people, 16% of the world's population, experience significant disability | World, WHO estimate | [WHO fact sheet, Disability](https://www.who.int/news-room/fact-sheets/detail/disability-and-health), 7 March 2023 |
| 3,051,612 people (10.4% of the population) reported a permanent difficulty in daily activities, counted by INEI as disability; 9.3% in rural areas | Peru, 2017 census | INEI census profile above, p. 177 |
| The potential accessible tourism market in Latin America and the Caribbean is 85 million people, and travellers with disabilities are accompanied by 2 to 3 additional clients | Latin America and the Caribbean, 2024 | [UN Tourism news release](https://www.untourism.int/news/un-tourism-accessible-travel-a-game-changer-for-destinations-and-businesses), 3 December 2024, launching accessible tourism guidelines, including one for tour operators, built around ISO 21902:2021 |

### What the figures mean for the design

- 71.7% of Peruvian workers are in units of 1 to 10 people, and 88.6% of those are informal. The tool is built for that scale: no accounts, no server and no staff. It does the reading and sorting; the operator decides.
- 89.2% of rural households have a mobile phone and 27.1% have internet service. The core has to run on a phone, offline, after one download.
- Quechua is the mother tongue of 55.2% of the Cusco region's population aged 5 and over, and it is a less-supported language for the model. The tool is tested on Quechua messages and reports its failures.
- UN Tourism reports 2 to 3 companions per traveller with a disability, so a blocked path can affect a whole group. The site check shows whether a wheelchair-width path reaches each place.

## Data the tool is built with

| Data | What it is | License | Size |
| --- | --- | --- | --- |
| Sentence encoder | [intfloat/multilingual-e5-small](https://huggingface.co/intfloat/multilingual-e5-small/blob/614241f622f53c4eeff9890bdc4f31cfecc418b3/README.md), 12 layers, 384-dimensional embeddings, used through the pinned [Transformers.js q8 ONNX export](https://huggingface.co/Xenova/multilingual-e5-small/tree/761b726dd34fb83930e26aab4e9ac3899aa1fa78) | MIT, per the publisher's model card | ONNX file 118,308,185 bytes; tokenizer 17,082,730 bytes |
| Example visitor messages | Synthetic. Written by a large language model for this project; no message was written by a person or sent by a visitor. Each message family has English, Spanish and Korean versions written as separate paraphrases with the same labels. A subset also has a Quechua version, machine-translated by the same model and aimed at Southern Quechua (Cusco-Collao). Every record states its language, whether it was written directly or machine-translated, its family and its labels: message kind, issue type and site features. Quechua is used for held-out testing only. File: `scripts/language/messages.json` | CC0-1.0 | Counts, splits and results in [language](language.md) |
| Noor's farm site | Synthetic. An authored model of a coffee farm tasting terrace with named features in Spanish and English ([inventory](../src/site/inventory.ts)). Its layout and dimensions are invented, not measured. A few Quechua aliases are included, unreviewed | Part of this repository | 17 features |
| Recorded destination examples | The three Home destinations: Qorikancha (Cusco), Narikala (Tbilisi) and Swayambhu (Kathmandu). 781 Mapillary street photo records (403, 359 and 19), captured between 2015 and 2025 and credited per photo; places, streets and paths from OpenStreetMap; walking routes from the public Valhalla server on OpenStreetMap data; partial 3D for Qorikancha and Narikala from [VGGT-1B-Commercial](https://huggingface.co/facebook/VGGT-1B-Commercial); outlines of steps, kerbs and barriers from [SAM 3](https://github.com/facebookresearch/sam3) that nobody has checked. Kept on the development machine, never in the repository or the build | Photos [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/); OpenStreetMap [ODbL 1.0](https://www.openstreetmap.org/copyright); Valhalla MIT; VGGT custom license; SAM License | About 155 MB |
| Cover photos | Three Wikimedia Commons photos on Home, used for navigation only: Qorikancha by Draceane (2023), Narikala by shankar s. (2016), Swayambhu by Jorge Láscar (2014) | CC BY-SA 4.0, CC BY 2.0 and CC BY 2.0; see [attribution](../ATTRIBUTION.md) | Resized WebP copies |

## What the data does not cover

- **Real visitors.** No message comes from a real visitor, and no person wrote any of the examples. There is no sample of how real visitors write: length, spelling, mixed languages or several topics in one message.
- **Native speakers.** No native speaker has reviewed the English, Spanish, Korean or Quechua messages, or the Quechua aliases in the site inventory. How natural or correct the machine-translated Quechua is remains unknown.
- **Quechua in the model.** The encoder's model card says it supports the 100 languages of XLM-R and warns that low-resource languages may see performance degradation. The [XLM-R card](https://huggingface.co/FacebookAI/xlm-roberta-base) lists English, Spanish and Korean, not Quechua. The encoder's own training data includes NLLB translation pairs, so some exposure to Quechua cannot be ruled out. Quechua results show how the model fares on a language outside its listed languages.
- **The operator's own language.** The operator interface is in Spanish and English. Noor's home language, Quechua, is not offered in the interface.
- **Measured sites.** Noor's farm is authored; its widths, distances and obstacles are invented. The path check models a fixed-width square envelope and headroom on level authored surfaces. It does not check slope, surfaces such as mud, step height or turning space, and it does not cover needs other than wheelchair-width passage, such as low vision or hearing.
- **Recorded imagery.** The Mapillary photos date from 2015 to 2025 and may not show current conditions. The SAM 3 outlines are unchecked, the 3D is partial for Qorikancha and Narikala and absent for Swayambhu, and none of it feeds the path check.
- **Operators and phones.** No study with real operators on their own phones: time saved, correction effort and trust are unmeasured.
- **Tourism figures.** MINCETUR counts border arrivals by country of residence. It does not count farm tour visitors, the languages they write in, or visitors with disabilities. These sources give no figure for Korean-speaking visitors to La Convención.
- **Firms and informality.** INEI's informality figures cover all sectors, not tourism alone. The Enterprise Surveys exclude informal firms and firms with fewer than five employees, which is where an operator like Noor sits.
- **Place.** Coffee figures are for the Cusco region, not La Convención province. Connectivity figures are averages for rural Peru, not La Convención, and INEI's phone figures do not separate smartphones from basic phones.
- **Disability figures.** WHO and INEI measure disability differently, so their figures are not comparable. Neither counts visitors with disabilities at Peruvian tourism sites, and UN Tourism's 85 million is a regional estimate of potential demand.
