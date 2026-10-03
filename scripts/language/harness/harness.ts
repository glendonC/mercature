import { prepareOffline } from '../../../src/offline';
import { FARM_FEATURES } from '../../../src/site/inventory';
import type { Site } from '../../../src/site/contracts';
import { modelState, modelStored, prepareModel, understand } from '../../../src/language/understand';

/** Exposes the language module to the measurement script; the page has no other behavior. */
const farm = { id: 'noor-farm', features: FARM_FEATURES } as unknown as Site;
const log = (line: string) => { document.querySelector('#log')!.textContent += `${line}\n`; };
Object.assign(window, {
  languageCheck: {
    modelState,
    modelStored,
    prepare: () => prepareModel(state => log(JSON.stringify(state))),
    understand: (message: string) => understand(message, farm),
  },
});
void prepareOffline();
log('ready');
