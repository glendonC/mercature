/**
 * Example visitor messages for the demo inbox, labelled Example wherever they show.
 * They are synthetic messages from the language evaluation sets (scripts/language/route-messages.json
 * and memory-messages.json), written by a large language model for this project; none is a real visitor.
 */
/** translated: machine-translated into its language, and labelled so. */
export type ExampleMessage = { readonly id: string; readonly language: string; readonly text: string; readonly translated?: true };

export const EXAMPLES: Readonly<Record<string, readonly ExampleMessage[]>> = {
  'cusco-qorikancha': [
    { id: 'example-ko-steps', language: 'ko', text: '코리칸차 가는 길에 성당 옆 잉카 돌담 골목에 있는 돌계단이 너무 가팔라서 어머니가 내려가시기 힘들었어요.' },
    { id: 'example-es-hard', language: 'es', text: 'Algunas partes del recorrido fueron bien duras para mi mamá, que tiene 80 años, con tanta subida y bajada y piedras disparejas.' },
    { id: 'example-es-praise', language: 'es', text: 'La verdad, los escalones al salir de la Plaza de Armas, junto a la Catedral, no fueron ningún problema. Mi abuela pasó tranquila.' },
    { id: 'example-en-question', language: 'en', text: 'Quick question: is the Qorikancha ticket booth wheelchair accessible? And can we just buy tickets there on the day, or only online?' },
    { id: 'example-qu-loreto', language: 'qu', translated: true, text: "Calle Loreto Maruriwan tupasqanpi kaq rumi gradakunapiqa mana hap'ikunapaq pasamanos kanchu. Machulayqa tawnawanmi purin, sapa gradapim makiyta tawnakunan karqan." },
    { id: 'example-qu-loreto-again', language: 'qu', translated: true, text: "Santa Catalinata pasaspa, Maruriwan k'uchunpi, Calle Loretoqa yaqa pichqa rumi gradakunaman tukupun, maypipas mana rampa kanchu. Ruedayuq tiyanapi puriqpaqqa chaypim ñan tukukun, mana pipas apasunkichu chayqa." },
    { id: 'example-es-stroller', language: 'es', text: 'Con el coche de mi bebé no pudimos bajar el bordillo frente al Portal de Carrizos, no había ninguna rampa.' },
    { id: 'example-ko-rest', language: 'ko', text: '코리칸차 매표소 근처에 잠깐 앉아서 쉴 수 있는 벤치나 화장실이 있나요?' },
    { id: 'example-en-wheelchair', language: 'en', text: "My husband uses a wheelchair and we couldn't get past the stone steps on Calle Loreto where it meets Maruri. We had to turn back." },
  ],
  'tbilisi-narikala': [
    { id: 'example-en-cablecar', language: 'en', text: 'The steps right outside the cable car station were steep and my mother had to hold the handrail all the way.' },
    { id: 'example-es-betlemi', language: 'es', text: 'No pudimos pasar la silla de ruedas por los escalones junto a la iglesia de Betlemi.' },
    { id: 'example-ko-cobbles', language: 'ko', text: '유모차를 끌고 요새로 올라가는 자갈길이 너무 울퉁불퉁해서 정말 힘들었어요.' },
    { id: 'example-en-toilet', language: 'en', text: 'Is there a toilet near the fortress gate?' },
  ],
};
