import type { Site, SiteFeature } from './contracts';

/**
 * A spot on the recorded walk from the Plaza de Armas to the Qorikancha ticket booth.
 * stretches indexes the record's 10 m "stretches" and is empty for a landmark that is not a flagged stretch;
 * landmark is the OpenStreetMap name the spot is near or is, or the record's own name for either end of the walk.
 */
export type RouteSpot = SiteFeature & { readonly stretches: readonly number[]; readonly landmark: string };
/** Usable wherever Pick<Site, 'id' | 'features'> is expected. folder names its published package under public/places. */
export type RoutePlace = Pick<Site, 'id'> & { readonly folder: string; readonly features: readonly RouteSpot[] };

/**
 * The words visitors use for this walk, authored from the local record cusco-qorikancha (mercature-route/1).
 * Photo findings are model suggestions that nobody has verified, a stretch without findings only means
 * no barrier was seen in photos, and nothing here states a width, height, slope or whether anyone can pass.
 */
export const QORIKANCHA_PLACE: RoutePlace = {
  id: 'cusco-qorikancha',
  folder: 'qorikancha',
  features: [
    {
      id: 'steps-0-10', stretches: [0], landmark: 'Hauqaypata',
      name: { en: 'Steps at the Plaza de Armas (0 to 10 m)', es: 'Escalones en la Plaza de Armas (0 a 10 m)' },
      description: 'Steps where the walk leaves the Plaza de Armas, the main square with the cathedral, suggested by a model in a street photo and not verified.',
      aliases: { en: ['steps', 'stairs', 'main square', 'start of the walk'], es: ['escalones', 'gradas', 'plaza de armas'], ko: ['계단', '아르마스 광장'], qu: ['Huacaypata'] },
    },
    {
      id: 'kerb-80-100', stretches: [8, 9], landmark: 'Portal de Carrizos',
      name: { en: 'Kerb near Portal de Carrizos (80 to 100 m)', es: 'Bordillo cerca del Portal de Carrizos (80 a 100 m)' },
      description: 'A kerb to cross with no ramp found at the edge of the Plaza de Armas, near the Portal de Carrizos arcade and the Compañía church, suggested by a model in a street photo and not verified.',
      aliases: { en: ['kerb', 'curb', 'high curb', 'no ramp', 'crossing'], es: ['bordillo', 'sardinel', 'vereda alta', 'sin rampa', 'cruce'], ko: ['연석', '턱', '경사로 없음', '횡단보도'] },
    },
    {
      id: 'steps-130-140', stretches: [13], landmark: 'Loreto',
      name: { en: 'Steps on Calle Loreto (130 to 140 m)', es: 'Escalones en la calle Loreto (130 a 140 m)' },
      description: 'Steps on Calle Loreto, the narrow Inca-walled street beside the Compañía church, suggested by a model in a street photo and not verified.',
      aliases: { en: ['steps', 'stairs', 'Loreto street', 'Inca wall'], es: ['escalones', 'gradas', 'calle Loreto', 'muro inca'], ko: ['계단', '로레토 거리'] },
    },
    {
      id: 'no-photos-150-170', stretches: [15, 16], landmark: 'Loreto',
      name: { en: 'No photos on Calle Loreto (150 to 170 m)', es: 'Sin fotos en la calle Loreto (150 a 170 m)' },
      description: 'No street photos cover this part of Calle Loreto between the Compañía church and the Santa Catalina monastery, so nothing is known about it.',
      aliases: { en: ['no photos', 'unseen part', 'Loreto street'], es: ['sin fotos', 'tramo sin fotos', 'calle Loreto'], ko: ['사진 없음', '로레토 거리'] },
    },
    {
      id: 'steps-340-350', stretches: [34], landmark: 'Loreto',
      name: { en: 'Stone steps on Calle Loreto (340 to 350 m)', es: 'Escalones de piedra en la calle Loreto (340 a 350 m)' },
      description: 'Stone steps on Calle Loreto where it meets Maruri and Pampa del Castillo, which OpenStreetMap records as 5 steps with no handrail and no ramp and a model also suggests in 3 street photos, none of it verified.',
      aliases: { en: ['steps', 'stairs', 'stone steps', 'staircase', 'no handrail'], es: ['escalones', 'escaleras', 'gradas', 'sin pasamanos', 'calle Loreto'], ko: ['계단', '돌계단', '난간 없음'] },
    },
    {
      id: 'steps-590-594', stretches: [59], landmark: 'Iglesia de Santo Domingo',
      name: { en: 'Steps near Iglesia de Santo Domingo (590 to 594 m)', es: 'Escalones cerca de la Iglesia de Santo Domingo (590 a 594 m)' },
      description: 'Steps at the end of the walk by the Qorikancha ticket booth, near the Santo Domingo church, suggested by a model in a street photo and not verified.',
      aliases: { en: ['steps', 'stairs', 'entrance steps', 'ticket booth'], es: ['escalones', 'gradas', 'entrada', 'boletería'], ko: ['계단', '입구 계단', '매표소'] },
    },
    {
      id: 'plaza-de-armas', stretches: [], landmark: 'Plaza de Armas',
      name: { en: 'Plaza de Armas', es: 'Plaza de Armas' },
      description: 'The Plaza de Armas, the main square of Cusco with the cathedral, where the recorded walk starts.',
      aliases: { en: ['main square', 'the square', 'plaza'], es: ['plaza de armas', 'plaza principal', 'plaza'], ko: ['아르마스 광장', '광장'], qu: ['Huacaypata'] },
    },
    {
      id: 'qorikancha-ticket-booth', stretches: [], landmark: 'Qorikancha ticket booth',
      name: { en: 'Qorikancha ticket booth', es: 'Boletería del Qorikancha' },
      description: 'The ticket booth of Qorikancha, the Inca Temple of the Sun inside the Santo Domingo convent, where the recorded walk ends.',
      aliases: { en: ['Qorikancha', 'Coricancha', 'Korikancha', 'temple of the sun', 'ticket office', 'entrance'], es: ['Coricancha', 'templo del sol', 'boletería', 'taquilla', 'entrada'], ko: ['코리칸차', '태양의 신전', '매표소'], qu: ['Quri Kancha'] },
    },
    {
      id: 'catedral-del-cusco', stretches: [], landmark: 'Catedral del Cusco',
      name: { en: 'Catedral del Cusco', es: 'Catedral del Cusco' },
      description: 'The Cusco Cathedral on the Plaza de Armas, near the start of the walk.',
      aliases: { en: ['cathedral', 'Cusco cathedral'], es: ['catedral'], ko: ['쿠스코 대성당', '대성당'] },
    },
    {
      id: 'iglesia-de-la-compania-de-jesus', stretches: [], landmark: 'Iglesia de la Compañía de Jesús',
      name: { en: 'Iglesia de la Compañía de Jesús', es: 'Iglesia de la Compañía de Jesús' },
      description: 'The Jesuit church of the Compañía on the Plaza de Armas, beside the start of Calle Loreto.',
      aliases: { en: ['Compañía church', 'Jesuit church', 'church on the square'], es: ['la Compañía', 'iglesia de la Compañía'], ko: ['라 콤파니아 성당', '성당'] },
    },
    {
      id: 'calle-loreto', stretches: [], landmark: 'Loreto',
      name: { en: 'Calle Loreto', es: 'Calle Loreto' },
      description: 'Calle Loreto, the narrow pedestrian street with Inca stone walls that the walk follows from the Plaza de Armas towards Qorikancha.',
      aliases: { en: ['Loreto street', 'Loreto alley', 'Inca walls', 'narrow street'], es: ['calle Loreto', 'callejón Loreto', 'muros incas'], ko: ['로레토 거리', '골목'] },
    },
    {
      id: 'iglesia-de-santo-domingo', stretches: [], landmark: 'Iglesia de Santo Domingo',
      name: { en: 'Iglesia de Santo Domingo', es: 'Iglesia de Santo Domingo' },
      description: 'The Santo Domingo church, built on Qorikancha, beside the end of the walk.',
      aliases: { en: ['Santo Domingo church', 'church', 'convent'], es: ['Santo Domingo', 'iglesia', 'convento de Santo Domingo'], ko: ['산토도밍고 성당', '성당'] },
    },
    {
      id: 'monasterio-de-santa-catalina-de-sena', stretches: [], landmark: 'Monasterio de Santa Catalina de Sena',
      name: { en: 'Monasterio de Santa Catalina de Sena', es: 'Monasterio de Santa Catalina de Sena' },
      description: 'The Santa Catalina monastery, a convent beside the walk between the Plaza de Armas and Qorikancha.',
      aliases: { en: ['Santa Catalina', 'monastery', 'convent'], es: ['Santa Catalina', 'monasterio', 'convento'], ko: ['산타 카탈리나 수도원', '수도원'] },
    },
    {
      id: 'portal-de-carrizos', stretches: [], landmark: 'Portal de Carrizos',
      name: { en: 'Portal de Carrizos', es: 'Portal de Carrizos' },
      description: 'The Portal de Carrizos arcade on the Plaza de Armas, which the walk passes near the start.',
      aliases: { en: ['arcade', 'portico', 'covered walkway'], es: ['portal', 'soportales'], ko: ['아케이드', '회랑'] },
    },
  ],
};
