import { prepareOffline } from '../../../src/offline';
import { FARM_FEATURES } from '../../../src/site/inventory';
import { QORIKANCHA_PLACE } from '../../../src/site/route';
import { forgetPlace, modelDownloadBytes, modelState, modelStored, prepareModel, prepareSite, remember, rememberedCount, understand } from '../../../src/language/understand';

/** Exposes the language module to the measurement script; the page has no other behavior. */
const places = { farm: { id: 'noor-farm', features: FARM_FEATURES }, route: QORIKANCHA_PLACE };
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
