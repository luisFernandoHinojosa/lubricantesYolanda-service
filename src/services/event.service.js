import { EventEmitter as NodeEventEmitter } from 'events';

class AppEventEmitter extends NodeEventEmitter {
    constructor() {
        super();
        this.setMaxListeners(50);
    }

    onSafe(event, listener) {
        this.on(event, async (...args) => {
            try {
                await listener(...args);
            } catch (err) {
                console.error(`[Events] Error en listener de "${event}":`, err.message);
            }
        });
    }
}

export const eventEmitter = new AppEventEmitter();