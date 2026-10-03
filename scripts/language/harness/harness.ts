import { prepareOffline } from '../../../src/offline';
import { FARM_FEATURES } from '../../../src/site/inventory';
import { QORIKANCHA_PLACE } from '../../../src/site/route';
import { modelState, modelStored, prepareModel, prepareSite, understand } from '../../../src/language/understand';

/** Exposes the language module to the measurement script; the page has no other behavior. */
const places = { farm: { id: 'noor-farm', features: FARM_FEATURES }, route: QORIKANCHA_PLACE };
type PlaceName = keyof typeof places;
const log = (line: string) => { document.querySelector('#log')!.textContent += `${line}\n`; };
Object.assign(window, {
  languageCheck: {
    modelState,
    modelStored,
    prepare: () => prepareModel(state => log(JSON.stringify(state))),
    prepareSite: async (place: PlaceName = 'farm') => {
      const ticks: number[] = [];
      const started = performance.now();
      const result = await prepareSite(places[place], done => ticks.push(done));
      return { result, ticks, ms: Math.round(performance.now() - started) };
    },
    understand: (message: string, place: PlaceName = 'farm') => understand(message, places[place]),
  },
});
void prepareOffline();
log('ready');
