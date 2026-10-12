import { registerRootComponent } from 'expo';
import { installSecureRandom } from './src/secureRandom';
import { App } from './src/App';

installSecureRandom();
registerRootComponent(App);
