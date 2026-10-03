/**
 * Label passages for the kind and issue-type heads: short descriptions of each label in English,
 * Spanish and Korean. They are general, not specific to one site. Written for this project.
 */
export const KIND_PROTOTYPES = {
  problem: [
    'passage: Something was wrong and caused a problem for us; a complaint.',
    'passage: Hubo un problema, algo estaba mal; una queja.',
    'passage: 문제가 있었어요. 불편했어요. 불만이에요.',
  ],
  praise: [
    'passage: We loved it, it was great; there was no problem at all and it was easy.',
    'passage: Nos encantó, todo bien, no hubo ningún problema.',
    'passage: 너무 좋았어요. 전혀 문제없었어요. 고쳐져서 좋아요.',
  ],
  question: [
    'passage: A question: can we, is there, how much, when, do you?',
    'passage: Una pregunta: ¿se puede, hay, cuánto cuesta, cuándo?',
    'passage: 질문이 있어요. 가능한가요? 얼마인가요? 있나요?',
  ],
};

export const CATEGORY_PROTOTYPES = {
  'path-blocked': [
    'passage: Something was in the way and blocked the path, we could not get through.',
    'passage: Algo bloqueaba el paso y no pudimos pasar.',
    'passage: 뭔가 길을 막고 있어서 지나갈 수 없었어요.',
  ],
  'steps-or-slope': [
    'passage: The steps, slope or ground were steep, uneven or slippery and hard to walk on.',
    'passage: Las gradas o el suelo eran empinados, disparejos o resbalosos.',
    'passage: 계단이나 바닥이 가파르고 울퉁불퉁하거나 미끄러워서 걷기 힘들었어요.',
  ],
  'seating-or-shade': [
    'passage: There was nowhere to sit or no shade, too hot in the sun while waiting.',
    'passage: No había dónde sentarse ni sombra, hacía mucho calor.',
    'passage: 앉을 곳도 그늘도 없어서 땡볕에서 기다렸어요.',
  ],
  'signs-or-language': [
    'passage: The sign or written information was missing, unreadable or only in one language.',
    'passage: No había letreros o estaban solo en un idioma y no se entendían.',
    'passage: 안내판이 없거나 한 언어로만 써 있어서 읽을 수 없었어요.',
  ],
  facilities: [
    'passage: The toilet was dirty, with no soap, toilet paper or water to wash hands or drink.',
    'passage: El baño estaba sucio, sin jabón, papel ni agua.',
    'passage: 화장실이 더럽고 휴지나 비누, 물이 없었어요.',
  ],
  other: [
    'passage: Another problem: noise, smoke, insects, animals, price, taste or timing.',
    'passage: Otro problema: ruido, humo, insectos, animales, precio o sabor.',
    'passage: 기타 문제: 소음, 연기, 벌레, 동물, 가격, 맛, 시간.',
  ],
};
