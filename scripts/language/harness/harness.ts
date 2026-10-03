import { prepareOffline } from '../../../src/offline';
import { FARM_FEATURES } from '../../../src/site/inventory';
import { modelState, modelStored, prepareModel, prepareSite, understand } from '../../../src/language/understand';

/** Exposes the language module to the measurement script; the page has no other behavior. */
const farm = { id: 'noor-farm', features: FARM_FEATURES };
const log = (line: string) => { document.querySelector('#log')!.textContent += `${line}\n`; };
Object.assign(window, {
  languageCheck: {
    modelState,
    modelStored,
    prepare: () => prepareModel(state => log(JSON.stringify(state))),
    prepareSite: async () => {
      const ticks: number[] = [];
      const started = performance.now();
      const result = await prepareSite(farm, done => ticks.push(done));
      return { result, ticks, ms: Math.round(performance.now() - started) };
    },
    understand: (message: string) => understand(message, farm),
  },
});
void prepareOffline();
log('ready');
