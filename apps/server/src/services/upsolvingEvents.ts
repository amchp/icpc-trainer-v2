import { Chunk, Context, Effect, Layer, Stream } from "effect";

import type { UpsolvingContest, UpsolvingProgress } from "../contracts/upsolving.ts";

export type UpsolvingSyncEvent =
  | {
      readonly type: "sync.progress";
      readonly progress: UpsolvingProgress;
      readonly contest?: UpsolvingContest;
    }
  | {
      readonly type: "sync.completed";
      readonly progress: UpsolvingProgress;
    }
  | {
      readonly type: "startup.progress";
      readonly message: string;
    }
  | {
      readonly type: "startup.completed";
      readonly message: string;
    };

export interface UpsolvingEventServiceShape {
  readonly publish: (event: UpsolvingSyncEvent) => Effect.Effect<void>;
  readonly subscribe: () => Stream.Stream<UpsolvingSyncEvent>;
}

export class UpsolvingEventService extends Context.Tag(
  "icpc-trainer/UpsolvingEventService",
)<UpsolvingEventService, UpsolvingEventServiceShape>() {}

export const makeUpsolvingEventService = Effect.sync(() => {
  const listeners = new Set<(event: UpsolvingSyncEvent) => void>();
  let latestEvent: UpsolvingSyncEvent | null = null;

  return UpsolvingEventService.of({
    publish: (event) =>
      Effect.sync(() => {
        latestEvent = event;
        for (const listener of listeners) {
          listener(event);
        }
      }),
    subscribe: () =>
      Stream.async<UpsolvingSyncEvent>((emit) => {
        const listener = (event: UpsolvingSyncEvent) => {
          emit(Effect.succeed(Chunk.of(event)));
        };
        listeners.add(listener);
        if (latestEvent) {
          listener(latestEvent);
        }
        return Effect.sync(() => {
          listeners.delete(listener);
        });
      }, {
        bufferSize: 32,
        strategy: "sliding",
      }),
  });
});

export const UpsolvingEventServiceLive = Layer.effect(
  UpsolvingEventService,
  makeUpsolvingEventService,
);
