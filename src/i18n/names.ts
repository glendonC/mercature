/** A street or a place: "la" or "el", and the common noun in lower case, as in "la calle Loreto". */
const LOWER_LA = /^(Avenida|Boletería|Calle|Cresta|Cuesta|Entrada|Escalinata|Estación|Puerta|Subida)$/;
const LOWER_EL = /^(Jirón|Pasaje|Paseo|Templo)$/;
/** A landmark whose name keeps its capital, as in "la Plaza de Armas" or "el Portal de Carrizos". */
const NAMED_LA = /^(Basílica|Capilla|Casa|Catedral|Fortaleza|Iglesia|Municipalidad|Plaza|Plazoleta|Torre|Universidad)$/;
const NAMED_EL = /^(Arco|Colegio|Convento|Malecón|Mercado|Mirador|Monasterio|Museo|Palacio|Parque|Portal|Puente|Teatro)$/;

/** A place name as Spanish prose needs it after "desde", "hasta", "en" or "cerca de". A bare proper name stays bare. */
export function esPlace(name: string): string {
  const first = name.split(' ')[0], rest = name.slice(first.length);
  if (LOWER_LA.test(first)) return `la ${first.toLocaleLowerCase()}${rest}`;
  if (LOWER_EL.test(first)) return `el ${first.toLocaleLowerCase()}${rest}`;
  if (NAMED_LA.test(first)) return `la ${name}`;
  if (NAMED_EL.test(first)) return `el ${name}`;
  return name;
}

/** "de" before a phrase, contracting "de el" to "del": "cerca del Portal de Carrizos". */
export const esDe = (phrase: string) => phrase.startsWith('el ') ? `del ${phrase.slice(3)}` : `de ${phrase}`;
/** "a" before a phrase, contracting "a el" to "al". */
export const esA = (phrase: string) => phrase.startsWith('el ') ? `al ${phrase.slice(3)}` : `a ${phrase}`;
