import type { RoutePlace } from './route.ts';

/**
 * The words visitors use for the recorded walk from the Narikala cable car top station to the Narikala fortress gate,
 * authored from the local record tbilisi-narikala (mercature-route/1). Its OpenStreetMap names are Georgian, so each
 * landmark keeps that name as its key and gets English and Spanish names here. Photo findings are model suggestions
 * that nobody has verified, a stretch without findings only means no barrier was seen in photos, and nothing here
 * states a width, height, slope or whether anyone can pass.
 */
export const NARIKALA_PLACE: RoutePlace = {
  id: 'tbilisi-narikala',
  folder: 'narikala',
  features: [
    {
      id: 'steps-0-40', stretches: [0, 1, 2, 3], landmark: 'Narikala cable car top station',
      name: { en: 'Steps at the cable car top station (0 to 40 m)', es: 'Escalones en la estación superior del teleférico (0 a 40 m)' },
      description: 'Steps where the walk leaves the cable car top station, which OpenStreetMap records as steps and a model also suggests in street photos with handrails beside them, none of it verified.',
      aliases: { en: ['steps', 'stairs', 'cable car', 'cable car station', 'top of the cable car', 'handrail'], es: ['escalones', 'escaleras', 'teleférico', 'estación del teleférico', 'pasamanos'], ko: ['계단', '케이블카', '케이블카 정류장', '난간'] },
    },
    {
      id: 'steps-40-50', stretches: [4], landmark: 'Narikala cable car top station',
      name: { en: 'Steps near the cable car top station (40 to 50 m)', es: 'Escalones cerca de la estación superior del teleférico (40 a 50 m)' },
      description: 'More steps on the path just past the cable car top station, suggested by a model in a street photo and not verified.',
      aliases: { en: ['steps', 'stairs', 'path from the cable car'], es: ['escalones', 'escaleras', 'camino del teleférico'], ko: ['계단', '케이블카 근처 계단'] },
    },
    {
      id: 'no-photos-60-100', stretches: [6, 7, 8, 9], landmark: 'Narikala cable car top station',
      name: { en: 'No photos near the cable car top station (60 to 100 m)', es: 'Sin fotos cerca de la estación superior del teleférico (60 a 100 m)' },
      description: 'No street photos cover this part of the path from the cable car top station, so nothing is known about it.',
      aliases: { en: ['no photos', 'unseen part', 'path from the cable car'], es: ['sin fotos', 'tramo sin fotos'], ko: ['사진 없음'] },
    },
    {
      id: 'steps-100-160', stretches: [10, 11, 12, 13, 14, 15], landmark: 'სოლოლაკის ხეივანი',
      name: { en: 'Steps on Sololaki Alley (100 to 160 m)', es: 'Escalones en el paseo de Sololaki (100 a 160 m)' },
      description: 'Flights of steps on the ridge path towards Sololaki Alley, which OpenStreetMap records with handrails, one of 15 steps with no ramp, and no street photos show, none of it verified.',
      aliases: { en: ['steps', 'stairs', 'handrail', 'path along the ridge', 'Sololaki'], es: ['escalones', 'escaleras', 'pasamanos', 'camino de la cresta'], ko: ['계단', '난간', '능선 길'] },
    },
    {
      id: 'no-photos-160-200', stretches: [16, 17, 18, 19], landmark: 'სოლოლაკის ხეივანი',
      name: { en: 'No photos on Sololaki Alley (160 to 200 m)', es: 'Sin fotos en el paseo de Sololaki (160 a 200 m)' },
      description: 'No street photos cover this part of Sololaki Alley before the stairway on the Sololaki ridge, so nothing is known about it.',
      aliases: { en: ['no photos', 'unseen part', 'Sololaki Alley'], es: ['sin fotos', 'tramo sin fotos', 'paseo de Sololaki'], ko: ['사진 없음', '솔롤라키 산책로'] },
    },
    {
      id: 'steps-210-420', stretches: [21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41], landmark: 'სოლოლაკის ქედი',
      name: { en: 'Steps on the Sololaki ridge (210 to 420 m)', es: 'Escalones en la cresta de Sololaki (210 a 420 m)' },
      description: 'The long stairway on the Sololaki ridge towards the Betlemi church, which OpenStreetMap records as steps with a handrail on some flights and none on others and a model also suggests in street photos, none of it verified.',
      aliases: { en: ['steps', 'stairs', 'long staircase', 'steep steps', 'stairs from the fortress', 'handrail', 'Sololaki'], es: ['escalones', 'escaleras', 'escalinata', 'pasamanos'], ko: ['계단', '긴 계단', '가파른 계단', '난간', '솔롤라키'] },
    },
    {
      id: 'steps-440-460', stretches: [44, 45], landmark: 'ბეთლემის ეკლესია',
      name: { en: 'Steps by the Betlemi church (440 to 460 m)', es: 'Escalones cerca de la iglesia de Betlemi (440 a 460 m)' },
      description: 'Steps beside the Betlemi church, which OpenStreetMap records with no handrail and no ramp, none of it verified.',
      aliases: { en: ['steps', 'stairs', 'church steps', 'no handrail'], es: ['escalones', 'escaleras', 'iglesia de Betlemi', 'sin pasamanos'], ko: ['계단', '베틀레미 교회', '난간 없음'] },
    },
    {
      id: 'no-photos-460-470', stretches: [46], landmark: 'ბეთლემის აღმართი',
      name: { en: 'No photos on Betlemi Rise (460 to 470 m)', es: 'Sin fotos en la subida de Betlemi (460 a 470 m)' },
      description: 'No street photos cover this short part of Betlemi Rise beside the church, so nothing is known about it.',
      aliases: { en: ['no photos', 'unseen part', 'Betlemi Rise'], es: ['sin fotos', 'tramo sin fotos', 'subida de Betlemi'], ko: ['사진 없음', '베틀레미 오르막'] },
    },
    {
      id: 'steps-490-520', stretches: [49, 50, 51], landmark: 'ასკანას ქუჩა',
      name: { en: 'Steps on Askana Street (490 to 520 m)', es: 'Escalones en la calle Askana (490 a 520 m)' },
      description: 'Steps where the walk meets Askana Street near the Betlemi bell tower, which OpenStreetMap records with no handrail and no ramp, none of it verified.',
      aliases: { en: ['steps', 'stairs', 'no handrail', 'cobbled steps', 'bell tower'], es: ['escalones', 'escaleras', 'sin pasamanos', 'campanario'], ko: ['계단', '난간 없음', '종탑'] },
    },
    {
      id: 'no-photos-560-610', stretches: [56, 57, 58, 59, 60], landmark: 'გომის ქუჩა',
      name: { en: 'No photos on Gomi Street (560 to 610 m)', es: 'Sin fotos en la calle Gomi (560 a 610 m)' },
      description: 'No street photos cover this part of Gomi Street near the Ateshgah fire temple, so nothing is known about it.',
      aliases: { en: ['no photos', 'unseen part', 'Gomi Street'], es: ['sin fotos', 'tramo sin fotos', 'calle Gomi'], ko: ['사진 없음', '고미 거리'] },
    },
    {
      id: 'steps-630-640', stretches: [63], landmark: 'ბეთლემის ქუჩა',
      name: { en: 'Steps on Betlemi Street (630 to 640 m)', es: 'Escalones en la calle Betlemi (630 a 640 m)' },
      description: 'Steps where Gomi Street meets Betlemi Street, suggested by a model in a street photo and not verified.',
      aliases: { en: ['steps', 'stairs', 'Betlemi Street', 'old town'], es: ['escalones', 'escaleras', 'calle Betlemi', 'casco antiguo'], ko: ['계단', '베틀레미 거리', '구시가지'] },
    },
    {
      id: 'steps-680-690', stretches: [68], landmark: 'ბეთლემის ქუჩა',
      name: { en: 'Steps on Betlemi Street (680 to 690 m)', es: 'Escalones en la calle Betlemi (680 a 690 m)' },
      description: 'Steps further along Betlemi Street in the old town, suggested by a model in a street photo and not verified.',
      aliases: { en: ['steps', 'stairs', 'Betlemi Street', 'old town'], es: ['escalones', 'escaleras', 'calle Betlemi', 'casco antiguo'], ko: ['계단', '베틀레미 거리', '구시가지'] },
    },
    {
      id: 'steps-710-730', stretches: [71, 72], landmark: 'ბეთლემის ქუჩა',
      name: { en: 'Steps on Betlemi Street (710 to 730 m)', es: 'Escalones en la calle Betlemi (710 a 730 m)' },
      description: 'Steps with a kerb and a post beside them on Betlemi Street, suggested by a model in street photos and not verified.',
      aliases: { en: ['steps', 'stairs', 'kerb', 'curb', 'post', 'Betlemi Street'], es: ['escalones', 'bordillo', 'poste', 'calle Betlemi'], ko: ['계단', '연석', '기둥'] },
    },
    {
      id: 'no-photos-730-830', stretches: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82], landmark: 'ბეთლემის ქუჩა',
      name: { en: 'No photos on Betlemi Street (730 to 830 m)', es: 'Sin fotos en la calle Betlemi (730 a 830 m)' },
      description: 'No street photos cover this part of Betlemi Street towards the Armenian cathedral of Surb Gevork, so nothing is known about it.',
      aliases: { en: ['no photos', 'unseen part', 'Betlemi Street'], es: ['sin fotos', 'tramo sin fotos', 'calle Betlemi'], ko: ['사진 없음', '베틀레미 거리'] },
    },
    {
      id: 'steps-840-860', stretches: [84, 85], landmark: 'სურფგევორქი',
      name: { en: 'Steps near the Surb Gevork cathedral (840 to 860 m)', es: 'Escalones cerca de la catedral de Surb Gevork (840 a 860 m)' },
      description: 'Steps near Surb Gevork, the Armenian cathedral, suggested by a model in street photos and not verified.',
      aliases: { en: ['steps', 'stairs', 'Armenian cathedral', 'Surb Gevork'], es: ['escalones', 'escaleras', 'catedral armenia'], ko: ['계단', '아르메니아 대성당'] },
    },
    {
      id: 'no-photos-860-870', stretches: [86], landmark: 'ჯემალ აჯიაშვილის ქუჩა',
      name: { en: 'No photos on Jemal Ajiashvili Street (860 to 870 m)', es: 'Sin fotos en la calle Jemal Ajiashvili (860 a 870 m)' },
      description: 'No street photos cover this short part of Jemal Ajiashvili Street, so nothing is known about it.',
      aliases: { en: ['no photos', 'unseen part'], es: ['sin fotos', 'tramo sin fotos'], ko: ['사진 없음'] },
    },
    {
      id: 'steps-870-920', stretches: [87, 88, 89, 90, 91], landmark: 'ჯემალ აჯიაშვილის ქუჩა',
      name: { en: 'Steps on Jemal Ajiashvili Street (870 to 920 m)', es: 'Escalones en la calle Jemal Ajiashvili (870 a 920 m)' },
      description: 'Steps and kerbs on the cobbled lane of Jemal Ajiashvili Street towards the fortress, suggested by a model in street photos and not verified.',
      aliases: { en: ['steps', 'stairs', 'kerb', 'cobbled lane', 'cobblestones', 'lane to the fortress', 'steep street'], es: ['escalones', 'bordillo', 'calle empedrada', 'adoquines'], ko: ['계단', '연석', '자갈길', '돌길'] },
    },
    {
      id: 'steps-920-990', stretches: [92, 93, 94, 95, 96, 97, 98], landmark: 'დათა გულუას აღმართი',
      name: { en: 'Steps on Data Gulua Rise (920 to 990 m)', es: 'Escalones en la subida Data Gulua (920 a 990 m)' },
      description: 'Two flights of steps on the lane to the fortress with a gate between them, which OpenStreetMap records as 40 and 23 steps with a handrail and no ramp and a model also suggests in street photos, none of it verified.',
      aliases: { en: ['steps', 'stairs', 'steep steps', 'steps up to the fortress', 'handrail', 'gate'], es: ['escalones', 'escaleras', 'escaleras a la fortaleza', 'pasamanos', 'portón'], ko: ['계단', '가파른 계단', '요새 가는 계단', '난간', '문'] },
    },
    {
      id: 'steps-990-1010', stretches: [99, 100], landmark: 'Narikala fortress gate',
      name: { en: 'Steps at the fortress gate (990 to 1010 m)', es: 'Escalones en la puerta de la fortaleza (990 a 1010 m)' },
      description: 'Steps just before the Narikala fortress gate, which OpenStreetMap records as a flight of 23 steps with a handrail and no ramp and no street photos show, none of it verified.',
      aliases: { en: ['steps', 'stairs', 'fortress gate', 'entrance steps', 'Narikala'], es: ['escalones', 'escaleras', 'puerta de la fortaleza', 'entrada'], ko: ['계단', '요새 입구', '입구 계단'] },
    },
    {
      id: 'cable-car-top-station', stretches: [], landmark: 'Narikala cable car top station',
      name: { en: 'Narikala cable car top station', es: 'Estación superior del teleférico de Narikala' },
      description: 'The top station of the cable car up to Narikala, where the recorded walk starts.',
      aliases: { en: ['cable car', 'cable car station', 'gondola', 'top station', 'start of the walk'], es: ['teleférico', 'estación del teleférico', 'estación superior'], ko: ['케이블카 정류장', '케이블카', '출발점'] },
    },
    {
      id: 'narikala-fortress-gate', stretches: [], landmark: 'Narikala fortress gate',
      name: { en: 'Narikala fortress gate', es: 'Puerta de la fortaleza de Narikala' },
      description: 'The gate of Narikala, the old fortress above Tbilisi, where the recorded walk ends.',
      aliases: { en: ['Narikala', 'fortress', 'fortress gate', 'castle', 'entrance', 'end of the walk'], es: ['Narikala', 'fortaleza', 'puerta', 'castillo', 'entrada'], ko: ['나리칼라 요새 입구', '나리칼라', '요새', '입구'] },
    },
    {
      id: 'sololaki-alley', stretches: [], landmark: 'სოლოლაკის ხეივანი',
      name: { en: 'Sololaki Alley', es: 'Paseo de Sololaki' },
      description: 'Sololaki Alley, the pedestrian way on the Sololaki ridge that the walk follows after the cable car station.',
      aliases: { en: ['Sololaki Alley', 'path on the ridge', 'walkway'], es: ['paseo de Sololaki', 'camino de la cresta'], ko: ['솔롤라키 산책로', '능선 길'] },
    },
    {
      id: 'sololaki-ridge', stretches: [], landmark: 'სოლოლაკის ქედი',
      name: { en: 'Sololaki ridge', es: 'Cresta de Sololaki' },
      description: 'The Sololaki ridge below the fortress, where the walk follows a long stairway towards the Betlemi church.',
      aliases: { en: ['Sololaki ridge', 'ridge', 'long stairway'], es: ['cresta de Sololaki', 'escalinata'], ko: ['솔롤라키 능선', '능선'] },
    },
    {
      id: 'betlemi-church', stretches: [], landmark: 'ბეთლემის ეკლესია',
      name: { en: 'Betlemi church', es: 'Iglesia de Betlemi' },
      description: 'The Betlemi church, an old church above the old town that the walk passes after the stairway.',
      aliases: { en: ['Betlemi church', 'Bethlehem church', 'church'], es: ['iglesia de Betlemi', 'iglesia de Belén', 'iglesia'], ko: ['베틀레미 교회', '교회'] },
    },
    {
      id: 'betlemi-rise', stretches: [], landmark: 'ბეთლემის აღმართი',
      name: { en: 'Betlemi Rise', es: 'Subida de Betlemi' },
      description: 'Betlemi Rise, the old lane past the Betlemi church in the Betlemi quarter.',
      aliases: { en: ['Betlemi Rise', 'Betlemi steps', 'Betlemi quarter'], es: ['subida de Betlemi', 'barrio de Betlemi'], ko: ['베틀레미 오르막', '베틀레미 계단'] },
    },
    {
      id: 'askana-street', stretches: [], landmark: 'ასკანას ქუჩა',
      name: { en: 'Askana Street', es: 'Calle Askana' },
      description: 'Askana Street, a stepped lane near the Betlemi bell tower that the walk crosses.',
      aliases: { en: ['Askana Street', 'bell tower'], es: ['calle Askana', 'campanario'], ko: ['아스카나 거리', '종탑'] },
    },
    {
      id: 'ateshgah', stretches: [], landmark: 'ათეშგა',
      name: { en: 'Ateshgah fire temple', es: 'Templo del fuego Ateshgah' },
      description: 'The Ateshgah, an old Zoroastrian fire temple among the houses beside the walk.',
      aliases: { en: ['Ateshgah', 'fire temple', 'Zoroastrian temple'], es: ['Ateshgah', 'templo del fuego', 'templo zoroástrico'], ko: ['아테슈가', '불의 사원', '조로아스터교 사원'] },
    },
    {
      id: 'gomi-street', stretches: [], landmark: 'გომის ქუჩა',
      name: { en: 'Gomi Street', es: 'Calle Gomi' },
      description: 'Gomi Street, a cobbled street of old houses that the walk follows in the Betlemi quarter.',
      aliases: { en: ['Gomi Street', 'cobbled street', 'old houses'], es: ['calle Gomi', 'calle empedrada'], ko: ['고미 거리', '자갈길'] },
    },
    {
      id: 'betlemi-street', stretches: [], landmark: 'ბეთლემის ქუჩა',
      name: { en: 'Betlemi Street', es: 'Calle Betlemi' },
      description: 'Betlemi Street, the old town street that the walk follows towards the Armenian cathedral.',
      aliases: { en: ['Betlemi Street', 'old town', 'narrow street'], es: ['calle Betlemi', 'casco antiguo', 'calle estrecha'], ko: ['베틀레미 거리', '구시가지', '좁은 길'] },
    },
    {
      id: 'surb-gevork', stretches: [], landmark: 'სურფგევორქი',
      name: { en: 'Surb Gevork cathedral', es: 'Catedral de Surb Gevork' },
      description: 'Surb Gevork, the Armenian cathedral of Saint George in the old town, beside the walk.',
      aliases: { en: ['Armenian cathedral', 'Saint George', 'Surb Gevork', 'Surb Gevorg'], es: ['catedral armenia', 'San Jorge'], ko: ['아르메니아 대성당', '성 게오르기 대성당'] },
    },
    {
      id: 'jemal-ajiashvili-street', stretches: [], landmark: 'ჯემალ აჯიაშვილის ქუჩა',
      name: { en: 'Jemal Ajiashvili Street', es: 'Calle Jemal Ajiashvili' },
      description: 'Jemal Ajiashvili Street, the cobbled lane from the old town towards the fortress.',
      aliases: { en: ['Jemal Ajiashvili Street', 'cobbled lane', 'lane to the fortress'], es: ['calle Jemal Ajiashvili', 'calle empedrada'], ko: ['제말 아지아슈빌리 거리', '돌길'] },
    },
    {
      id: 'data-gulua-rise', stretches: [], landmark: 'დათა გულუას აღმართი',
      name: { en: 'Data Gulua Rise', es: 'Subida Data Gulua' },
      description: 'Data Gulua Rise, the lane with steps that leads to the fortress gate at the end of the walk.',
      aliases: { en: ['Data Gulua Rise', 'way up to the fortress', 'steps to the fortress'], es: ['subida Data Gulua', 'subida a la fortaleza'], ko: ['다타 굴루아 오르막', '요새 가는 길'] },
    },
    {
      id: 'st-nicholas-church', stretches: [], landmark: 'ნარიყალას წმინდა ნიკოლოზის სასწაულმოქმედის სახელობის ტაძარი',
      name: { en: 'St Nicholas church of Narikala', es: 'Iglesia de San Nicolás de Narikala' },
      description: 'The St Nicholas church inside Narikala fortress, near the end of the walk.',
      aliases: { en: ['St Nicholas church', 'church in the fortress'], es: ['iglesia de San Nicolás', 'iglesia de la fortaleza'], ko: ['성 니콜라스 교회', '요새 안 교회'] },
    },
  ],
};
