import { EventEmitter as BaseEventEmitter } from 'events'

export type EventMap = Record<string, any>;

export type EventKey<T extends EventMap> = string & keyof T;
export type EventReceiver<T> = (...params: T[]) => void;

export interface Emitter<T extends EventMap> {
    on<K extends EventKey<T>>
        (eventName: K, fn: EventReceiver<T[K]>): void;
    off<K extends EventKey<T>>
        (eventName: K, fn: EventReceiver<T[K]>): void;
    emit<K extends EventKey<T>>
        (eventName: K, params: T[K]): void;
}

export class EventEmitter<T extends EventMap> implements Emitter<T> {
    private emitter = new BaseEventEmitter();
    on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>) {
        this.emitter.on(eventName, fn);
    }

    off<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>) {
        this.emitter.off(eventName, fn);
    }

    emit<K extends EventKey<T>>(eventName: K, ...params: T[K][]) {
        this.emitter.emit(eventName, ...params);
    }
}
