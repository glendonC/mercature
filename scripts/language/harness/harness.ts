import { prepareOffline } from '../../../src/offline';
import { FARM_FEATURES } from '../../../src/site/inventory';
import { QORIKANCHA_PLACE } from '../../../src/site/route';
import { forgetPlace, modelDownloadBytes, modelState, modelStored, prepareModel, prepareSite, remember, rememberedCount, understand } from '../../../src/language/understand';

/** The walk with one spot added the way the operator adds one, to time an edit of the place. */
const added = {
  id: 'added-1',
  name: { en: 'Steps near Loreto (210 to 220 m)', es: 'Escalones cerca de Loreto (210 a 220 m)' },
  description: 'Steps on the stretch from 210 to 220 m near Calle Loreto, recorded by the tour operator.',
  aliases: { en: ['steps', 'Calle Loreto'], es: ['escalones', 'calle Loreto'], ko: ['계단', '로레토 거리'] },
};
/** Exposes the language module to the measurement script; the page has no other behavior. */
const places = {
  farm: { id: 'noor-farm', features: FARM_FEATURES },
  route: QORIKANCHA_PLACE,
  'route-plus': { id: QORIKANCHA_PLACE.id, features: [...QORIKANCHA_PLACE.features, added] },
};
type PlaceName = keyof typeof places;
const log = (line: string) => { document.querySelector('#log')!.textContent += `${line}\n`; };
Object.assign(window, {
  languageCheck: {
    modelState,
    modelStored,
    modelDownloadBytes,
    prepare: () => prepareModel(state => log(JSON.stringify(state))),
    prepareSite: async (place: PlaceName = 'farm') => {
      const ticks: number[] = [];
      const started = performance.now();
      const result = await prepareSite(places[place], done => ticks.push(done));
      return { result, ticks, ms: Math.round(performance.now() - started) };
    },
    understand: (message: string, place: PlaceName = 'farm') => understand(message, places[place]),
    remember: (message: string, place: PlaceName, spot: string) => remember(message, places[place], spot),
    rememberedCount: (place: PlaceName) => rememberedCount(places[place].id),
    forgetPlace: (place: PlaceName) => forgetPlace(places[place].id),
  },
});
void prepareOffline();
log('ready');
